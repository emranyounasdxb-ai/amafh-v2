"""Isolated Product Stage configuration, dependency and SLA snapshot checks."""

import asyncio
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.config import get_settings
from app.db.models import Bank, Case, CaseHistory, Customer, Permission, Product, ProductVariant, User, UserType, UserTypePermission
from app.db.session import create_engine, create_session_factory
from app.main import app
from app.security.passwords import hash_password


PASSWORD = "stage tracking password"


async def seed():
    engine = create_engine(get_settings())
    try:
        async with create_session_factory(engine)() as db:
            manager_type = UserType(name=f"Stage Manager {uuid4()}", description="Isolated", active=True)
            coordinator_type = UserType(name=f"Stage Coordinator {uuid4()}", description="Isolated", active=True)
            denied_type = UserType(name=f"Stage Denied {uuid4()}", description="Isolated", active=True)
            bank = Bank(name=f"Stage Bank {uuid4()}", active=True)
            db.add_all([manager_type, coordinator_type, denied_type, bank])
            await db.flush()
            product = Product(bank_id=bank.id, name="Stage Product A", active=True)
            other_product = Product(bank_id=bank.id, name="Stage Product B", active=True)
            db.add_all([product, other_product])
            await db.flush()
            variant = ProductVariant(product_id=product.id, name="Stage Variant", active=True)
            customer = Customer(kind="individual", full_name="Stage Customer", mobile="", email="", active=True)
            db.add_all([variant, customer])
            await db.flush()
            manager = User(email=f"stage-manager-{uuid4()}@example.test", full_name="Stage Manager", password_hash=hash_password(PASSWORD), user_type_id=manager_type.id, organization_scope="organization", active=True)
            coordinator = User(email=f"stage-coordinator-{uuid4()}@example.test", full_name="Stage Coordinator", password_hash=hash_password(PASSWORD), user_type_id=coordinator_type.id, organization_scope="organization", active=True)
            denied = User(email=f"stage-denied-{uuid4()}@example.test", full_name="Stage Denied", password_hash=hash_password(PASSWORD), user_type_id=denied_type.id, organization_scope="organization", active=True)
            db.add_all([manager, coordinator, denied])
            await db.flush()
            now = datetime.now(timezone.utc)
            case = Case(case_number=f"CASE-{str(uuid4())[:8].upper()}", customer_id=customer.id,
                        case_owner_id=manager.id, bank_id=bank.id, product_id=product.id,
                        variant_id=variant.id, requested_amount=Decimal("100000"), status="SM Approved",
                        coordinator_id=coordinator.id, submitted_at=now, bank_file_number="STAGE-BANK-FILE", locked_at=now)
            db.add(case)
            await db.flush()
            db.add(CaseHistory(case_id=case.id, event="Case Created", actor_id=manager.id, detail=""))
            for action in ("view", "add-stage", "edit-stage", "delete-stage", "reorder-stage", "activate-stage", "set-stage-duration"):
                permission = (await db.scalars(select(Permission).where(Permission.domain == "Cases", Permission.action == action))).one_or_none()
                if not permission:
                    permission = Permission(domain="Cases", action=action, description="Stage check", enabled=True)
                    db.add(permission)
                    await db.flush()
                db.add(UserTypePermission(user_type_id=manager_type.id, permission_id=permission.id))
            for action in ("view", "view-history", "update-stage"):
                permission = (await db.scalars(select(Permission).where(Permission.domain == "Cases", Permission.action == action))).one_or_none()
                if not permission:
                    permission = Permission(domain="Cases", action=action, description="Stage check", enabled=True)
                    db.add(permission)
                    await db.flush()
                db.add(UserTypePermission(user_type_id=coordinator_type.id, permission_id=permission.id))
            await db.commit()
            return manager.email, coordinator.email, denied.email, str(product.id), str(other_product.id), str(case.id)
    finally:
        await engine.dispose()


def draft(name, hours="24", active=True):
    return {"name": name, "expected_duration_hours": hours, "active": active}


def main():
    manager_email, coordinator_email, denied_email, product_id, other_product_id, case_id = asyncio.run(seed())
    stages_path = f"/api/v1/products/{product_id}/stages"
    with TestClient(app, base_url="http://localhost") as manager:
        assert manager.post("/api/v1/auth/login", json={"email": manager_email, "password": PASSWORD}).status_code == 200
        first = manager.post(stages_path, json=draft("Stage One", "24.5"))
        second = manager.post(stages_path, json=draft("Stage Two", "12"))
        third = manager.post(stages_path, json=draft("Unused Stage", "6"))
        assert first.status_code == second.status_code == third.status_code == 201, (first.text, second.text, third.text)
        first_id, second_id, third_id = first.json()["id"], second.json()["id"], third.json()["id"]
        assert manager.post(stages_path, json=draft("stage one", "10")).status_code == 409
        assert manager.post(f"/api/v1/products/{other_product_id}/stages", json=draft("Stage One", "2")).status_code == 201
        moved = manager.post(f"/api/v1/stages/{third_id}/move", json={"direction": -1})
        assert moved.status_code == 200, moved.text
        assert [item["id"] for item in moved.json()] == [first_id, third_id, second_id]
        renamed = manager.put(f"/api/v1/stages/{third_id}", json=draft("Renamed Unused", "6", False))
        assert renamed.status_code == 200 and renamed.json()["active"] is False
        assert manager.delete(f"/api/v1/stages/{third_id}").status_code == 204
        assert [item["sequence"] for item in manager.get(stages_path).json()] == [1, 2]
    with TestClient(app, base_url="http://localhost") as denied:
        assert denied.post("/api/v1/auth/login", json={"email": denied_email, "password": PASSWORD}).status_code == 200
        assert denied.post(stages_path, json=draft("Blocked", "5")).status_code == 403
        assert denied.post(f"/api/v1/applications/{case_id}/actions", json={"action": "update-stage", "value": first_id}).status_code == 403
    with TestClient(app, base_url="http://localhost") as coordinator:
        assert coordinator.post("/api/v1/auth/login", json={"email": coordinator_email, "password": PASSWORD}).status_code == 200
        assert coordinator.post(f"/api/v1/applications/{case_id}/actions", json={"action": "update-stage", "value": first_id}).status_code == 200
        detail = coordinator.get(f"/api/v1/applications/{case_id}").json()
        assert detail["current_stage_id"] == first_id and Decimal(str(detail["stage_expected_duration_hours"])) == Decimal("24.5")
        started = datetime.fromisoformat(detail["stage_started_at"])
        due = datetime.fromisoformat(detail["stage_due_at"])
        assert due - started == timedelta(hours=24, minutes=30)
        stage_events = [event for event in detail["history"] if event["stage_id"] == first_id]
        assert len(stage_events) == 1 and Decimal(stage_events[0]["expected_duration_hours"]) == Decimal("24.5")
    with TestClient(app, base_url="http://localhost") as manager:
        assert manager.post("/api/v1/auth/login", json={"email": manager_email, "password": PASSWORD}).status_code == 200
        assert manager.delete(f"/api/v1/stages/{first_id}").status_code == 409
        assert manager.put(f"/api/v1/stages/{first_id}", json=draft("Changed Stage", "24.5")).status_code == 409
        assert manager.put(f"/api/v1/stages/{first_id}", json=draft("Stage One", "24.5", False)).status_code == 409
        assert manager.post(f"/api/v1/stages/{first_id}/move", json={"direction": 1}).status_code == 409
        changed = manager.put(f"/api/v1/stages/{first_id}", json=draft("Stage One", "48"))
        assert changed.status_code == 200, changed.text
        assert Decimal(str(changed.json()["expected_duration_hours"])) == Decimal("48")
    with TestClient(app, base_url="http://localhost") as coordinator:
        assert coordinator.post("/api/v1/auth/login", json={"email": coordinator_email, "password": PASSWORD}).status_code == 200
        before = coordinator.get(f"/api/v1/applications/{case_id}").json()
        assert Decimal(str(before["stage_expected_duration_hours"])) == Decimal("24.5")
        assert coordinator.post(f"/api/v1/applications/{case_id}/actions", json={"action": "update-stage", "value": second_id}).status_code == 200
        after = coordinator.get(f"/api/v1/applications/{case_id}").json()
        assert after["current_stage_id"] == second_id and Decimal(str(after["stage_expected_duration_hours"])) == Decimal("12")
        assert any(event["stage_id"] == first_id and Decimal(event["expected_duration_hours"]) == Decimal("24.5") for event in after["history"])
    print("Per-product CRUD, sequence, used-stage protection, manual rights, timestamp, due, duration snapshot and history passed")
    print(f"Isolated stage manager: {manager_email}; coordinator: {coordinator_email}; product: {product_id}; Case: {case_id}")


if __name__ == "__main__":
    main()
