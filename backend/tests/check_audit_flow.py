"""Audit login, logout, mutation capture, read grants and database immutability."""

import asyncio
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import select, text
from sqlalchemy.exc import DBAPIError

from app.core.config import get_settings
from app.db.models import AuditLog, Permission, User, UserType, UserTypePermission
from app.db.session import create_engine, create_session_factory
from app.main import app
from app.security.passwords import hash_password

PASSWORD = "audit check password"


async def seed():
    engine = create_engine(get_settings())
    try:
        async with create_session_factory(engine)() as db:
            viewer_type = UserType(name=f"Audit Viewer {uuid4()}", description="Isolated", active=True)
            denied_type = UserType(name=f"Audit Denied {uuid4()}", description="Isolated", active=True)
            db.add_all([viewer_type, denied_type])
            await db.flush()
            viewer = User(email=f"audit-viewer-{uuid4()}@example.test", full_name="Audit Viewer",
                          password_hash=hash_password(PASSWORD), user_type_id=viewer_type.id,
                          organization_scope="organization", active=True)
            denied = User(email=f"audit-denied-{uuid4()}@example.test", full_name="Audit Denied",
                          password_hash=hash_password(PASSWORD), user_type_id=denied_type.id,
                          organization_scope="organization", active=True)
            db.add_all([viewer, denied])
            await db.flush()
            permission = (await db.scalars(select(Permission).where(
                Permission.domain == "Audit Log", Permission.action == "view"))).one_or_none()
            if not permission:
                permission = Permission(domain="Audit Log", action="view", description="Read audit", enabled=True)
                db.add(permission)
                await db.flush()
            db.add(UserTypePermission(user_type_id=viewer_type.id, permission_id=permission.id))
            await db.commit()
            return viewer.email, denied.email, str(viewer.id)
    finally:
        await engine.dispose()


async def immutable():
    engine = create_engine(get_settings())
    try:
        async with create_session_factory(engine)() as db:
            entry = (await db.scalars(select(AuditLog).order_by(AuditLog.at.desc()).limit(1))).one()
            entry_id = entry.id
            try:
                await db.execute(text("UPDATE audit_logs SET action = 'tampered' WHERE id = :id"), {"id": entry_id})
                await db.commit()
                raise AssertionError("Audit update was allowed")
            except DBAPIError:
                await db.rollback()
            try:
                await db.execute(text("DELETE FROM audit_logs WHERE id = :id"), {"id": entry_id})
                await db.commit()
                raise AssertionError("Audit deletion was allowed")
            except DBAPIError:
                await db.rollback()
    finally:
        await engine.dispose()


async def tracked_user_change(user_id: str):
    engine = create_engine(get_settings())
    try:
        async with create_session_factory(engine)() as db:
            user = (await db.scalars(select(User).where(User.id == user_id))).one()
            db.sync_session.info["audit_actor_id"] = user.id
            user.full_name = "Audit Viewer Updated"
            await db.commit()
            entry = (await db.scalars(select(AuditLog).where(
                AuditLog.action == "user.update", AuditLog.entity_id == user_id)
                .order_by(AuditLog.at.desc()).limit(1))).one()
            assert entry.actor_id == user.id
            assert entry.after["full_name"] == "Audit Viewer Updated"
            assert "password_hash" not in entry.after
    finally:
        await engine.dispose()


def main():
    viewer_email, denied_email, viewer_id = asyncio.run(seed())
    with TestClient(app, base_url="http://localhost") as denied:
        assert denied.post("/api/v1/auth/login", json={"email": denied_email, "password": PASSWORD}).status_code == 200
        assert denied.get("/api/v1/audit-logs").status_code == 403
        assert denied.delete("/api/v1/audit-logs").status_code == 405
    with TestClient(app, base_url="http://localhost") as viewer:
        assert viewer.post("/api/v1/auth/login", json={"email": viewer_email, "password": PASSWORD}).status_code == 200
        result = viewer.get("/api/v1/audit-logs")
        assert result.status_code == 200, result.text
        assert any(item["action"] == "login" and item["actor_id"] == viewer_id for item in result.json())
        assert viewer.post("/api/v1/auth/logout").status_code == 200
    asyncio.run(tracked_user_change(viewer_id))
    asyncio.run(immutable())
    print(f"Audit creation, read grant and immutable DB protection passed; actor: {viewer_email}")


if __name__ == "__main__":
    main()
