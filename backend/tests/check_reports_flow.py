"""Read-only reporting permission, database snapshot and export gate."""

import asyncio
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.config import get_settings
from app.db.models import Bank, Case, Customer, Permission, Product, ProductStage, ProductVariant, User, UserType, UserTypePermission
from app.db.session import create_engine, create_session_factory
from app.main import app
from app.security.passwords import hash_password

PASSWORD = "report check password"


async def seed():
    engine = create_engine(get_settings())
    try:
        async with create_session_factory(engine)() as db:
            user_type = UserType(name=f"Report Type {uuid4()}", description="Isolated", active=True)
            db.add(user_type)
            await db.flush()
            user = User(email=f"report-actor-{uuid4()}@example.test", full_name="Report Actor",
                        password_hash=hash_password(PASSWORD), user_type_id=user_type.id,
                        organization_scope="organization", active=True)
            db.add(user)
            await db.flush()
            for action in ("view", "export", "view-performance", "view-financial"):
                permission = (await db.scalars(select(Permission).where(
                    Permission.domain == "Reports", Permission.action == action))).one_or_none()
                if not permission:
                    permission = Permission(domain="Reports", action=action, description="Report check", enabled=True)
                    db.add(permission)
                    await db.flush()
                db.add(UserTypePermission(user_type_id=user_type.id, permission_id=permission.id))
            for index in range(2):
                bank = Bank(name=f"Report Bank {index} {uuid4()}", active=True)
                db.add(bank)
                await db.flush()
                product = Product(bank_id=bank.id, name=f"Report Product {index}", active=True)
                db.add(product)
                await db.flush()
                variant = ProductVariant(product_id=product.id, name=f"Report Variant {index}", active=True)
                customer = Customer(kind="individual", full_name=f"Report Customer {index}", mobile="", email="", active=True)
                stage = ProductStage(product_id=product.id, name="In Review", sequence=1,
                                     expected_duration_hours=Decimal("24"), active=True)
                db.add_all([variant, customer, stage])
                await db.flush()
                now = datetime.now(timezone.utc)
                db.add(Case(case_number=f"REPORT-{uuid4().hex[:12]}", customer_id=customer.id,
                            case_owner_id=user.id, bank_id=bank.id, product_id=product.id,
                            variant_id=variant.id, requested_amount=Decimal("1000"),
                            status="SM Approved" if index == 0 else "Pending SM Approval",
                            current_stage_id=stage.id if index == 0 else None,
                            stage_started_at=now - timedelta(hours=48) if index == 0 else None,
                            stage_expected_duration_hours=Decimal("24") if index == 0 else None,
                            stage_due_at=now - timedelta(hours=24) if index == 0 else None,
                            submitted_at=now - timedelta(hours=48) if index == 0 else None))
            count = len((await db.scalars(select(Case))).all())
            await db.commit()
            return user.email, count
    finally:
        await engine.dispose()


def main():
    email, count = asyncio.run(seed())
    with TestClient(app, base_url="http://localhost") as client:
        assert client.get("/api/v1/reports/snapshot").status_code == 401
        assert client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD}).status_code == 200
        response = client.get("/api/v1/reports/snapshot")
        assert response.status_code == 200, response.text
        data = response.json()
        assert len(data["cases"]) == count
        assert data["finance"] is not None
        assert isinstance(data["tasks"], list)
        assert client.get("/api/v1/reports/export-check").status_code == 200
    print(f"Database-backed Reports snapshot and export gate passed; actor: {email}")


if __name__ == "__main__":
    main()
