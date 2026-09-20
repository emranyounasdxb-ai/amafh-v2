"""Isolated real database/API check for the existing organization hierarchy."""

import asyncio
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.config import get_settings
from app.db.models import Permission, User, UserType, UserTypePermission
from app.db.session import create_engine, create_session_factory
from app.main import app
from app.security.passwords import hash_password


PASSWORD = "organization test password"


async def seed():
    engine = create_engine(get_settings())
    try:
        async with create_session_factory(engine)() as db:
            kind = UserType(name=f"Organization Test {uuid4()}", description="Isolated", active=True)
            denied_kind = UserType(name=f"Organization Denied {uuid4()}", description="Isolated", active=True)
            db.add_all([kind, denied_kind])
            await db.flush()
            grants = []
            for domain, action in (("Organization", "view"), ("Organization", "edit"), ("Users", "create")):
                permission = (await db.scalars(select(Permission).where(Permission.domain == domain, Permission.action == action))).one_or_none()
                if not permission:
                    permission = Permission(domain=domain, action=action, description="Organization check", enabled=True)
                    db.add(permission)
                    await db.flush()
                grants.append(UserTypePermission(user_type_id=kind.id, permission_id=permission.id))
            owner = User(email=f"org-owner-{uuid4()}@example.test", full_name="Organization Owner", password_hash=hash_password(PASSWORD), user_type_id=kind.id, organization_scope="organization", active=True)
            denied = User(email=f"org-denied-{uuid4()}@example.test", full_name="Organization Denied", password_hash=hash_password(PASSWORD), user_type_id=denied_kind.id, organization_scope="organization", active=True)
            db.add_all([owner, denied, *grants])
            await db.commit()
            return owner.email, denied.email, str(owner.id), str(kind.id)
    finally:
        await engine.dispose()


def payload(kind, name, parent=None, active=True):
    return {"kind": kind, "name": name, "description": "Organization test structure", "active": active, "parent_id": parent}


async def assign_user(user_id, organization_id):
    from uuid import UUID
    engine = create_engine(get_settings())
    try:
        async with create_session_factory(engine)() as db:
            user = await db.get(User, UUID(user_id))
            user.organization_id = UUID(organization_id)
            await db.commit()
    finally:
        await engine.dispose()


def main():
    owner_email, denied_email, owner_id, type_id = asyncio.run(seed())
    prefix = f"Org {uuid4()}"
    with TestClient(app, base_url="http://localhost") as client:
        assert client.get("/api/v1/organization").status_code == 401
        assert client.post("/api/v1/auth/login", json={"email": owner_email, "password": PASSWORD}).status_code == 200
        org = client.post("/api/v1/organization", json=payload("organizations", prefix))
        assert org.status_code == 201, org.text
        org_id = org.json()["id"]
        assert client.post("/api/v1/organization", json=payload("organizations", prefix.lower())).status_code == 409
        assert client.post("/api/v1/organization", json=payload("departments", "Invalid", org_id)).status_code == 422
        office = client.post("/api/v1/organization", json=payload("offices", "Main Office", org_id))
        assert office.status_code == 201, office.text
        department = client.post("/api/v1/organization", json=payload("departments", "Department", office.json()["id"]))
        assert department.status_code == 201, department.text
        team = client.post("/api/v1/organization", json=payload("teams", "Team", department.json()["id"]))
        unit = client.post("/api/v1/organization", json=payload("business-units", "Business Unit", department.json()["id"]))
        assert team.status_code == unit.status_code == 201
        assignment = {"email": f"org-member-{uuid4()}@example.test", "full_name": "Organization Member", "user_type_id": type_id,
                      "organization_id": org_id, "office_id": office.json()["id"], "department_id": department.json()["id"],
                      "team_id": team.json()["id"], "organization_scope": "team"}
        assert client.post("/api/v1/auth/users", json={**assignment, "team_id": unit.json()["id"]}).status_code == 422
        assert client.post("/api/v1/auth/users", json=assignment).status_code == 201
        assert client.delete(f"/api/v1/organization/{org_id}").status_code == 409
        assert client.put(f"/api/v1/organization/{team.json()['id']}", json=payload("teams", "Renamed Team", department.json()["id"], False)).status_code == 200
        listed = client.get("/api/v1/organization")
        assert listed.status_code == 200 and any(item["id"] == org_id for item in listed.json())
        asyncio.run(assign_user(owner_id, org_id))
        assert client.delete(f"/api/v1/organization/{team.json()['id']}").status_code == 409
        assert client.delete(f"/api/v1/organization/{unit.json()['id']}").status_code == 204
        assert client.delete(f"/api/v1/organization/{department.json()['id']}").status_code == 409
        assert client.delete(f"/api/v1/organization/{office.json()['id']}").status_code == 409
        assert client.delete(f"/api/v1/organization/{org_id}").status_code == 409
    with TestClient(app, base_url="http://localhost") as denied:
        assert denied.post("/api/v1/auth/login", json={"email": denied_email, "password": PASSWORD}).status_code == 200
        assert denied.get("/api/v1/organization").status_code == 403
        assert denied.post("/api/v1/organization", json=payload("organizations", f"Denied {uuid4()}")).status_code == 403
    print("Hierarchy CRUD, duplicates, invalid parents, dependency protection and direct API permission denial passed")
    print(f"Isolated browser fixture owner: {owner_email}")


if __name__ == "__main__":
    main()
