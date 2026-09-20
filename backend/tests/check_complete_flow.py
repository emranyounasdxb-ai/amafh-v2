"""One Case through Customer, approval, lock, stages, Commission and Report."""

import asyncio
from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID, uuid4

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.config import get_settings
from app.db.models import Permission, ProductStage, User, UserTypePermission
from app.db.session import create_engine, create_session_factory
from app.main import app
from check_case_lifecycle import PASSWORD, seed


async def configure(owner_id: str, coordinator_type_id: str, product_id: str):
    engine = create_engine(get_settings())
    try:
        async with create_session_factory(engine)() as db:
            owner = await db.get(User, UUID(owner_id))
            stages = [ProductStage(product_id=UUID(product_id), name=name, sequence=index,
                                   expected_duration_hours=Decimal("24"), active=True)
                      for index, name in enumerate(("In Progress", "Final Outcome"), 1)]
            db.add_all(stages)
            await db.flush()
            for type_id, domain, action in (
                (UUID(coordinator_type_id), "Cases", "view-history"),
                (UUID(coordinator_type_id), "Cases", "submit-to-bank"),
                (UUID(coordinator_type_id), "Cases", "add-bank-file-number"),
                (UUID(coordinator_type_id), "Cases", "update-stage"),
                (owner.user_type_id, "Finance", "view-commission"),
                (owner.user_type_id, "Finance", "manage-rules"),
                (owner.user_type_id, "Finance", "review-commission"),
                (owner.user_type_id, "Reports", "view"),
                (owner.user_type_id, "Reports", "view-financial"),
            ):
                permission = (await db.scalars(select(Permission).where(
                    Permission.domain == domain, Permission.action == action))).one_or_none()
                if not permission:
                    permission = Permission(domain=domain, action=action, description="Complete flow", enabled=True)
                    db.add(permission)
                    await db.flush()
                db.add(UserTypePermission(user_type_id=type_id, permission_id=permission.id))
            await db.commit()
            return [str(stage.id) for stage in stages]
    finally:
        await engine.dispose()


def main():
    owner_email, coordinator_email, _, owner_id, coordinator_id, coordinator_type_id, bank_id, product_id, variant_id = asyncio.run(seed())
    stages = asyncio.run(configure(owner_id, coordinator_type_id, product_id))
    with TestClient(app, base_url="http://localhost") as owner:
        assert owner.post("/api/v1/auth/login", json={"email": owner_email, "password": PASSWORD}).status_code == 200
        created = owner.post("/api/v1/applications", json={
            "new_customer": {"type": "individual", "full_name": "Complete Flow Customer", "emirates_id": f"784-{uuid4()}"},
            "bank_id": bank_id, "product_id": product_id, "variant_id": variant_id,
            "case_owner_id": owner_id, "requested_amount": "10000"})
        assert created.status_code == 201, created.text
        case_id = created.json()["id"]
        path = f"/api/v1/applications/{case_id}/actions"
        assert owner.post(path, json={"action": "approve"}).status_code == 200
        assert owner.post(path, json={"action": "assign-coordinator", "value": coordinator_id}).status_code == 200
    with TestClient(app, base_url="http://localhost") as coordinator:
        assert coordinator.post("/api/v1/auth/login", json={"email": coordinator_email, "password": PASSWORD}).status_code == 200
        assert coordinator.post(path, json={"action": "submit-to-bank"}).status_code == 200
        assert coordinator.post(path, json={"action": "add-bank-file-number", "value": "COMPLETE-001"}).status_code == 200
        assert coordinator.post(path, json={"action": "update-stage", "value": stages[0]}).status_code == 200
        assert coordinator.post(path, json={"action": "update-stage", "value": stages[1]}).status_code == 200
        detail = coordinator.get(f"/api/v1/applications/{case_id}")
        assert detail.status_code == 200, detail.text
        assert detail.json()["locked_at"] and detail.json()["stage_name"] == "Final Outcome"
        assert detail.json()["stage_started_at"]
        events = [item["event"] for item in detail.json()["history"]]
        assert events.index("Case Locked") < events.index("Final Outcome")
    with TestClient(app, base_url="http://localhost") as owner:
        assert owner.post("/api/v1/auth/login", json={"email": owner_email, "password": PASSWORD}).status_code == 200
        today = datetime.now(timezone.utc).date().isoformat()
        rule = owner.post("/api/v1/finance/rules", json={"bank_id": bank_id,
            "product_id": None, "variant_id": None, "method": "Fixed Amount", "value": "100",
            "effective_from": today, "effective_until": None, "active": True})
        assert rule.status_code == 201, rule.text
        commission = owner.post("/api/v1/finance/commissions/calculate", params={"case_id": case_id})
        assert commission.status_code == 201, commission.text
        assert commission.json()["case_owner_id"] == owner_id
        assert Decimal(commission.json()["amount"]) == Decimal("100")
        report = owner.get("/api/v1/reports/snapshot")
        assert report.status_code == 200, report.text
        assert any(item["id"] == case_id and item["stage"] == "Final Outcome" for item in report.json()["cases"])
        assert any(item["case_id"] == case_id and Decimal(item["amount"]) == Decimal("100")
                   for item in report.json()["finance"]["commissions"])
    print("Complete Customer → Case → approval → lock → stages → Final Outcome → Commission → Report flow passed")


if __name__ == "__main__":
    main()
