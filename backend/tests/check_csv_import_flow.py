"""Three isolated import paths and permission, preview, history invariants."""

import asyncio
from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.config import get_settings
from app.db.models import Bank, Case, CaseHistory, Customer, OrganizationUnit, Permission, Product, ProductStage, ProductVariant, User, UserType, UserTypePermission
from app.db.session import create_engine, create_session_factory
from app.main import app
from app.security.passwords import hash_password

PASSWORD = "csv import password"


async def seed():
    engine = create_engine(get_settings())
    try:
        async with create_session_factory(engine)() as db:
            user_type = UserType(name=f"CSV Type {uuid4()}", description="Isolated", active=True)
            denied_type = UserType(name=f"CSV Denied {uuid4()}", description="Isolated", active=True)
            org = OrganizationUnit(kind="organizations", name=f"CSV Org {uuid4()}", description="Isolated", active=True)
            bank = Bank(name=f"CSV Bank {uuid4()}", active=True)
            db.add_all([user_type, denied_type, org, bank])
            await db.flush()
            product = Product(bank_id=bank.id, name="CSV Product", active=True)
            db.add(product)
            await db.flush()
            variant = ProductVariant(product_id=product.id, name="CSV Variant", active=True)
            stage = ProductStage(product_id=product.id, name="CSV Stage", sequence=1, expected_duration_hours=Decimal("12.5"), active=True)
            customer = Customer(kind="individual", full_name="CSV Customer", mobile="", email="", active=True)
            db.add_all([variant, stage, customer])
            await db.flush()
            actor = User(email=f"csv-actor-{uuid4()}@example.test", full_name="CSV Actor", password_hash=hash_password(PASSWORD), user_type_id=user_type.id, organization_scope="organization", active=True)
            denied = User(email=f"csv-denied-{uuid4()}@example.test", full_name="CSV Denied", password_hash=hash_password(PASSWORD), user_type_id=denied_type.id, organization_scope="organization", active=True)
            db.add_all([actor, denied])
            await db.flush()
            now = datetime.now(timezone.utc)
            case = Case(case_number=f"CASE-{str(uuid4())[:8].upper()}", customer_id=customer.id,
                        case_owner_id=actor.id, bank_id=bank.id, product_id=product.id,
                        variant_id=variant.id, requested_amount=Decimal("10000"),
                        status="SM Approved", coordinator_id=actor.id, submitted_at=now,
                        bank_file_number="CSV-001", locked_at=now)
            db.add(case)
            await db.flush()
            db.add(CaseHistory(case_id=case.id, event="Case Created", actor_id=actor.id, detail=""))
            for domain, action in (("Imports", "attendance"), ("Imports", "case-stage"),
                                   ("Imports", "users"), ("Cases", "update-stage"),
                                   ("Cases", "view"), ("Cases", "view-history")):
                permission = (await db.scalars(select(Permission).where(Permission.domain == domain, Permission.action == action))).one_or_none()
                if not permission:
                    permission = Permission(domain=domain, action=action, description="CSV check", enabled=True)
                    db.add(permission)
                    await db.flush()
                db.add(UserTypePermission(user_type_id=user_type.id, permission_id=permission.id))
            await db.commit()
            return actor.email, denied.email, str(case.id), case.case_number, org.name, user_type.name
    finally:
        await engine.dispose()


def main():
    actor_email, denied_email, case_id, case_number, org_name, type_name = asyncio.run(seed())
    with TestClient(app, base_url="http://localhost") as denied:
        assert denied.post("/api/v1/auth/login", json={"email": denied_email, "password": PASSWORD}).status_code == 200
        assert denied.post("/api/v1/imports/preview", json={"kind": "attendance", "csv": "userEmail,date,status\n"}).status_code == 403
    with TestClient(app, base_url="http://localhost") as client:
        assert client.post("/api/v1/auth/login", json={"email": actor_email, "password": PASSWORD}).status_code == 200
        baseline_history = len(client.get("/api/v1/imports/history").json())
        day = datetime.now(timezone.utc).date().isoformat()
        attendance = f"userEmail,date,status\n{actor_email},{day},Present\nunknown@example.test,{day},Late"
        preview = client.post("/api/v1/imports/preview", json={"kind": "attendance", "csv": attendance})
        assert preview.status_code == 201, preview.text
        assert preview.json()["valid"] == 1 and preview.json()["invalid"] == 1
        assert len(client.get("/api/v1/imports/history").json()) == baseline_history
        confirmed = client.post("/api/v1/imports/confirm", json={"preview_id": preview.json()["id"]})
        assert confirmed.status_code == 200, confirmed.text
        assert confirmed.json()["success"] == 1 and confirmed.json()["failed"] == 1
        assert client.post("/api/v1/imports/confirm", json={"preview_id": preview.json()["id"]}).status_code == 409
        duplicate = client.post("/api/v1/imports/preview", json={"kind": "attendance", "csv": attendance}).json()
        assert duplicate["valid"] == 0 and duplicate["invalid"] == 2
        users_csv = f"fullName,email,userType,organization,organizationScope,officeBranch,department,team\nImported User,imported-{uuid4()}@example.test,{type_name},{org_name},organization,,,\nBad User,bad-{uuid4()}@example.test,Missing Type,{org_name},organization,,,"
        users = client.post("/api/v1/imports/preview", json={"kind": "users", "csv": users_csv})
        assert users.status_code == 201, users.text
        assert users.json()["valid"] == 1 and users.json()["invalid"] == 1
        user_result = client.post("/api/v1/imports/confirm", json={"preview_id": users.json()["id"]})
        assert user_result.status_code == 200, user_result.text
        assert user_result.json()["success"] == 1 and user_result.json()["failed"] == 1
        assert any("/set-password?token=" in detail for detail in user_result.json()["details"])
        case_csv = f"caseNumber,stage\n{case_number},CSV Stage\nMISSING,CSV Stage"
        stage = client.post("/api/v1/imports/preview", json={"kind": "case-stage", "csv": case_csv})
        assert stage.status_code == 201, stage.text
        assert stage.json()["matchedCases"] == 1 and stage.json()["unmatchedCases"] == 1
        before = client.get(f"/api/v1/applications/{case_id}").json()["history"]
        assert len(before) == 1
        stage_result = client.post("/api/v1/imports/confirm", json={"preview_id": stage.json()["id"]})
        assert stage_result.status_code == 200, stage_result.text
        assert stage_result.json()["success"] == 1 and stage_result.json()["failed"] == 1
        after = client.get(f"/api/v1/applications/{case_id}").json()
        assert len(after["history"]) == 2
        assert after["history"][0] == before[0]
        assert after["history"][-1]["stage_name"] == "CSV Stage"
        assert after["stage_expected_duration_hours"] == "12.50"
        assert len(client.get("/api/v1/imports/history").json()) == baseline_history + 3
    print(f"CSV preview, confirm, invalid rows, permission, attendance, users, stage and history passed; actor: {actor_email}; Case: {case_id}; Organization: {org_name}; User Type: {type_name}")


if __name__ == "__main__":
    main()
