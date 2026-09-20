"""Isolated PostgreSQL HTTP check for the approved session and setup flow."""

import asyncio
from urllib.parse import parse_qs, urlsplit
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.config import get_settings
from app.db.models import Permission, User, UserType, UserTypePermission
from app.db.session import create_engine, create_session_factory
from app.main import app
from app.security.passwords import hash_password


OWNER_EMAIL = "owner-auth-check@example.test"
TARGET_EMAIL = "new-user-auth-check@example.test"
OWNER_PASSWORD = "owner initial secret"
NEW_OWNER_PASSWORD = "owner changed secret"
TARGET_PASSWORD = "new user secure secret"


async def seed() -> tuple[str, str]:
    engine = create_engine(get_settings())
    try:
        factory = create_session_factory(engine)
        async with factory() as db:
            user_type = UserType(id=uuid4(), name="Auth Check Type", description="Isolated test", active=True)
            permission = Permission(id=uuid4(), domain="Users", action="edit", description="Manage users", enabled=True)
            view_permission = Permission(id=uuid4(), domain="Users", action="view", description="View users", enabled=True)
            db.add_all([user_type, permission, view_permission])
            await db.flush()
            owner = User(id=uuid4(), email=OWNER_EMAIL, full_name="Auth Check Owner", password_hash=hash_password(OWNER_PASSWORD), user_type_id=user_type.id, organization_scope="organization", active=True)
            target = User(id=uuid4(), email=TARGET_EMAIL, full_name="Auth Check New User", user_type_id=user_type.id, organization_scope="organization", active=False)
            db.add_all([UserTypePermission(user_type_id=user_type.id, permission_id=permission.id), UserTypePermission(user_type_id=user_type.id, permission_id=view_permission.id), owner, target])
            await db.commit()
            return str(owner.id), str(target.id)
    finally:
        await engine.dispose()


async def disable_target() -> None:
    engine = create_engine(get_settings())
    try:
        async with create_session_factory(engine)() as db:
            target = (await db.scalars(select(User).where(User.email == TARGET_EMAIL))).one()
            target.active = False
            await db.commit()
    finally:
        await engine.dispose()


def token_from(link: str) -> str:
    return parse_qs(urlsplit(link).query)["token"][0]


def main() -> None:
    _, target_id = asyncio.run(seed())
    with TestClient(app, base_url="http://localhost") as client:
        assert client.get("/api/v1/auth/session").status_code == 401
        assert client.post("/api/v1/auth/login", json={"email": OWNER_EMAIL, "password": "wrong"}).status_code == 401
        login = client.post("/api/v1/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PASSWORD})
        assert login.status_code == 200, login.text
        assert "httponly" in login.headers["set-cookie"].lower()
        assert client.get("/api/v1/auth/session").json()["user"]["email"] == OWNER_EMAIL
        link_path = f"/api/v1/auth/users/{target_id}/setup-link"
        first = client.post(link_path)
        second = client.post(link_path)
        assert first.status_code == second.status_code == 200, (first.text, second.text)
        first_token = token_from(first.json()["setup_url"])
        second_token = token_from(second.json()["setup_url"])
        assert first_token != second_token
        assert client.post("/api/v1/auth/setup-password", json={"token": first_token, "password": TARGET_PASSWORD}).status_code == 400
        assert client.post("/api/v1/auth/setup-password", json={"token": second_token, "password": TARGET_PASSWORD}).status_code == 200
        assert client.post("/api/v1/auth/setup-password", json={"token": second_token, "password": TARGET_PASSWORD}).status_code == 400
        changed = client.post("/api/v1/auth/change-password", json={"current_password": OWNER_PASSWORD, "new_password": NEW_OWNER_PASSWORD})
        assert changed.status_code == 200, changed.text
        assert client.post("/api/v1/auth/logout-all").status_code == 200
        assert client.get("/api/v1/auth/session").status_code == 401
        assert client.post("/api/v1/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PASSWORD}).status_code == 401
        assert client.post("/api/v1/auth/login", json={"email": OWNER_EMAIL, "password": NEW_OWNER_PASSWORD}).status_code == 200
        assert client.post("/api/v1/auth/logout").status_code == 200
        assert client.get("/api/v1/auth/session").status_code == 401
        assert client.post("/api/v1/auth/login", json={"email": TARGET_EMAIL, "password": TARGET_PASSWORD}).status_code == 200
        asyncio.run(disable_target())
        assert client.get("/api/v1/auth/session").status_code == 401
        assert client.post("/api/v1/auth/login", json={"email": TARGET_EMAIL, "password": TARGET_PASSWORD}).status_code == 401
        assert client.post("/api/v1/auth/login", json={"email": OWNER_EMAIL, "password": NEW_OWNER_PASSWORD}).status_code == 200
        disabled_reset = client.post(link_path)
        assert disabled_reset.status_code == 200
        reset_token = token_from(disabled_reset.json()["setup_url"])
        assert client.post("/api/v1/auth/setup-password", json={"token": reset_token, "password": "disabled account reset password"}).status_code == 200
        assert client.post("/api/v1/auth/login", json={"email": TARGET_EMAIL, "password": "disabled account reset password"}).status_code == 401
    print("Login, cookies, setup-link replacement and replay protection, password change, logout, and disabled-user checks passed")


if __name__ == "__main__":
    main()
