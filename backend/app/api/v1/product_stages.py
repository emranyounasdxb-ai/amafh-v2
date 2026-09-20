"""Per-product stage configuration with immutable used-stage identity."""

from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.api.v1.auth import Current, DB
from app.db.models import Case, CaseHistory, Product, ProductStage
from app.security.authorization import has_permission, require_permission

router = APIRouter(tags=["product stages"])


class StageInput(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    expected_duration_hours: Decimal = Field(gt=0, le=87600)
    active: bool


class StageView(StageInput):
    id: UUID
    product_id: UUID
    sequence: int
    created_at: datetime
    updated_at: datetime
    used: bool


class MoveInput(BaseModel):
    direction: int = Field(ge=-1, le=1)


def check_duration(value: Decimal) -> None:
    if value.as_tuple().exponent < -2:
        raise HTTPException(status_code=422, detail="Expected Duration supports at most two decimal places")


async def used(db: DB, stage_id: UUID) -> bool:
    current = await db.scalar(select(Case.id).where(Case.current_stage_id == stage_id).limit(1))
    if current:
        return True
    return bool(await db.scalar(select(CaseHistory.id).where(CaseHistory.stage_id == stage_id).limit(1)))


async def view(stage: ProductStage, db: DB) -> StageView:
    return StageView(id=stage.id, product_id=stage.product_id, name=stage.name,
                     expected_duration_hours=stage.expected_duration_hours,
                     active=stage.active, sequence=stage.sequence,
                     created_at=stage.created_at, updated_at=stage.updated_at,
                     used=await used(db, stage.id))


async def product_or_404(db: DB, product_id: UUID) -> Product:
    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.get("/products/{product_id}/stages", response_model=list[StageView])
async def list_stages(product_id: UUID, current: Current, db: DB) -> list[StageView]:
    if not (await has_permission(db, current.user, "Cases", "view") or await has_permission(db, current.user, "Cases", "add-stage") or await has_permission(db, current.user, "Cases", "edit-stage")):
        raise HTTPException(status_code=403, detail="Permission required")
    await product_or_404(db, product_id)
    stages = (await db.scalars(select(ProductStage).where(ProductStage.product_id == product_id).order_by(ProductStage.sequence))).all()
    return [await view(stage, db) for stage in stages]


@router.post("/products/{product_id}/stages", response_model=StageView, status_code=201)
async def create_stage(product_id: UUID, payload: StageInput, current: Current, db: DB) -> StageView:
    await require_permission(db, current.user, "Cases", "add-stage")
    check_duration(payload.expected_duration_hours)
    product = (await db.scalars(select(Product).where(Product.id == product_id).with_for_update())).one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    name = " ".join(payload.name.split())
    if not name:
        raise HTTPException(status_code=422, detail="Stage name is required")
    sequence = (await db.scalar(select(func.max(ProductStage.sequence)).where(ProductStage.product_id == product_id))) or 0
    stage = ProductStage(product_id=product_id, name=name, sequence=sequence + 1,
                         expected_duration_hours=payload.expected_duration_hours, active=payload.active)
    db.add(stage)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail="A Stage with this name already exists for this Product") from exc
    await db.refresh(stage)
    return await view(stage, db)


@router.put("/stages/{stage_id}", response_model=StageView)
async def update_stage(stage_id: UUID, payload: StageInput, current: Current, db: DB) -> StageView:
    stage = (await db.scalars(select(ProductStage).where(ProductStage.id == stage_id).with_for_update())).one_or_none()
    if not stage:
        raise HTTPException(status_code=404, detail="Product Stage not found")
    check_duration(payload.expected_duration_hours)
    name = " ".join(payload.name.split())
    if not name:
        raise HTTPException(status_code=422, detail="Stage name is required")
    name_changed = name != stage.name
    state_changed = payload.active != stage.active
    duration_changed = payload.expected_duration_hours != stage.expected_duration_hours
    if name_changed:
        await require_permission(db, current.user, "Cases", "edit-stage")
    if state_changed:
        await require_permission(db, current.user, "Cases", "activate-stage")
    if duration_changed:
        await require_permission(db, current.user, "Cases", "set-stage-duration")
    if not (name_changed or state_changed or duration_changed):
        await require_permission(db, current.user, "Cases", "edit-stage")
    if await used(db, stage.id) and (name_changed or state_changed):
        raise HTTPException(status_code=409, detail="A Case uses this Stage; only Expected Duration may change")
    stage.name, stage.active = name, payload.active
    stage.expected_duration_hours = payload.expected_duration_hours
    stage.updated_at = datetime.now(timezone.utc)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail="A Stage with this name already exists for this Product") from exc
    await db.refresh(stage)
    return await view(stage, db)


@router.post("/stages/{stage_id}/move", response_model=list[StageView])
async def move_stage(stage_id: UUID, payload: MoveInput, current: Current, db: DB) -> list[StageView]:
    await require_permission(db, current.user, "Cases", "reorder-stage")
    if payload.direction not in (-1, 1):
        raise HTTPException(status_code=422, detail="Choose move up or down")
    stage = await db.get(ProductStage, stage_id)
    if not stage:
        raise HTTPException(status_code=404, detail="Product Stage not found")
    await db.execute(select(Product).where(Product.id == stage.product_id).with_for_update())
    siblings = list((await db.scalars(select(ProductStage).where(ProductStage.product_id == stage.product_id).order_by(ProductStage.sequence).with_for_update())).all())
    index = next(index for index, item in enumerate(siblings) if item.id == stage_id)
    neighbor_index = index + payload.direction
    if neighbor_index < 0 or neighbor_index >= len(siblings):
        raise HTTPException(status_code=409, detail="Stage is already at the end of the sequence")
    neighbor = siblings[neighbor_index]
    if await used(db, stage.id) or await used(db, neighbor.id):
        raise HTTPException(status_code=409, detail="A Case uses one of these Stages; sequence is protected")
    previous = stage.sequence
    high = max(item.sequence for item in siblings) + 1
    stage.sequence = high
    await db.flush()
    neighbor.sequence = previous
    await db.flush()
    stage.sequence = previous + payload.direction
    now = datetime.now(timezone.utc)
    stage.updated_at = neighbor.updated_at = now
    await db.commit()
    refreshed = (await db.scalars(select(ProductStage).where(ProductStage.product_id == stage.product_id).order_by(ProductStage.sequence))).all()
    return [await view(item, db) for item in refreshed]


@router.delete("/stages/{stage_id}", status_code=204)
async def delete_stage(stage_id: UUID, current: Current, db: DB) -> None:
    await require_permission(db, current.user, "Cases", "delete-stage")
    stage = await db.get(ProductStage, stage_id)
    if not stage:
        raise HTTPException(status_code=404, detail="Product Stage not found")
    await db.execute(select(Product).where(Product.id == stage.product_id).with_for_update())
    if await used(db, stage.id):
        raise HTTPException(status_code=409, detail="A Case uses this Stage in current or historical progression")
    siblings = (await db.scalars(select(ProductStage).where(ProductStage.product_id == stage.product_id, ProductStage.sequence > stage.sequence).order_by(ProductStage.sequence).with_for_update())).all()
    await db.delete(stage)
    await db.flush()
    now = datetime.now(timezone.utc)
    for item in siblings:
        item.sequence -= 1
        item.updated_at = now
        await db.flush()
    await db.commit()
