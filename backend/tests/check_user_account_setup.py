"""Isolated database check: owner provision -> link -> recipient activation."""

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


OWNER_PASSWORD = "account setup owner password"
NEW_PASSWORD = "recipient chosen password"


async def seed():
    engine = create_engine(get_settings())
    try:
        async with create_session_factory(engine)() as db:
            owner_type = UserType(name=f"Provision Owner {uuid4()}", description="Test", active=True)
            recipient_type = UserType(name=f"Provision Recipient {uuid4()}", description="Test", active=True)
            create_permission = Permission(domain=f"Provision Test {uuid4()}", action="create", description="Test", enabled=True)
            users_create = (await db.scalars(select(Permission).where(Permission.domain == "Users", Permission.action == "create"))).one_or_none()
            db.add_all([owner_type, recipient_type, create_permission])
            await db.flush()
            if not users_create:
                users_create = Permission(domain="Users", action="create", description="Create users", enabled=True)
                db.add(users_create)
                await db.flush()
            owner = User(email=f"provision-owner-{uuid4()}@example.test", full_name="Provision Owner", password_hash=hash_password(OWNER_PASSWORD), user_type_id=owner_type.id, organization_scope="organization", active=True)
            denied = User(email=f"provision-denied-{uuid4()}@example.test", full_name="Denied User", password_hash=hash_password(OWNER_PASSWORD), user_type_id=recipient_type.id, organization_scope="organization", active=True)
            db.add_all([owner, denied, UserTypePermission(user_type_id=owner_type.id, permission_id=users_create.id)])
            await db.commit()
            return owner.email, denied.email, str(recipient_type.id)
    finally:
        await engine.dispose()


def main():
    owner_email, denied_email, recipient_type = asyncio.run(seed())
    new_email = f"provision-recipient-{uuid4()}@example.test"
    payload = {"full_name": "Provision Recipient", "email": new_email, "user_type_id": recipient_type}
    with TestClient(app, base_url="http://localhost") as owner:
        assert owner.post("/api/v1/auth/login", json={"email": owner_email, "password": OWNER_PASSWORD}).status_code == 200
        assert {"domain": "Users", "action": "create"} in owner.get("/api/v1/auth/permissions").json()["permissions"]
        created = owner.post("/api/v1/auth/users", json=payload)
        assert created.status_code == 201, created.text
        assert owner.post("/api/v1/auth/users", json=payload).status_code == 409
        token = parse_qs(urlsplit(created.json()["setup_url"]).query)["token"][0]
        with TestClient(app, base_url="http://localhost") as recipient:
            assert recipient.post("/api/v1/auth/login", json={"email": new_email, "password": NEW_PASSWORD}).status_code == 401
            assert recipient.post("/api/v1/auth/setup-password", json={"token": token, "password": NEW_PASSWORD}).status_code == 200
            assert recipient.post("/api/v1/auth/setup-password", json={"token": token, "password": NEW_PASSWORD}).status_code == 400
            assert recipient.post("/api/v1/auth/login", json={"email": new_email, "password": NEW_PASSWORD}).status_code == 200
        with TestClient(app, base_url="http://localhost") as denied:
            assert denied.post("/api/v1/auth/login", json={"email": denied_email, "password": OWNER_PASSWORD}).status_code == 200
            assert denied.get("/api/v1/auth/permissions").json()["permissions"] == []
            assert denied.post("/api/v1/auth/users", json={**payload, "email": f"blocked-{uuid4()}@example.test"}).status_code == 403
    print("Owner provision, inactive login denial, recipient setup, activation, duplicate denial and permission denial passed")
    print(f"Isolated browser fixture owner: {owner_email}")


if __name__ == "__main__":
    main()
