"""Case event, SLA reminders, inbox ownership and manual notification rights."""

import asyncio
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID, uuid4

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.config import get_settings
from app.db.models import Bank, Case, CaseHistory, Customer, Permission, Product, ProductStage, ProductVariant, User, UserType, UserTypePermission
from app.db.session import create_engine, create_session_factory
from app.main import app
from app.security.passwords import hash_password

PASSWORD = "notification check password"


async def seed():
    engine = create_engine(get_settings())
    try:
        async with create_session_factory(engine)() as db:
            user_type = UserType(name=f"Notification Type {uuid4()}", description="Isolated", active=True)
            denied_type = UserType(name=f"Notification Denied {uuid4()}", description="Isolated", active=True)
            bank = Bank(name=f"Notification Bank {uuid4()}", active=True)
            db.add_all([user_type, denied_type, bank])
            await db.flush()
            product = Product(bank_id=bank.id, name="Notification Product", active=True)
            db.add(product)
            await db.flush()
            variant = ProductVariant(product_id=product.id, name="Notification Variant", active=True)
            stage = ProductStage(product_id=product.id, name="Notification Stage", sequence=1,
                                 expected_duration_hours=Decimal("1"), active=True)
            customer = Customer(kind="individual", full_name="Notification Customer", mobile="", email="", active=True)
            db.add_all([variant, stage, customer])
            await db.flush()
            actor = User(email=f"notify-actor-{uuid4()}@example.test", full_name="Notification Actor",
                         password_hash=hash_password(PASSWORD), user_type_id=user_type.id,
                         organization_scope="organization", active=True)
            denied = User(email=f"notify-denied-{uuid4()}@example.test", full_name="Notification Denied",
                          password_hash=hash_password(PASSWORD), user_type_id=denied_type.id,
                          organization_scope="organization", active=True)
            db.add_all([actor, denied])
            await db.flush()
            now = datetime.now(timezone.utc)
            case = Case(case_number=f"CASE-{str(uuid4())[:8].upper()}", customer_id=customer.id,
                        case_owner_id=actor.id, bank_id=bank.id, product_id=product.id,
                        variant_id=variant.id, requested_amount=Decimal("10000"), status="SM Approved",
                        coordinator_id=actor.id, submitted_at=now,
                        bank_file_number="NOTIFY-001", locked_at=now)
            db.add(case)
            await db.flush()
            db.add(CaseHistory(case_id=case.id, event="Case Created", actor_id=actor.id, detail=""))
            for domain, action in (("Cases", "view"), ("Cases", "view-history"), ("Cases", "update-stage"),
                                   ("Notifications", "view"), ("Notifications", "manage"),
                                   ("Notifications", "view-communication-history")):
                permission = (await db.scalars(select(Permission).where(Permission.domain == domain, Permission.action == action))).one_or_none()
                if not permission:
                    permission = Permission(domain=domain, action=action, description="Notification check", enabled=True)
                    db.add(permission)
                    await db.flush()
                db.add(UserTypePermission(user_type_id=user_type.id, permission_id=permission.id))
            await db.commit()
            return actor.email, denied.email, str(case.id), str(stage.id)
    finally:
        await engine.dispose()


async def change_due(case_id: str, offset_minutes: int):
    engine = create_engine(get_settings())
    try:
        async with create_session_factory(engine)() as db:
            case = await db.get(Case, UUID(case_id))
            case.stage_started_at = datetime.now(timezone.utc) - timedelta(minutes=50)
            case.stage_due_at = datetime.now(timezone.utc) + timedelta(minutes=offset_minutes)
            await db.commit()
    finally:
        await engine.dispose()


def main():
    email, denied_email, case_id, stage_id = asyncio.run(seed())
    with TestClient(app, base_url="http://localhost") as denied:
        assert denied.post("/api/v1/auth/login", json={"email": denied_email, "password": PASSWORD}).status_code == 200
        assert denied.get("/api/v1/notifications").status_code == 403
        assert denied.post("/api/v1/notifications/read-all").status_code == 403
    with TestClient(app, base_url="http://localhost") as actor:
        assert actor.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD}).status_code == 200
        before = actor.get(f"/api/v1/applications/{case_id}").json()["history"]
        assert actor.post(f"/api/v1/applications/{case_id}/actions", json={"action": "update-stage", "value": stage_id}).status_code == 200
        after = actor.get(f"/api/v1/applications/{case_id}").json()["history"]
        assert after[0] == before[0] and len(after) == len(before) + 1
        inbox = actor.get("/api/v1/notifications").json()
        assert len(inbox) == 1 and inbox[0]["category"] == "case-stage"
        assert len(actor.get(f"/api/v1/notifications/case/{case_id}").json()) == 1
        notification_id = inbox[0]["id"]
        assert actor.post(f"/api/v1/notifications/{notification_id}/read").json()["readAt"]
        assert actor.get("/api/v1/notifications").json()[0]["readAt"]
        asyncio.run(change_due(case_id, 10))
        due_soon = actor.get("/api/v1/notifications").json()
        assert sum(item["category"] == "case-due-soon" for item in due_soon) == 1
        asyncio.run(change_due(case_id, -2))
        one = actor.get("/api/v1/notifications").json()
        assert sum(item["category"] == "case-overdue" for item in one) == 1
        two = actor.get("/api/v1/notifications").json()
        assert sum(item["category"] == "case-overdue" for item in two) == 1
        assert actor.post("/api/v1/notifications/read-all").status_code == 200
        assert all(item["readAt"] for item in actor.get("/api/v1/notifications").json())
        changed = actor.post("/api/v1/auth/change-password", json={"current_password": PASSWORD, "new_password": "new notification password 2026!"})
        assert changed.status_code == 200, changed.text
        assert any(item["category"] == "system" for item in actor.get("/api/v1/notifications").json())
        assert actor.post(f"/api/v1/notifications/{notification_id}/archive").status_code == 200
        assert not any(item["id"] == notification_id for item in actor.get("/api/v1/notifications").json())
    print(f"Notification event, history isolation, overdue idempotence, read/archive and permission passed; actor: {email}; Case: {case_id}")


if __name__ == "__main__":
    main()
