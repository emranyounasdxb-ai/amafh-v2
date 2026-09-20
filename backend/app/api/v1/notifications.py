"""Internal notification inbox, independent of immutable Case History."""

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, HTTPException
from sqlalchemy import select, update

from app.api.v1.auth import Current, DB
from app.db.models import Case, Notification, Task
from app.security.authorization import require_permission

router = APIRouter(prefix="/notifications", tags=["internal notifications"])


def view(item: Notification) -> dict:
    return {"id": str(item.id), "recipientId": str(item.recipient_id),
            "category": item.category, "message": item.message,
            "relatedType": "case" if item.related_case_id else "task" if item.related_task_id else "system",
            "relatedId": str(item.related_case_id or item.related_task_id or ""),
            "at": item.at.isoformat(), "readAt": item.read_at.isoformat() if item.read_at else "",
            "archivedAt": item.archived_at.isoformat() if item.archived_at else "",
            "actorId": str(item.actor_id) if item.actor_id else ""}


async def add_notification(db: DB, recipient_id: UUID, category: str, message: str,
                           actor_id: UUID | None = None, case_id: UUID | None = None,
                           task_id: UUID | None = None) -> None:
    db.add(Notification(recipient_id=recipient_id, actor_id=actor_id,
                        category=category, message=message,
                        related_case_id=case_id, related_task_id=task_id))


async def sync_stage_reminders(db: DB, recipient_id: UUID) -> None:
    now = datetime.now(timezone.utc)
    cases = (await db.scalars(select(Case).where(
        Case.coordinator_id == recipient_id, Case.stage_due_at.is_not(None),
        Case.stage_started_at.is_not(None), Case.stage_expected_duration_hours.is_not(None)
    ))).all()
    for case in cases:
        duration = (case.stage_due_at - case.stage_started_at).total_seconds()
        remaining = (case.stage_due_at - now).total_seconds()
        if remaining > duration / 4:
            continue
        category = "case-overdue" if remaining < 0 else "case-due-soon"
        message = f"{case.case_number}: stage started {case.stage_started_at.isoformat()} is {'overdue' if remaining < 0 else 'due soon'}."
        exists = (await db.scalars(select(Notification.id).where(
            Notification.recipient_id == recipient_id, Notification.related_case_id == case.id,
            Notification.category == category, Notification.message == message
        ))).first()
        if not exists:
            await add_notification(db, recipient_id, category, message, case_id=case.id)
    tasks = (await db.scalars(select(Task).where(
        Task.assigned_to_id == recipient_id,
        Task.status.in_(("Open", "In Progress"))
    ))).all()
    for task in tasks:
        remaining = (task.due_at - now).total_seconds()
        if remaining > 24 * 60 * 60:
            continue
        category = "task-overdue" if remaining < 0 else "task-due-soon"
        message = f"{task.title}: due {task.due_at.isoformat()} is {'overdue' if remaining < 0 else 'due soon'}."
        exists = (await db.scalars(select(Notification.id).where(
            Notification.recipient_id == recipient_id, Notification.related_task_id == task.id,
            Notification.category == category, Notification.message == message
        ))).first()
        if not exists:
            await add_notification(db, recipient_id, category, message, task_id=task.id)
    await db.commit()


@router.get("")
async def inbox(current: Current, db: DB) -> list[dict]:
    await require_permission(db, current.user, "Notifications", "view")
    await sync_stage_reminders(db, current.user.id)
    rows = (await db.scalars(select(Notification).where(
        Notification.recipient_id == current.user.id, Notification.archived_at.is_(None)
    ).order_by(Notification.at.desc(), Notification.id.desc()))).all()
    return [view(item) for item in rows]


@router.get("/case/{case_id}")
async def case_communications(case_id: UUID, current: Current, db: DB) -> list[dict]:
    await require_permission(db, current.user, "Notifications", "view-communication-history")
    rows = (await db.scalars(select(Notification).where(Notification.related_case_id == case_id)
                             .order_by(Notification.at, Notification.id))).all()
    return [view(item) for item in rows]


@router.post("/read-all")
async def mark_all_read(current: Current, db: DB) -> dict[str, str]:
    await require_permission(db, current.user, "Notifications", "manage")
    await db.execute(update(Notification).where(
        Notification.recipient_id == current.user.id, Notification.read_at.is_(None),
        Notification.archived_at.is_(None)).values(read_at=datetime.now(timezone.utc)))
    await db.commit()
    return {"status": "read"}


@router.post("/{notification_id}/read")
async def mark_read(notification_id: UUID, current: Current, db: DB) -> dict:
    await require_permission(db, current.user, "Notifications", "manage")
    item = (await db.scalars(select(Notification).where(
        Notification.id == notification_id, Notification.recipient_id == current.user.id
    ).with_for_update())).one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Notification not found for this user")
    if not item.read_at:
        item.read_at = datetime.now(timezone.utc)
        await db.commit()
    return view(item)


@router.post("/{notification_id}/archive")
async def archive(notification_id: UUID, current: Current, db: DB) -> dict[str, str]:
    await require_permission(db, current.user, "Notifications", "manage")
    item = (await db.scalars(select(Notification).where(
        Notification.id == notification_id, Notification.recipient_id == current.user.id
    ).with_for_update())).one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Notification not found for this user")
    item.archived_at = datetime.now(timezone.utc)
    await db.commit()
    return {"status": "archived"}
