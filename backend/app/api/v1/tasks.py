"""Persisted tasks, assignment, state transitions and notes."""

from datetime import datetime, timezone
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.api.v1.auth import Current, DB
from app.api.v1.notifications import add_notification
from app.db.models import Case, Customer, Notification, Task, TaskNote, User
from app.security.authorization import require_permission

router = APIRouter(prefix="/tasks", tags=["tasks"])
Priority = Literal["Low", "Medium", "High", "Urgent"]
Status = Literal["Open", "In Progress", "Completed", "Cancelled"]


class TaskInput(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    description: str = Field(max_length=1000)
    customer_id: UUID | None = None
    case_id: UUID | None = None
    assigned_to_id: UUID
    priority: Priority
    due_at: datetime


class StatusInput(BaseModel):
    status: Status


class NoteInput(BaseModel):
    text: str = Field(min_length=1, max_length=1000)


async def task_view(task: Task, db: DB) -> dict:
    notes = (await db.scalars(select(TaskNote).where(TaskNote.task_id == task.id)
                              .order_by(TaskNote.at, TaskNote.id))).all()
    return {"id": str(task.id), "title": task.title, "description": task.description,
            "customer_id": str(task.customer_id) if task.customer_id else None,
            "case_id": str(task.case_id) if task.case_id else None,
            "assigned_to_id": str(task.assigned_to_id),
            "created_by_id": str(task.created_by_id), "priority": task.priority,
            "status": task.status, "due_at": task.due_at.isoformat(),
            "created_at": task.created_at.isoformat(), "updated_at": task.updated_at.isoformat(),
            "completed_at": task.completed_at.isoformat() if task.completed_at else None,
            "notes": [{"id": str(note.id), "text": note.text, "actor_id": str(note.actor_id),
                       "at": note.at.isoformat()} for note in notes]}


async def validate_input(payload: TaskInput, db: DB) -> None:
    if not payload.title.strip() or not payload.due_at.tzinfo:
        raise HTTPException(status_code=422, detail="Title and timezone-aware Due Date/Time are required")
    assigned = await db.get(User, payload.assigned_to_id)
    if not assigned or not assigned.active:
        raise HTTPException(status_code=422, detail="Assign an active existing User")
    if payload.customer_id and not await db.get(Customer, payload.customer_id):
        raise HTTPException(status_code=422, detail="Related Customer was not found")
    if payload.case_id:
        case = await db.get(Case, payload.case_id)
        if not case:
            raise HTTPException(status_code=422, detail="Related Case was not found")
        if payload.customer_id and case.customer_id != payload.customer_id:
            raise HTTPException(status_code=422, detail="Related Case belongs to another Customer")


@router.get("")
async def list_tasks(current: Current, db: DB) -> list[dict]:
    await require_permission(db, current.user, "Tasks", "view")
    rows = (await db.scalars(select(Task).order_by(Task.created_at.desc(), Task.id.desc()))).all()
    return [await task_view(item, db) for item in rows]


@router.get("/{task_id}")
async def detail(task_id: UUID, current: Current, db: DB) -> dict:
    await require_permission(db, current.user, "Tasks", "view")
    item = await db.get(Task, task_id)
    if not item:
        raise HTTPException(status_code=404, detail="Task was not found")
    return await task_view(item, db)


@router.post("", status_code=201)
async def create(payload: TaskInput, current: Current, db: DB) -> dict:
    await require_permission(db, current.user, "Tasks", "create")
    await validate_input(payload, db)
    task = Task(title=payload.title.strip(), description=payload.description.strip(),
                customer_id=payload.customer_id, case_id=payload.case_id,
                assigned_to_id=payload.assigned_to_id, created_by_id=current.user.id,
                priority=payload.priority, status="Open", due_at=payload.due_at)
    db.add(task)
    await db.flush()
    await add_notification(db, task.assigned_to_id, "task-assigned",
                           f"Task assigned: {task.title}", current.user.id, task_id=task.id)
    await db.commit()
    await db.refresh(task)
    return await task_view(task, db)


@router.put("/{task_id}")
async def edit(task_id: UUID, payload: TaskInput, current: Current, db: DB) -> dict:
    task = (await db.scalars(select(Task).where(Task.id == task_id).with_for_update())).one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task was not found")
    if task.status in ("Completed", "Cancelled"):
        raise HTTPException(status_code=409, detail="Completed or cancelled Tasks cannot be edited")
    if payload.assigned_to_id != task.assigned_to_id:
        await require_permission(db, current.user, "Tasks", "assign")
    changed_details = (payload.title.strip() != task.title or payload.description.strip() != task.description
                       or payload.customer_id != task.customer_id or payload.case_id != task.case_id
                       or payload.priority != task.priority or payload.due_at != task.due_at)
    if changed_details:
        await require_permission(db, current.user, "Tasks", "edit")
    await validate_input(payload, db)
    reassigned = payload.assigned_to_id != task.assigned_to_id
    task.title, task.description = payload.title.strip(), payload.description.strip()
    task.customer_id, task.case_id = payload.customer_id, payload.case_id
    task.assigned_to_id, task.priority, task.due_at = payload.assigned_to_id, payload.priority, payload.due_at
    task.updated_at = datetime.now(timezone.utc)
    if reassigned:
        await add_notification(db, task.assigned_to_id, "task-assigned",
                               f"Task assigned: {task.title}", current.user.id, task_id=task.id)
    await db.commit()
    return await task_view(task, db)


@router.post("/{task_id}/status")
async def set_status(task_id: UUID, payload: StatusInput, current: Current, db: DB) -> dict:
    action = "complete" if payload.status == "Completed" else "cancel" if payload.status == "Cancelled" else "edit"
    await require_permission(db, current.user, "Tasks", action)
    task = (await db.scalars(select(Task).where(Task.id == task_id).with_for_update())).one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task was not found")
    if task.status in ("Completed", "Cancelled") or payload.status == "Open" or payload.status == "In Progress" and task.status != "Open":
        raise HTTPException(status_code=409, detail="Invalid Task status transition")
    task.status = payload.status
    task.updated_at = datetime.now(timezone.utc)
    if payload.status == "Completed":
        task.completed_at = task.updated_at
    await db.commit()
    return await task_view(task, db)


@router.post("/{task_id}/notes", status_code=201)
async def add_note(task_id: UUID, payload: NoteInput, current: Current, db: DB) -> dict:
    await require_permission(db, current.user, "Tasks", "edit")
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task was not found")
    if not payload.text.strip():
        raise HTTPException(status_code=422, detail="Enter a Note")
    db.add(TaskNote(task_id=task_id, actor_id=current.user.id, text=payload.text.strip()))
    task.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return await task_view(task, db)


@router.delete("/{task_id}", status_code=204)
async def remove(task_id: UUID, current: Current, db: DB) -> None:
    await require_permission(db, current.user, "Tasks", "delete")
    task = (await db.scalars(select(Task).where(Task.id == task_id).with_for_update())).one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task was not found")
    for note in (await db.scalars(select(TaskNote).where(TaskNote.task_id == task_id))).all():
        await db.delete(note)
    for notification in (await db.scalars(select(Notification).where(Notification.related_task_id == task_id))).all():
        await db.delete(notification)
    await db.delete(task)
    await db.commit()
