"""Persisted Task operations, reference validation and notification checks."""

import asyncio
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.config import get_settings
from app.db.models import Bank, Case, Customer, Permission, Product, ProductVariant, User, UserType, UserTypePermission
from app.db.session import create_engine, create_session_factory
from app.main import app
from app.security.passwords import hash_password

PASSWORD = "task flow password"


async def seed():
    engine = create_engine(get_settings())
    try:
        async with create_session_factory(engine)() as db:
            manager_type = UserType(name=f"Task Manager {uuid4()}", description="Isolated", active=True)
            assignee_type = UserType(name=f"Task Assignee {uuid4()}", description="Isolated", active=True)
            bank = Bank(name=f"Task Bank {uuid4()}", active=True)
            db.add_all([manager_type, assignee_type, bank])
            await db.flush()
            product = Product(bank_id=bank.id, name="Task Product", active=True)
            db.add(product)
            await db.flush()
            variant = ProductVariant(product_id=product.id, name="Task Variant", active=True)
            customer = Customer(kind="individual", full_name="Task Customer", mobile="", email="", active=True)
            db.add_all([variant, customer])
            await db.flush()
            manager = User(email=f"task-manager-{uuid4()}@example.test", full_name="Task Manager",
                           password_hash=hash_password(PASSWORD), user_type_id=manager_type.id,
                           organization_scope="organization", active=True)
            assignee = User(email=f"task-assignee-{uuid4()}@example.test", full_name="Task Assignee",
                            password_hash=hash_password(PASSWORD), user_type_id=assignee_type.id,
                            organization_scope="organization", active=True)
            db.add_all([manager, assignee])
            await db.flush()
            case = Case(case_number=f"CASE-{str(uuid4())[:8].upper()}", customer_id=customer.id,
                        case_owner_id=manager.id, bank_id=bank.id, product_id=product.id,
                        variant_id=variant.id, requested_amount=Decimal("10000"),
                        status="Pending SM Approval")
            db.add(case)
            await db.flush()
            for domain, action in (("Tasks", "view"), ("Tasks", "create"), ("Tasks", "edit"),
                                   ("Tasks", "assign"), ("Tasks", "complete"), ("Tasks", "cancel"),
                                   ("Tasks", "delete"), ("Notifications", "view"),
                                   ("Notifications", "manage"), ("Customers", "view"), ("Cases", "view")):
                permission = (await db.scalars(select(Permission).where(Permission.domain == domain, Permission.action == action))).one_or_none()
                if not permission:
                    permission = Permission(domain=domain, action=action, description="Task check", enabled=True)
                    db.add(permission)
                    await db.flush()
                db.add(UserTypePermission(user_type_id=manager_type.id, permission_id=permission.id))
            view_permission = (await db.scalars(select(Permission).where(Permission.domain == "Tasks", Permission.action == "view"))).one()
            db.add(UserTypePermission(user_type_id=assignee_type.id, permission_id=view_permission.id))
            await db.commit()
            return manager.email, assignee.email, str(manager.id), str(assignee.id), str(customer.id), str(case.id)
    finally:
        await engine.dispose()


def main():
    manager_email, assignee_email, manager_id, assignee_id, customer_id, case_id = asyncio.run(seed())
    due = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    draft = {"title": "Call customer", "description": "Task note", "customer_id": customer_id,
             "case_id": case_id, "assigned_to_id": assignee_id,
             "priority": "High", "due_at": due}
    with TestClient(app, base_url="http://localhost") as assignee:
        assert assignee.post("/api/v1/auth/login", json={"email": assignee_email, "password": PASSWORD}).status_code == 200
        assert assignee.post("/api/v1/tasks", json=draft).status_code == 403
    with TestClient(app, base_url="http://localhost") as manager:
        assert manager.post("/api/v1/auth/login", json={"email": manager_email, "password": PASSWORD}).status_code == 200
        assert manager.post("/api/v1/tasks", json={**draft, "customer_id": str(uuid4())}).status_code == 422
        created = manager.post("/api/v1/tasks", json=draft)
        assert created.status_code == 201, created.text
        task_id = created.json()["id"]
        assert created.json()["status"] == "Open"
        assert created.json()["created_by_id"] == manager_id
        assert len(manager.get("/api/v1/tasks").json()) == 1
        changed = manager.put(f"/api/v1/tasks/{task_id}", json={**draft, "assigned_to_id": manager_id, "title": "Follow up"})
        assert changed.status_code == 200 and changed.json()["assigned_to_id"] == manager_id
        note = manager.post(f"/api/v1/tasks/{task_id}/notes", json={"text": "Called customer"})
        assert note.status_code == 201 and len(note.json()["notes"]) == 1
        assert manager.post(f"/api/v1/tasks/{task_id}/status", json={"status": "In Progress"}).status_code == 200
        completed = manager.post(f"/api/v1/tasks/{task_id}/status", json={"status": "Completed"})
        assert completed.status_code == 200 and completed.json()["completed_at"]
        assert manager.post(f"/api/v1/tasks/{task_id}/status", json={"status": "Cancelled"}).status_code == 409
        assert manager.put(f"/api/v1/tasks/{task_id}", json=draft).status_code == 409
        assert manager.delete(f"/api/v1/tasks/{task_id}").status_code == 204
        assert manager.get(f"/api/v1/tasks/{task_id}").status_code == 404
        due_task = manager.post("/api/v1/tasks", json={**draft, "assigned_to_id": manager_id,
                                                        "due_at": (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()})
        assert due_task.status_code == 201
        inbox = manager.get("/api/v1/notifications").json()
        assert any(item["category"] == "task-assigned" for item in inbox)
        assert any(item["category"] == "task-due-soon" for item in inbox)
        assert sum(item["category"] == "task-due-soon" for item in manager.get("/api/v1/notifications").json()) == 1
    print(f"Task CRUD, assignment, notes, status, due reminder and permission passed; manager: {manager_email}; assignee: {assignee_email}")


if __name__ == "__main__":
    main()
