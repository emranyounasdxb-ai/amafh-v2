"""Configured incentives, monthly/quarterly periods and rule dependencies."""

import asyncio
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.config import get_settings
from app.db.models import Permission, User, UserType, UserTypePermission
from app.db.session import create_engine, create_session_factory
from app.main import app
from app.security.passwords import hash_password

PASSWORD = "incentive check password"


async def seed():
    engine = create_engine(get_settings())
    try:
        async with create_session_factory(engine)() as db:
            finance_type = UserType(name=f"Incentive Type {uuid4()}", description="Isolated", active=True)
            denied_type = UserType(name=f"Incentive Denied {uuid4()}", description="Isolated", active=True)
            db.add_all([finance_type, denied_type])
            await db.flush()
            finance = User(email=f"incentive-actor-{uuid4()}@example.test", full_name="Incentive Actor",
                           password_hash=hash_password(PASSWORD), user_type_id=finance_type.id,
                           organization_scope="organization", active=True)
            denied = User(email=f"incentive-denied-{uuid4()}@example.test", full_name="Incentive Denied",
                          password_hash=hash_password(PASSWORD), user_type_id=denied_type.id,
                          organization_scope="organization", active=True)
            db.add_all([finance, denied])
            await db.flush()
            for action in ("view-incentives", "manage-incentives"):
                permission = (await db.scalars(select(Permission).where(
                    Permission.domain == "Finance", Permission.action == action))).one_or_none()
                if not permission:
                    permission = Permission(domain="Finance", action=action, description="Incentive check", enabled=True)
                    db.add(permission)
                    await db.flush()
                db.add(UserTypePermission(user_type_id=finance_type.id, permission_id=permission.id))
            await db.commit()
            return finance.email, denied.email, str(finance.id), str(denied.id)
    finally:
        await engine.dispose()


def main():
    email, denied_email, user_id, denied_id = asyncio.run(seed())
    rule = {"name": f"Sales Target {uuid4()}", "metric": "Approved Cases",
            "target_value": "12", "amount": "750", "active": True}
    with TestClient(app, base_url="http://localhost") as denied:
        assert denied.post("/api/v1/auth/login", json={"email": denied_email, "password": PASSWORD}).status_code == 200
        assert denied.get("/api/v1/finance/snapshot").status_code == 403
        assert denied.post("/api/v1/finance/incentive-rules", json=rule).status_code == 403
    with TestClient(app, base_url="http://localhost") as finance:
        assert finance.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD}).status_code == 200
        assert finance.get("/api/v1/auth/users").status_code == 200
        assert finance.get("/api/v1/finance/snapshot").status_code == 200
        created = finance.post("/api/v1/finance/incentive-rules", json=rule)
        assert created.status_code == 201, created.text
        rule_id = created.json()["id"]
        assert finance.post("/api/v1/finance/incentive-rules", json={**rule, "name": rule["name"].upper()}).status_code == 409
        assert finance.post("/api/v1/finance/incentives", json={
            "user_id": user_id, "rule_id": rule_id, "period": "2026-13",
            "achievement": "8", "status": "Draft"}).status_code == 422
        draft = {"user_id": user_id, "rule_id": rule_id, "period": "2026-09",
                 "achievement": "8", "status": "Draft"}
        monthly = finance.post("/api/v1/finance/incentives", json=draft)
        assert monthly.status_code == 201, monthly.text
        assert monthly.json()["target_value"] == "12.00"
        assert monthly.json()["amount"] == "750.00"
        assert monthly.json()["metric"] == "Approved Cases"
        assert finance.post("/api/v1/finance/incentives", json=draft).status_code == 409
        quarterly = finance.post("/api/v1/finance/incentives", json={
            **draft, "user_id": denied_id, "period": "2026-Q3", "achievement": "11", "status": "Approved"})
        assert quarterly.status_code == 201 and quarterly.json()["period"] == "2026-Q3"
        changed = finance.put("/api/v1/finance/incentives/" + monthly.json()["id"], json={
            **draft, "achievement": "10", "status": "Approved"})
        assert changed.status_code == 200 and changed.json()["status"] == "Approved"
        assert finance.put("/api/v1/finance/incentive-rules/" + rule_id, json={
            **rule, "amount": "999"}).status_code == 409
        assert finance.delete("/api/v1/finance/incentive-rules/" + rule_id).status_code == 409
        assert finance.delete("/api/v1/finance/incentives/" + monthly.json()["id"]).status_code == 204
        assert finance.delete("/api/v1/finance/incentives/" + quarterly.json()["id"]).status_code == 204
        assert finance.delete("/api/v1/finance/incentive-rules/" + rule_id).status_code == 204
        assert not any(item["id"] == rule_id for item in finance.get("/api/v1/finance/snapshot").json()["incentive_rules"])
    print(f"Incentive rules, period records, duplicate/dependency protection and manual rights passed; actor: {email}; user: {user_id}")


if __name__ == "__main__":
    main()
