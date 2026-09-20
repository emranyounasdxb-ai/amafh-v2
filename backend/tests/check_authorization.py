"""Direct API checks for manual permission assignment and revocation."""

import asyncio
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.config import get_settings
from app.db.models import Permission, User, UserType, UserTypePermission
from app.db.session import create_engine, create_session_factory
from app.main import app
from app.security.passwords import hash_password


PASSWORD = "manual rights check password"


async def seed():
    engine = create_engine(get_settings())
    try:
        async with create_session_factory(engine)() as db:
            kind = UserType(name=f"Rights Test {uuid4()}", description="Isolated", active=True)
            permission = Permission(domain="Users", action="create", description="Isolated", enabled=True)
            existing = (await db.scalars(select(Permission).where(Permission.domain == "Users", Permission.action == "create"))).one_or_none()
            db.add(kind)
            if not existing:
                db.add(permission)
            await db.flush()
            permission = existing or permission
            user = User(email=f"rights-{uuid4()}@example.test", full_name="Rights Test", password_hash=hash_password(PASSWORD), user_type_id=kind.id, organization_scope="organization", active=True)
            db.add(user)
            await db.commit()
            return user.email, str(kind.id), str(permission.id)
    finally:
        await engine.dispose()


async def assign(type_id, permission_id):
    engine = create_engine(get_settings())
    try:
        async with create_session_factory(engine)() as db:
            from uuid import UUID
            db.add(UserTypePermission(user_type_id=UUID(type_id), permission_id=UUID(permission_id)))
            await db.commit()
    finally:
        await engine.dispose()


async def deactivate_type(type_id):
    engine = create_engine(get_settings())
    try:
        async with create_session_factory(engine)() as db:
            from uuid import UUID
            kind = await db.get(UserType, UUID(type_id))
            kind.active = False
            await db.commit()
    finally:
        await engine.dispose()


def main():
    email, type_id, permission_id = asyncio.run(seed())
    with TestClient(app, base_url="http://localhost") as client:
        assert client.post("/api/v1/auth/users", json={}).status_code == 401
        assert client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD}).status_code == 200
        assert client.get("/api/v1/auth/permissions").json()["permissions"] == []
        new_user = {"email": f"manual-{uuid4()}@example.test", "full_name": "Manual Target", "user_type_id": type_id}
        assert client.post("/api/v1/auth/users", json=new_user).status_code == 403
        asyncio.run(assign(type_id, permission_id))
        assert {"domain": "Users", "action": "create"} in client.get("/api/v1/auth/permissions").json()["permissions"]
        assert client.post("/api/v1/auth/users", json=new_user).status_code == 201
        asyncio.run(deactivate_type(type_id))
        assert client.get("/api/v1/auth/permissions").json()["permissions"] == []
        assert client.post("/api/v1/auth/users", json={**new_user, "email": f"denied-{uuid4()}@example.test"}).status_code == 403
    print("Unauthenticated, unassigned, assigned, and inactive-type direct API decisions passed")


if __name__ == "__main__":
    main()
