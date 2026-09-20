"""Isolated Case lifecycle, assignment, manual permission and history check."""

import asyncio
from decimal import Decimal
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.config import get_settings
from app.db.models import Bank, Permission, Product, ProductVariant, User, UserType, UserTypePermission
from app.db.session import create_engine, create_session_factory
from app.main import app
from app.security.passwords import hash_password


PASSWORD = "case lifecycle password"


async def seed():
    engine = create_engine(get_settings())
    try:
        async with create_session_factory(engine)() as db:
            owner_type = UserType(name=f"Case Owner Type {uuid4()}", description="Isolated", active=True)
            coordinator_type = UserType(name=f"Case Coordinator Type {uuid4()}", description="Isolated", active=True)
            db.add_all([owner_type, coordinator_type])
            bank = Bank(name=f"Case Bank {uuid4()}", active=True)
            db.add(bank)
            await db.flush()
            product = Product(bank_id=bank.id, name="Case Product", active=True)
            db.add(product)
            await db.flush()
            variant = ProductVariant(product_id=product.id, name="Case Variant", active=True)
            db.add(variant)
            await db.flush()
            owner = User(email=f"case-owner-{uuid4()}@example.test", full_name="Case Owner", password_hash=hash_password(PASSWORD), user_type_id=owner_type.id, organization_scope="organization", active=True)
            coordinator_name = f"Case Coordinator {str(uuid4())[:8]}"
            coordinator = User(email=f"case-coordinator-{uuid4()}@example.test", full_name=coordinator_name, password_hash=hash_password(PASSWORD), user_type_id=coordinator_type.id, organization_scope="organization", active=True)
            db.add_all([owner, coordinator])
            for action in ("create", "view", "view-history", "approve", "reject", "assign-coordinator", "assign-owner", "edit", "edit-history", "delete"):
                permission = (await db.scalars(select(Permission).where(Permission.domain == "Cases", Permission.action == action))).one_or_none()
                if not permission:
                    permission = Permission(domain="Cases", action=action, description="Case check", enabled=True)
                    db.add(permission)
                    await db.flush()
                db.add(UserTypePermission(user_type_id=owner_type.id, permission_id=permission.id))
            view_permission = (await db.scalars(select(Permission).where(Permission.domain == "Cases", Permission.action == "view"))).one()
            db.add(UserTypePermission(user_type_id=coordinator_type.id, permission_id=view_permission.id))
            await db.commit()
            return owner.email, coordinator.email, coordinator_name, str(owner.id), str(coordinator.id), str(coordinator_type.id), str(bank.id), str(product.id), str(variant.id)
    finally:
        await engine.dispose()


async def grant_coordinator(type_id):
    from uuid import UUID
    engine = create_engine(get_settings())
    try:
        async with create_session_factory(engine)() as db:
            for action in ("submit-to-bank", "add-bank-file-number", "view-history"):
                permission = (await db.scalars(select(Permission).where(Permission.domain == "Cases", Permission.action == action))).one_or_none()
                if not permission:
                    permission = Permission(domain="Cases", action=action, description="Coordinator check", enabled=True)
                    db.add(permission)
                    await db.flush()
                db.add(UserTypePermission(user_type_id=UUID(type_id), permission_id=permission.id))
            await db.commit()
    finally:
        await engine.dispose()


def main():
    owner_email, coordinator_email, coordinator_name, owner_id, coordinator_id, coordinator_type_id, bank_id, product_id, variant_id = asyncio.run(seed())
    create = {"new_customer": {"type": "individual", "full_name": "Case Lifecycle Customer", "emirates_id": f"784-{str(uuid4())[:8]}"},
              "bank_id": bank_id, "product_id": product_id, "variant_id": variant_id,
              "case_owner_id": owner_id, "requested_amount": "100000"}
    with TestClient(app, base_url="http://localhost") as owner:
        assert owner.post("/api/v1/auth/login", json={"email": owner_email, "password": PASSWORD}).status_code == 200
        created = owner.post("/api/v1/applications", json=create)
        assert created.status_code == 201, created.text
        case_id = created.json()["id"]
        action_path = f"/api/v1/applications/{case_id}/actions"
        assert owner.post(action_path, json={"action": "assign-coordinator", "value": coordinator_id}).status_code == 409
        approved = owner.post(action_path, json={"action": "approve"})
        assert approved.status_code == 200, approved.text
        assert owner.post(action_path, json={"action": "approve"}).status_code == 409
        assigned = owner.post(action_path, json={"action": "assign-coordinator", "value": coordinator_id})
        assert assigned.status_code == 200, assigned.text
        assert owner.post(action_path, json={"action": "edit", "draft": {"bank_id": bank_id, "product_id": product_id, "variant_id": variant_id, "case_owner_id": owner_id, "requested_amount": "90000"}}).status_code == 409
        assert owner.delete(f"/api/v1/applications/{case_id}").status_code == 409
        detail = owner.get(f"/api/v1/applications/{case_id}")
        assert detail.status_code == 200
        assert detail.json()["coordinator_id"] == coordinator_id
        assert detail.json()["case_owner_id"] == owner_id
    with TestClient(app, base_url="http://localhost") as coordinator:
        assert coordinator.post("/api/v1/auth/login", json={"email": coordinator_email, "password": PASSWORD}).status_code == 200
        assert coordinator.post(action_path, json={"action": "submit-to-bank"}).status_code == 403
        asyncio.run(grant_coordinator(coordinator_type_id))
        assert coordinator.post(action_path, json={"action": "submit-to-bank"}).status_code == 200
        assert coordinator.post(action_path, json={"action": "add-bank-file-number", "value": "BANK-123"}).status_code == 200
        detail = coordinator.get(f"/api/v1/applications/{case_id}").json()
        assert detail["bank_file_number"] == "BANK-123" and detail["locked_at"]
        assert [event["event"] for event in detail["history"]] == ["Case Created", "SM Approved", "Case Coordinator assigned", "Submitted to Bank", "Bank File Number Added", "Case Locked"]
        assert all(event["at"] for event in detail["history"])
        assert coordinator.post(action_path, json={"action": "add-bank-file-number", "value": "BANK-456"}).status_code == 409
    with TestClient(app, base_url="http://localhost") as owner:
        assert owner.post("/api/v1/auth/login", json={"email": owner_email, "password": PASSWORD}).status_code == 200
        assert owner.post(action_path, json={"action": "edit", "draft": {"bank_id": bank_id, "product_id": product_id, "variant_id": variant_id, "case_owner_id": owner_id, "requested_amount": "90000"}}).status_code == 409
        assert owner.post(action_path, json={"action": "edit-history", "value": "Post-lock follow-up note"}).status_code == 200
        locked = owner.get(f"/api/v1/applications/{case_id}").json()
        assert locked["locked_at"] and Decimal(str(locked["requested_amount"])) == Decimal("100000")
        assert locked["history"][-1]["event"] == "Case history updated"
    print("Case creation, SM review, coordinator assignment plus permission, bank submission, file number, lock and chronology passed")
    print(f"Isolated browser owner: {owner_email}; coordinator: {coordinator_email}; name: {coordinator_name}")


if __name__ == "__main__":
    main()
