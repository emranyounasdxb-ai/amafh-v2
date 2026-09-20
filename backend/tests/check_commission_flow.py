"""Configured rule precedence, Case eligibility, owner attribution and lifecycle."""

import asyncio
from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.config import get_settings
from app.db.models import AuditLog, Bank, Case, CaseHistory, Customer, Permission, Product, ProductStage, ProductVariant, User, UserType, UserTypePermission
from app.db.session import create_engine, create_session_factory
from app.main import app
from app.security.passwords import hash_password

PASSWORD = "commission check password"


async def seed():
    engine = create_engine(get_settings())
    try:
        async with create_session_factory(engine)() as db:
            finance_type = UserType(name=f"Finance Type {uuid4()}", description="Isolated", active=True)
            owner_type = UserType(name=f"Owner Type {uuid4()}", description="Isolated", active=True)
            bank = Bank(name=f"Finance Bank {uuid4()}", active=True)
            db.add_all([finance_type, owner_type, bank])
            await db.flush()
            product = Product(bank_id=bank.id, name="Finance Product", active=True)
            db.add(product)
            await db.flush()
            variant = ProductVariant(product_id=product.id, name="Finance Variant", active=True)
            stage = ProductStage(product_id=product.id, name="Final Outcome", sequence=1,
                                 expected_duration_hours=Decimal("24"), active=True)
            customer = Customer(kind="individual", full_name="Finance Customer", mobile="", email="", active=True)
            db.add_all([variant, stage, customer])
            await db.flush()
            finance = User(email=f"finance-actor-{uuid4()}@example.test", full_name="Finance Actor",
                           password_hash=hash_password(PASSWORD), user_type_id=finance_type.id,
                           organization_scope="organization", active=True)
            owner = User(email=f"finance-owner-{uuid4()}@example.test", full_name="Case Owner",
                         password_hash=hash_password(PASSWORD), user_type_id=owner_type.id,
                         organization_scope="organization", active=True)
            db.add_all([finance, owner])
            await db.flush()
            now = datetime.now(timezone.utc)
            case = Case(case_number=f"CASE-{str(uuid4())[:8].upper()}", customer_id=customer.id,
                        case_owner_id=owner.id, bank_id=bank.id, product_id=product.id,
                        variant_id=variant.id, requested_amount=Decimal("10000.00"),
                        status="SM Approved", current_stage_id=stage.id,
                        coordinator_id=finance.id, submitted_at=now,
                        bank_file_number="FIN-001", locked_at=now)
            pending = Case(case_number=f"CASE-{str(uuid4())[:8].upper()}", customer_id=customer.id,
                           case_owner_id=owner.id, bank_id=bank.id, product_id=product.id,
                           variant_id=variant.id, requested_amount=Decimal("5000.00"),
                           status="Pending SM Approval")
            db.add_all([case, pending])
            await db.flush()
            db.add(CaseHistory(case_id=case.id, event="Final Outcome", actor_id=finance.id,
                               detail="", stage_id=stage.id, stage_name=stage.name,
                               expected_duration_hours=stage.expected_duration_hours))
            for action in ("view-commission", "manage-rules", "review-commission",
                           "approve-commission", "mark-paid", "manage-clawback"):
                permission = (await db.scalars(select(Permission).where(
                    Permission.domain == "Finance", Permission.action == action))).one_or_none()
                if not permission:
                    permission = Permission(domain="Finance", action=action, description="Finance check", enabled=True)
                    db.add(permission)
                    await db.flush()
                db.add(UserTypePermission(user_type_id=finance_type.id, permission_id=permission.id))
            await db.commit()
            return finance.email, owner.email, str(owner.id), str(bank.id), str(product.id), str(variant.id), str(case.id), str(pending.id)
    finally:
        await engine.dispose()


def main():
    finance_email, owner_email, owner_id, bank_id, product_id, variant_id, case_id, pending_id = asyncio.run(seed())
    today = datetime.now(timezone.utc).date().isoformat()
    base = {"bank_id": bank_id, "product_id": None, "variant_id": None,
            "method": "Fixed Amount", "value": "250.00",
            "effective_from": today, "effective_until": None, "active": True}
    with TestClient(app, base_url="http://localhost") as denied:
        assert denied.post("/api/v1/auth/login", json={"email": owner_email, "password": PASSWORD}).status_code == 200
        assert denied.get("/api/v1/finance/snapshot").status_code == 403
        assert denied.post("/api/v1/finance/rules", json=base).status_code == 403
    with TestClient(app, base_url="http://localhost") as finance:
        assert finance.post("/api/v1/auth/login", json={"email": finance_email, "password": PASSWORD}).status_code == 200
        assert finance.get("/api/v1/auth/users").status_code == 200
        assert finance.get("/api/v1/catalogue").status_code == 200
        assert finance.get("/api/v1/applications").status_code == 200
        assert finance.post("/api/v1/finance/commissions/calculate", params={"case_id": pending_id}).status_code == 409
        bank_rule = finance.post("/api/v1/finance/rules", json=base)
        assert bank_rule.status_code == 201, bank_rule.text
        assert finance.post("/api/v1/finance/rules", json=base).status_code == 409
        variant_rule = finance.post("/api/v1/finance/rules", json={
            **base, "product_id": product_id, "variant_id": variant_id,
            "method": "Percentage", "value": "10"})
        assert variant_rule.status_code == 201, variant_rule.text
        calculated = finance.post("/api/v1/finance/commissions/calculate", params={"case_id": case_id})
        assert calculated.status_code == 201, calculated.text
        record = calculated.json()
        assert record["case_owner_id"] == owner_id
        assert record["rule_id"] == variant_rule.json()["id"]
        assert Decimal(record["amount"]) == Decimal("1000.00")
        assert Decimal(record["basis"]) == Decimal("10000.00")
        assert finance.post("/api/v1/finance/commissions/calculate", params={"case_id": case_id}).status_code == 409
        assert finance.put("/api/v1/finance/rules/" + variant_rule.json()["id"], json={
            **base, "product_id": product_id, "variant_id": variant_id,
            "method": "Percentage", "value": "12"}).status_code == 409
        assert finance.delete("/api/v1/finance/rules/" + variant_rule.json()["id"]).status_code == 409
        path = "/api/v1/finance/commissions/" + record["id"] + "/advance"
        assert finance.post(path, json={"status": "Approved"}).status_code == 409
        assert finance.post(path, json={"status": "Pending"}).json()["status"] == "Pending"
        assert finance.post(path, json={"status": "Approved"}).json()["status"] == "Approved"
        assert finance.post(path, json={"status": "Paid"}).json()["status"] == "Paid"
        assert finance.post("/api/v1/finance/clawbacks", json={
            "commission_id": record["id"], "amount": "1001.00", "reason": "Bank reversal"}).status_code == 422
        clawback = finance.post("/api/v1/finance/clawbacks", json={
            "commission_id": record["id"], "amount": "250.00", "reason": "Bank reversal"})
        assert clawback.status_code == 201, clawback.text
        assert clawback.json()["original_amount"] == "1000.00"
        assert clawback.json()["status"] == "Open"
        assert finance.post("/api/v1/finance/clawbacks", json={
            "commission_id": record["id"], "amount": "751.00", "reason": "Second reversal"}).status_code == 422
        resolved = finance.post("/api/v1/finance/clawbacks/" + clawback.json()["id"] + "/resolve")
        assert resolved.status_code == 200 and resolved.json()["status"] == "Resolved"
        assert finance.post("/api/v1/finance/clawbacks/" + clawback.json()["id"] + "/resolve").status_code == 409
        assert any(item["id"] == clawback.json()["id"] for item in finance.get("/api/v1/finance/snapshot").json()["clawbacks"])
        assert finance.delete("/api/v1/finance/rules/" + bank_rule.json()["id"]).status_code == 204
        assert any(item["case_id"] == case_id for item in finance.get("/api/v1/finance/snapshot").json()["commissions"])
    assert asyncio.run(clawback_audit_count(clawback.json()["id"])) == 2
    print(f"Commission rule scope, calculation, owner attribution, lifecycle and permission passed; finance: {finance_email}; Case: {case_id}")


async def clawback_audit_count(clawback_id: str) -> int:
    engine = create_engine(get_settings())
    try:
        async with create_session_factory(engine)() as db:
            rows = (await db.scalars(select(AuditLog).where(
                AuditLog.entity == "clawback", AuditLog.entity_id == clawback_id))).all()
            return len(rows)
    finally:
        await engine.dispose()


if __name__ == "__main__":
    main()
