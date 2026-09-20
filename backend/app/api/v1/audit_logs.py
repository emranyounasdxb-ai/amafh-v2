"""Read-only access to immutable audit records."""

from fastapi import APIRouter
from sqlalchemy import select

from app.api.v1.auth import Current, DB
from app.db.models import AuditLog
from app.security.authorization import require_permission

router = APIRouter(prefix="/audit-logs", tags=["audit log"])


@router.get("")
async def list_audit_logs(current: Current, db: DB) -> list[dict]:
    await require_permission(db, current.user, "Audit Log", "view")
    rows = (await db.scalars(select(AuditLog).order_by(AuditLog.at.desc(), AuditLog.id.desc()).limit(500))).all()
    return [{"id": str(item.id), "actor_id": str(item.actor_id) if item.actor_id else None,
             "action": item.action, "entity": item.entity, "entity_id": item.entity_id,
             "before": item.before, "after": item.after, "metadata": item.metadata_json,
             "at": item.at.isoformat()} for item in rows]
