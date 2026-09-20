"""Isolated avatar/banner API, validation, replacement and authorization check."""

import asyncio
from io import BytesIO
from uuid import uuid4

from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import select

from app.core.config import get_settings
from app.db.models import Permission, User, UserType, UserTypePermission
from app.db.session import create_engine, create_session_factory
from app.main import app
from app.security.passwords import hash_password

PASSWORD = "profile media password"
def png(color: str) -> bytes:
    output = BytesIO()
    Image.new("RGB", (2, 2), color).save(output, format="PNG")
    return output.getvalue()


PNG_A = png("red")
PNG_B = png("blue")


async def seed():
    engine = create_engine(get_settings())
    try:
        async with create_session_factory(engine)() as db:
            owner_type = UserType(name=f"Profile Owner {uuid4()}", description="Isolated", active=True)
            manager_type = UserType(name=f"Profile Manager {uuid4()}", description="Isolated", active=True)
            db.add_all([owner_type, manager_type])
            await db.flush()
            first = User(email=f"profile-owner-{uuid4()}@example.test", full_name="Profile Owner", password_hash=hash_password(PASSWORD), user_type_id=owner_type.id, organization_scope="organization", active=True)
            second = User(email=f"profile-manager-{uuid4()}@example.test", full_name="Profile Manager", password_hash=hash_password(PASSWORD), user_type_id=manager_type.id, organization_scope="organization", active=True)
            denied = User(email=f"profile-denied-{uuid4()}@example.test", full_name="Profile Denied", password_hash=hash_password(PASSWORD), user_type_id=owner_type.id, organization_scope="organization", active=True)
            db.add_all([first, second, denied])
            await db.flush()
            permission = (await db.scalars(select(Permission).where(Permission.domain == "Profiles", Permission.action == "edit-other-images"))).one_or_none()
            if permission is None:
                permission = Permission(domain="Profiles", action="edit-other-images", description="Edit another user's profile images", enabled=True)
                db.add(permission)
                await db.flush()
            db.add(UserTypePermission(user_type_id=manager_type.id, permission_id=permission.id))
            await db.commit()
            return first.email, str(first.id), second.email, denied.email
    finally:
        await engine.dispose()


def main():
    owner_email, owner_id, manager_email, denied_email = asyncio.run(seed())
    root = f"/api/v1/users/{owner_id}/profile-images"
    with TestClient(app, base_url="http://localhost") as anonymous:
        assert anonymous.put(f"{root}/avatar", content=PNG_A, headers={"Content-Type": "image/png"}).status_code == 401
    with TestClient(app, base_url="http://localhost") as owner:
        assert owner.post("/api/v1/auth/login", json={"email": owner_email, "password": PASSWORD}).status_code == 200
        assert owner.put(f"{root}/avatar", content=b"%PDF", headers={"Content-Type": "application/pdf"}).status_code == 422
        assert owner.put(f"{root}/avatar", content=b"not png", headers={"Content-Type": "image/png"}).status_code == 422
        assert owner.put(f"{root}/avatar", content=b"\x89PNG\r\n\x1a\n" + b"broken", headers={"Content-Type": "image/png"}).status_code == 422
        assert owner.put(f"{root}/avatar", content=b"", headers={"Content-Type": "image/png"}).status_code == 422
        assert owner.put(f"{root}/avatar", content=PNG_A, headers={"Content-Type": "image/png"}).status_code == 200
        assert owner.get(f"{root}/avatar").content == PNG_A
        assert owner.put(f"{root}/avatar", content=PNG_B, headers={"Content-Type": "image/png"}).status_code == 200
        assert owner.get(f"{root}/avatar").content == PNG_B
        assert owner.put(f"{root}/banner", content=PNG_A, headers={"Content-Type": "image/png"}).status_code == 200
        assert set(owner.get(root).json()) == {"avatar", "banner"}
    with TestClient(app, base_url="http://localhost") as denied:
        assert denied.post("/api/v1/auth/login", json={"email": denied_email, "password": PASSWORD}).status_code == 200
        assert denied.put(f"{root}/avatar", content=PNG_A, headers={"Content-Type": "image/png"}).status_code == 403
        assert denied.delete(f"{root}/avatar").status_code == 403
    with TestClient(app, base_url="http://localhost") as manager:
        assert manager.post("/api/v1/auth/login", json={"email": manager_email, "password": PASSWORD}).status_code == 200
        assert manager.delete(f"{root}/avatar").status_code == 204
        assert manager.get(f"{root}/avatar").status_code == 404
        assert manager.put(f"{root}/avatar", content=PNG_A, headers={"Content-Type": "image/png"}).status_code == 200
    print(f"Profile media validation, own upload/replace/remove, permission boundary passed; owner: {owner_email}; manager: {manager_email}; user: {owner_id}")


if __name__ == "__main__":
    main()
