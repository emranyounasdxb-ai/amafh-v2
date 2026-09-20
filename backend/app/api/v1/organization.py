"""Existing organization hierarchy, persisted with parent and dependency checks."""

from datetime import datetime, timezone
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.api.v1.auth import Current, DB
from app.db.models import OrganizationUnit, User
from app.security.authorization import require_permission

router = APIRouter(prefix="/organization", tags=["organization"])
Kind = Literal["organizations", "offices", "departments", "teams", "business-units"]
PARENTS = {"organizations": None, "offices": "organizations", "departments": "offices", "teams": "departments", "business-units": "departments"}


class UnitInput(BaseModel):
    kind: Kind
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(min_length=1, max_length=500)
    active: bool
    parent_id: UUID | None = None


class UnitView(UnitInput):
    id: UUID
    created_at: datetime
    updated_at: datetime


def view(unit: OrganizationUnit) -> UnitView:
    return UnitView(id=unit.id, kind=unit.kind, name=unit.name, description=unit.description,
                    active=unit.active, parent_id=unit.parent_id,
                    created_at=unit.created_at, updated_at=unit.updated_at)


async def validate_parent(payload: UnitInput, db: DB) -> None:
    expected = PARENTS[payload.kind]
    if expected is None:
        if payload.parent_id is not None:
            raise HTTPException(status_code=422, detail="Organizations cannot have a parent")
        return
    if payload.parent_id is None:
        raise HTTPException(status_code=422, detail="A parent is required")
    parent = await db.get(OrganizationUnit, payload.parent_id)
    if not parent or parent.kind != expected:
        raise HTTPException(status_code=422, detail="Invalid organization parent")


@router.get("", response_model=list[UnitView])
async def list_units(current: Current, db: DB) -> list[UnitView]:
    await require_permission(db, current.user, "Organization", "view")
    units = (await db.scalars(select(OrganizationUnit).order_by(OrganizationUnit.created_at, OrganizationUnit.name))).all()
    return [view(unit) for unit in units]


@router.post("", response_model=UnitView, status_code=201)
async def create_unit(payload: UnitInput, current: Current, db: DB) -> UnitView:
    await require_permission(db, current.user, "Organization", "edit")
    await validate_parent(payload, db)
    name = " ".join(payload.name.split())
    description = payload.description.strip()
    if not name or not description:
        raise HTTPException(status_code=422, detail="Name and description are required")
    unit = OrganizationUnit(kind=payload.kind, parent_id=payload.parent_id,
                            name=name, description=description, active=payload.active)
    db.add(unit)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail="A sibling with this name already exists") from exc
    await db.refresh(unit)
    return view(unit)


@router.put("/{unit_id}", response_model=UnitView)
async def update_unit(unit_id: UUID, payload: UnitInput, current: Current, db: DB) -> UnitView:
    await require_permission(db, current.user, "Organization", "edit")
    unit = await db.get(OrganizationUnit, unit_id)
    if not unit:
        raise HTTPException(status_code=404, detail="Organization record not found")
    if payload.kind != unit.kind:
        raise HTTPException(status_code=422, detail="Structure type cannot change")
    await validate_parent(payload, db)
    name = " ".join(payload.name.split())
    description = payload.description.strip()
    if not name or not description:
        raise HTTPException(status_code=422, detail="Name and description are required")
    unit.name = name
    unit.description = description
    unit.parent_id = payload.parent_id
    unit.active = payload.active
    unit.updated_at = datetime.now(timezone.utc)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail="A sibling with this name already exists") from exc
    await db.refresh(unit)
    return view(unit)


@router.delete("/{unit_id}", status_code=204)
async def delete_unit(unit_id: UUID, current: Current, db: DB) -> None:
    await require_permission(db, current.user, "Organization", "edit")
    unit = await db.get(OrganizationUnit, unit_id)
    if not unit:
        raise HTTPException(status_code=404, detail="Organization record not found")
    child_count = await db.scalar(select(func.count()).select_from(OrganizationUnit).where(OrganizationUnit.parent_id == unit_id))
    user_count = await db.scalar(select(func.count()).select_from(User).where(
        (User.organization_id == unit_id) | (User.office_id == unit_id) |
        (User.department_id == unit_id) | (User.team_id == unit_id)))
    if child_count or user_count:
        raise HTTPException(status_code=409, detail="Related organization or user records prevent deletion")
    await db.delete(unit)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Related records prevent deletion") from exc
