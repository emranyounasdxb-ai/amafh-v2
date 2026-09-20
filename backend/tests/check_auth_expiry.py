"""Exercise idle and absolute expiry against the isolated auth test database."""

import asyncio
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.config import get_settings
from app.db.models import Session, User, UserType
from app.db.session import create_engine, create_session_factory
from app.main import app
from app.security.passwords import hash_password, token_hash


async def age_session(token: str, field: str) -> None:
    engine = create_engine(get_settings())
    try:
        async with create_session_factory(engine)() as db:
            session = (await db.scalars(select(Session).where(Session.token_hash == token_hash(token)))).one()
            setattr(session, field, datetime.now(timezone.utc) - timedelta(hours=9))
            await db.commit()
    finally:
        await engine.dispose()


async def create_unprivileged_user() -> str:
    engine = create_engine(get_settings())
    try:
        async with create_session_factory(engine)() as db:
            existing = (await db.scalars(select(User).where(User.email == "unprivileged-auth-check@example.test"))).one_or_none()
            if existing:
                return str(existing.id)
            user_type = UserType(id=uuid4(), name="Auth Check Unprivileged", description="No permissions", active=True)
            db.add(user_type)
            await db.flush()
            user = User(id=uuid4(), email="unprivileged-auth-check@example.test", full_name="Unprivileged", password_hash=hash_password("unprivileged secret"), user_type_id=user_type.id, organization_scope="organization", active=True)
            db.add(user)
            await db.commit()
            return str(user.id)
    finally:
        await engine.dispose()


def main() -> None:
    with TestClient(app, base_url="http://localhost") as client:
        for field in ("last_seen_at", "expires_at"):
            login = client.post("/api/v1/auth/login", json={"email": "owner-auth-check@example.test", "password": "owner changed secret"})
            assert login.status_code == 200, login.text
            token = client.cookies.get("amafh_session")
            assert token
            asyncio.run(age_session(token, field))
            assert client.get("/api/v1/auth/session").status_code == 401
        unprivileged_id = asyncio.run(create_unprivileged_user())
        assert client.post("/api/v1/auth/login", json={"email": "unprivileged-auth-check@example.test", "password": "unprivileged secret"}).status_code == 200
        assert client.post(f"/api/v1/auth/users/{unprivileged_id}/setup-link").status_code == 403
        denied = client.post("/api/v1/auth/setup-link", json={"email": "owner-auth-check@example.test"})
        assert denied.status_code == 403, (denied.status_code, denied.text)
    print("Idle and absolute expiry, and manual permission denial passed")


if __name__ == "__main__":
    main()
