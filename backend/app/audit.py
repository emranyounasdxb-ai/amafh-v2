"""Transactional audit capture for sensitive ORM changes."""

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import event, inspect
from sqlalchemy.orm import Session

from app.db.models import AuditLog

TRACKED = {
    "User", "UserType", "Permission", "UserTypePermission", "OrganizationUnit",
    "Bank", "Product", "ProductVariant", "ProductStage", "Customer", "CustomerHistory",
    "Case", "CaseHistory", "CaseApproval", "CoordinatorAssignment", "Task", "TaskNote",
    "ProfileMedia", "CsvImport", "AttendanceImportRow", "CommissionRule", "CommissionRecord",
    "Clawback", "IncentiveRule", "IncentiveRecord", "Session", "PasswordSetupLink",
}
PRIVATE_FIELDS = {"password_hash", "token_hash", "emirates_id", "passport_number", "trade_license", "email", "mobile"}


def safe(value):
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, (UUID, date, datetime, Decimal)):
        return str(value)
    return str(value)


@event.listens_for(Session, "before_flush")
def collect_changes(session: Session, _flush_context, _instances) -> None:
    pending = session.info.setdefault("audit_pending", [])
    actor = session.info.get("audit_actor_id")
    for collection, operation in ((session.new, "create"), (session.dirty, "update"), (session.deleted, "delete")):
        for obj in collection:
            entity = type(obj).__name__
            if entity not in TRACKED:
                continue
            state = inspect(obj)
            changed = {}
            before = {}
            for attribute in state.mapper.column_attrs:
                key = attribute.key
                if key in PRIVATE_FIELDS:
                    continue
                history = state.attrs[key].history
                if operation == "update" and not history.has_changes():
                    continue
                changed[key] = safe(getattr(obj, key, None))
                if history.deleted:
                    before[key] = safe(history.deleted[0])
            if operation == "update" and not changed:
                continue
            if entity == "Session":
                if operation == "update" and "revoked_at" not in changed:
                    continue
                action = "login" if operation == "create" else "logout"
            elif entity == "PasswordSetupLink":
                action = "password_setup." + ("create" if operation == "create" else "consume")
            elif entity == "User" and operation == "update" and state.attrs.password_hash.history.has_changes():
                action = "password.update"
            else:
                action = entity.lower() + "." + operation
            pending.append((obj, action, entity, (changed if operation == "delete" else before) if operation != "create" else None,
                            changed if operation != "delete" else None, actor))


@event.listens_for(Session, "after_flush_postexec")
def write_changes(session: Session, _flush_context) -> None:
    pending = session.info.pop("audit_pending", [])
    for obj, action, entity, before, after, actor in pending:
        identity = getattr(obj, "id", None)
        session.add(AuditLog(actor_id=actor, action=action, entity=entity,
                             entity_id=str(identity) if identity is not None else None,
                             before=before, after=after, metadata_json={}))
