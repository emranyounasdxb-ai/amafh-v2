"""Isolated API/database check of customer creation only through applications."""

import asyncio
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.config import get_settings
from app.db.models import Bank, Permission, Product, ProductVariant, User, UserType, UserTypePermission
from app.db.session import create_engine, create_session_factory
from app.main import app
from app.security.passwords import hash_password


PASSWORD = "customer check password"


async def seed():
    engine = create_engine(get_settings())
    try:
        async with create_session_factory(engine)() as db:
            kind = UserType(name=f"Customer Test {uuid4()}", description="Isolated", active=True)
            denied_kind = UserType(name=f"Customer Denied {uuid4()}", description="Isolated", active=True)
            bank = Bank(name=f"Customer Bank {uuid4()}", active=True)
            db.add_all([kind, denied_kind, bank])
            await db.flush()
            product = Product(bank_id=bank.id, name="Customer Test Product", active=True)
            db.add(product)
            await db.flush()
            variant = ProductVariant(product_id=product.id, name="Customer Test Variant", active=True)
            db.add(variant)
            await db.flush()
            owner = User(email=f"customer-owner-{uuid4()}@example.test", full_name="Customer Owner", password_hash=hash_password(PASSWORD), user_type_id=kind.id, organization_scope="organization", active=True)
            denied = User(email=f"customer-denied-{uuid4()}@example.test", full_name="Customer Denied", password_hash=hash_password(PASSWORD), user_type_id=denied_kind.id, organization_scope="organization", active=True)
            db.add_all([owner, denied])
            for domain, action in (("Cases", "create"), ("Cases", "view"), ("Customers", "view"), ("Customers", "edit"), ("Customers", "delete")):
                permission = (await db.scalars(select(Permission).where(Permission.domain == domain, Permission.action == action))).one_or_none()
                if not permission:
                    permission = Permission(domain=domain, action=action, description="Customer check", enabled=True)
                    db.add(permission)
                    await db.flush()
                db.add(UserTypePermission(user_type_id=kind.id, permission_id=permission.id))
            await db.commit()
            return owner.email, denied.email, str(owner.id), str(bank.id), str(product.id), str(variant.id)
    finally:
        await engine.dispose()


def individual(identity, passport, name="Same Name"):
    return {"type": "individual", "emirates_id": identity, "passport_number": passport,
            "full_name": name, "employer": "", "mobile": "0500000000", "email": ""}


def company(license_id, name="Same Company Name"):
    return {"type": "company", "trade_license": license_id, "company_name": name,
            "contact_person": "Contact", "mobile": "", "email": ""}


def main():
    owner_email, denied_email, owner_id, bank_id, product_id, variant_id = asyncio.run(seed())
    ids = {"bank_id": bank_id, "product_id": product_id, "variant_id": variant_id,
           "case_owner_id": owner_id, "requested_amount": "50000"}
    identity = f"784-{str(uuid4())[:8]}"
    passport = f"P-{str(uuid4())[:8]}"
    with TestClient(app, base_url="http://localhost") as client:
        assert client.post("/api/v1/customers", json=individual(identity, passport)).status_code == 405
        assert client.post("/api/v1/auth/login", json={"email": owner_email, "password": PASSWORD}).status_code == 200
        first = client.post("/api/v1/applications", json={**ids, "new_customer": individual(identity, passport)})
        assert first.status_code == 201, first.text
        customer_id = first.json()["customer_id"]
        assert client.post("/api/v1/applications", json={**ids, "new_customer": individual(identity.replace("-", ""), passport)}).status_code == 409
        second = client.post("/api/v1/applications", json={**ids, "customer_id": customer_id})
        assert second.status_code == 201 and second.json()["customer_id"] == customer_id
        assert len([case for case in client.get("/api/v1/applications").json() if case["customer_id"] == customer_id]) == 2
        update = client.put(f"/api/v1/customers/{customer_id}", json={"customer": individual(identity, passport, "Updated Name"), "active": True})
        assert update.status_code == 200, update.text
        assert update.json()["full_name"] == "Updated Name"
        assert len(update.json()["history"]) == 4
        assert client.delete(f"/api/v1/customers/{customer_id}").status_code == 409
        other = client.post("/api/v1/applications", json={**ids, "new_customer": individual(f"784-{str(uuid4())[:8]}", f"P-{str(uuid4())[:8]}")})
        assert other.status_code == 201, other.text
        assert client.put(f"/api/v1/customers/{other.json()['customer_id']}", json={"customer": individual(identity, f"P-{str(uuid4())[:8]}"), "active": True}).status_code == 409
        license_id = f"TL-{str(uuid4())[:8]}"
        company_case = client.post("/api/v1/applications", json={**ids, "new_customer": company(license_id)})
        assert company_case.status_code == 201, company_case.text
        assert client.post("/api/v1/applications", json={**ids, "new_customer": company(license_id.lower())}).status_code == 409
        duplicate_name = client.post("/api/v1/applications", json={**ids, "new_customer": company(f"TL-{str(uuid4())[:8]}")})
        assert duplicate_name.status_code == 201, duplicate_name.text
    with TestClient(app, base_url="http://localhost") as denied:
        assert denied.post("/api/v1/auth/login", json={"email": denied_email, "password": PASSWORD}).status_code == 200
        assert denied.get("/api/v1/customers").status_code == 403
        assert denied.post("/api/v1/applications", json={**ids, "customer_id": customer_id}).status_code == 403
    print("Create-through-Application, exact identity, repeat Cases, own edit, company license, history and permission checks passed")
    print(f"Isolated browser fixture owner: {owner_email}")


if __name__ == "__main__":
    main()
