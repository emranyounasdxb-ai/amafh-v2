"""Configured commission rules and Case-outcome commercial lifecycle."""

from datetime import date, datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.api.v1.auth import Current, DB
from app.db.models import AuditLog, Bank, Case, Clawback, CommissionRecord, CommissionRule, IncentiveRecord, IncentiveRule, Product, ProductStage, ProductVariant, User
from app.security.authorization import has_permission, require_permission

router = APIRouter(prefix="/finance", tags=["finance"])


class RuleInput(BaseModel):
    bank_id: UUID
    product_id: UUID | None = None
    variant_id: UUID | None = None
    method: Literal["Fixed Amount", "Percentage"]
    value: Decimal = Field(gt=0)
    effective_from: date
    effective_until: date | None = None
    active: bool


class AdvanceInput(BaseModel):
    status: Literal["Pending", "Approved", "Paid"]


class ClawbackInput(BaseModel):
    commission_id: UUID
    amount: Decimal = Field(gt=0)
    reason: str = Field(min_length=1, max_length=500)


class IncentiveRuleInput(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    metric: str = Field(min_length=1, max_length=120)
    target_value: Decimal = Field(gt=0)
    amount: Decimal = Field(ge=0)
    active: bool


class IncentiveInput(BaseModel):
    user_id: UUID
    rule_id: UUID
    period: str
    achievement: Decimal = Field(ge=0)
    status: Literal["Draft", "Approved"]


def rule_view(item: CommissionRule) -> dict:
    return {"id": str(item.id), "bank_id": str(item.bank_id),
            "product_id": str(item.product_id) if item.product_id else None,
            "variant_id": str(item.variant_id) if item.variant_id else None,
            "method": item.method, "value": str(item.value),
            "effective_from": item.effective_from.isoformat(),
            "effective_until": item.effective_until.isoformat() if item.effective_until else None,
            "active": item.active, "created_at": item.created_at.isoformat(),
            "updated_at": item.updated_at.isoformat()}


def commission_view(item: CommissionRecord) -> dict:
    return {"id": str(item.id), "case_id": str(item.case_id),
            "case_owner_id": str(item.case_owner_id), "rule_id": str(item.rule_id),
            "bank_id": str(item.bank_id), "product_id": str(item.product_id),
            "variant_id": str(item.variant_id), "basis": str(item.basis),
            "amount": str(item.amount), "status": item.status,
            "calculated_at": item.calculated_at.isoformat(),
            "pending_at": item.pending_at.isoformat() if item.pending_at else None,
            "approved_at": item.approved_at.isoformat() if item.approved_at else None,
            "paid_at": item.paid_at.isoformat() if item.paid_at else None,
            "actor_id": str(item.actor_id)}


def clawback_view(item: Clawback) -> dict:
    return {"id": str(item.id), "commission_id": str(item.commission_id),
            "case_id": str(item.case_id), "original_amount": str(item.original_amount),
            "amount": str(item.amount), "reason": item.reason, "status": item.status,
            "at": item.at.isoformat(), "actor_id": str(item.actor_id)}


def incentive_rule_view(item: IncentiveRule) -> dict:
    return {"id": str(item.id), "name": item.name, "metric": item.metric,
            "target_value": str(item.target_value), "amount": str(item.amount),
            "active": item.active, "created_at": item.created_at.isoformat(),
            "updated_at": item.updated_at.isoformat()}


def incentive_view(item: IncentiveRecord, rule: IncentiveRule) -> dict:
    period = (f"{item.period_start.year}-Q{(item.period_start.month - 1) // 3 + 1}"
              if item.period_kind == "quarterly" else item.period_start.strftime("%Y-%m"))
    return {"id": str(item.id), "user_id": str(item.user_id), "rule_id": str(item.rule_id),
            "period": period, "metric": rule.metric, "target_value": str(item.target_value),
            "achievement": str(item.achievement), "amount": str(item.amount),
            "status": item.status, "created_at": item.created_at.isoformat(),
            "updated_at": item.updated_at.isoformat()}


def parse_period(value: str) -> tuple[str, date]:
    if len(value) != 7 or not value[:4].isdigit() or not 1 <= int(value[:4]) <= 9999:
        raise HTTPException(status_code=422, detail="Use a YYYY-MM or YYYY-Q1..Q4 period")
    if len(value) == 7 and value[4] == "-" and value[5:].isdigit():
        year, month = int(value[:4]), int(value[5:])
        if 1 <= month <= 12:
            return "monthly", date(year, month, 1)
    if len(value) == 7 and value[4:6] == "-Q" and value[6] in "1234":
        return "quarterly", date(int(value[:4]), (int(value[6]) - 1) * 3 + 1, 1)
    raise HTTPException(status_code=422, detail="Use a YYYY-MM or YYYY-Q1..Q4 period")


async def validate_rule(payload: RuleInput, db: DB, editing_id: UUID | None = None) -> None:
    if payload.method == "Percentage" and payload.value > 100:
        raise HTTPException(status_code=422, detail="Percentage cannot exceed 100")
    if payload.effective_until and payload.effective_until < payload.effective_from:
        raise HTTPException(status_code=422, detail="Effective Until must follow Effective From")
    bank = await db.get(Bank, payload.bank_id)
    product = await db.get(Product, payload.product_id) if payload.product_id else None
    variant = await db.get(ProductVariant, payload.variant_id) if payload.variant_id else None
    if not bank or not bank.active or payload.product_id and (not product or not product.active or product.bank_id != bank.id) or payload.variant_id and (not variant or not variant.active or not product or variant.product_id != product.id):
        raise HTTPException(status_code=422, detail="Select an active Bank, Product and Variant combination")
    # The bank row serializes competing rule writes for this catalogue scope.
    await db.execute(select(Bank.id).where(Bank.id == payload.bank_id).with_for_update())
    rules = (await db.scalars(select(CommissionRule).where(
        CommissionRule.bank_id == payload.bank_id,
        CommissionRule.product_id == payload.product_id if payload.product_id else CommissionRule.product_id.is_(None),
        CommissionRule.variant_id == payload.variant_id if payload.variant_id else CommissionRule.variant_id.is_(None),
    ))).all()
    for rule in rules:
        if rule.id == editing_id:
            continue
        if rule.effective_from <= (payload.effective_until or date.max) and payload.effective_from <= (rule.effective_until or date.max):
            raise HTTPException(status_code=409, detail="A Commission Rule already covers this scope and date range")


@router.get("/snapshot")
async def snapshot(current: Current, db: DB) -> dict:
    can_commission = await has_permission(db, current.user, "Finance", "view-commission")
    can_incentives = await has_permission(db, current.user, "Finance", "view-incentives")
    if not can_commission and not can_incentives:
        raise HTTPException(status_code=403, detail="Permission required")
    rules = (await db.scalars(select(CommissionRule).order_by(CommissionRule.created_at, CommissionRule.id))).all() if can_commission else []
    records = (await db.scalars(select(CommissionRecord).order_by(CommissionRecord.calculated_at, CommissionRecord.id))).all() if can_commission else []
    clawbacks = (await db.scalars(select(Clawback).order_by(Clawback.at, Clawback.id))).all() if can_commission else []
    incentive_rules = (await db.scalars(select(IncentiveRule).order_by(IncentiveRule.created_at, IncentiveRule.id))).all() if can_incentives else []
    incentives = (await db.scalars(select(IncentiveRecord).order_by(IncentiveRecord.created_at, IncentiveRecord.id))).all() if can_incentives else []
    rule_by_id = {item.id: item for item in incentive_rules}
    return {"rules": [rule_view(item) for item in rules],
            "commissions": [commission_view(item) for item in records],
            "clawbacks": [clawback_view(item) for item in clawbacks],
            "incentive_rules": [incentive_rule_view(item) for item in incentive_rules],
            "incentives": [incentive_view(item, rule_by_id[item.rule_id]) for item in incentives]}


@router.post("/rules", status_code=201)
async def create_rule(payload: RuleInput, current: Current, db: DB) -> dict:
    await require_permission(db, current.user, "Finance", "manage-rules")
    await validate_rule(payload, db)
    item = CommissionRule(**payload.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return rule_view(item)


@router.put("/rules/{rule_id}")
async def edit_rule(rule_id: UUID, payload: RuleInput, current: Current, db: DB) -> dict:
    await require_permission(db, current.user, "Finance", "manage-rules")
    item = (await db.scalars(select(CommissionRule).where(CommissionRule.id == rule_id).with_for_update())).one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Commission Rule was not found")
    if (await db.scalars(select(CommissionRecord.id).where(CommissionRecord.rule_id == rule_id))).first():
        raise HTTPException(status_code=409, detail="A used Commission Rule cannot be changed")
    await validate_rule(payload, db, rule_id)
    for key, value in payload.model_dump().items():
        setattr(item, key, value)
    item.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return rule_view(item)


@router.delete("/rules/{rule_id}", status_code=204)
async def delete_rule(rule_id: UUID, current: Current, db: DB) -> None:
    await require_permission(db, current.user, "Finance", "manage-rules")
    item = await db.get(CommissionRule, rule_id)
    if not item:
        raise HTTPException(status_code=404, detail="Commission Rule was not found")
    if (await db.scalars(select(CommissionRecord.id).where(CommissionRecord.rule_id == rule_id))).first():
        raise HTTPException(status_code=409, detail="Commission Rule is used by a Commission")
    await db.delete(item)
    await db.commit()


@router.post("/commissions/calculate", status_code=201)
async def calculate(case_id: UUID, current: Current, db: DB) -> dict:
    await require_permission(db, current.user, "Finance", "review-commission")
    case = (await db.scalars(select(Case).where(Case.id == case_id).with_for_update())).one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case was not found")
    stage = await db.get(ProductStage, case.current_stage_id) if case.current_stage_id else None
    if case.status != "SM Approved" or not case.locked_at or not stage or stage.name != "Final Outcome":
        raise HTTPException(status_code=409, detail="Commission requires an approved, locked Case at Final Outcome")
    if (await db.scalars(select(CommissionRecord.id).where(CommissionRecord.case_id == case_id))).first():
        raise HTTPException(status_code=409, detail="This Case already has a Commission")
    today = datetime.now(timezone.utc).date()
    rules = (await db.scalars(select(CommissionRule).where(
        CommissionRule.bank_id == case.bank_id, CommissionRule.active.is_(True),
        CommissionRule.effective_from <= today,
        (CommissionRule.effective_until.is_(None)) | (CommissionRule.effective_until >= today),
    ))).all()
    applicable = [rule for rule in rules if (rule.product_id is None or rule.product_id == case.product_id)
                  and (rule.variant_id is None or rule.variant_id == case.variant_id)]
    applicable.sort(key=lambda item: (item.variant_id is not None, item.product_id is not None), reverse=True)
    if not applicable:
        raise HTTPException(status_code=409, detail="No active Commission Rule applies to this Case")
    rule = applicable[0]
    if case.requested_amount is None:
        raise HTTPException(status_code=409, detail="Case has no calculation basis")
    basis = case.requested_amount
    amount = (basis * rule.value / Decimal(100) if rule.method == "Percentage" else rule.value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    item = CommissionRecord(case_id=case.id, case_owner_id=case.case_owner_id,
                            rule_id=rule.id, bank_id=case.bank_id, product_id=case.product_id,
                            variant_id=case.variant_id, basis=basis, amount=amount,
                            status="Calculated", actor_id=current.user.id)
    db.add(item)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail="This Case already has a Commission") from exc
    await db.refresh(item)
    return commission_view(item)


@router.post("/commissions/{commission_id}/advance")
async def advance(commission_id: UUID, payload: AdvanceInput, current: Current, db: DB) -> dict:
    action = {"Pending": "review-commission", "Approved": "approve-commission", "Paid": "mark-paid"}[payload.status]
    await require_permission(db, current.user, "Finance", action)
    item = (await db.scalars(select(CommissionRecord).where(
        CommissionRecord.id == commission_id).with_for_update())).one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Commission was not found")
    previous = {"Pending": "Calculated", "Approved": "Pending", "Paid": "Approved"}[payload.status]
    if item.status != previous:
        raise HTTPException(status_code=409, detail=f"Commission must be {previous} before {payload.status}")
    item.status = payload.status
    setattr(item, {"Pending": "pending_at", "Approved": "approved_at", "Paid": "paid_at"}[payload.status], datetime.now(timezone.utc))
    await db.commit()
    return commission_view(item)


@router.post("/clawbacks", status_code=201)
async def create_clawback(payload: ClawbackInput, current: Current, db: DB) -> dict:
    await require_permission(db, current.user, "Finance", "manage-clawback")
    commission = (await db.scalars(select(CommissionRecord).where(
        CommissionRecord.id == payload.commission_id).with_for_update())).one_or_none()
    if not commission or commission.status != "Paid":
        raise HTTPException(status_code=409, detail="Clawback requires a Paid Commission")
    existing = (await db.scalars(select(Clawback).where(Clawback.commission_id == commission.id))).all()
    amount = payload.amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    if amount <= 0 or amount + sum((item.amount for item in existing), Decimal(0)) > commission.amount:
        raise HTTPException(status_code=422, detail="Clawback amount exceeds the remaining Commission")
    reason = payload.reason.strip()
    if not reason:
        raise HTTPException(status_code=422, detail="Clawback reason is required")
    item = Clawback(commission_id=commission.id, case_id=commission.case_id,
                    original_amount=commission.amount, amount=amount,
                    reason=reason, status="Open", actor_id=current.user.id)
    db.add(item)
    await db.flush()
    db.add(AuditLog(actor_id=current.user.id, action="clawback.create",
                    entity="clawback", entity_id=str(item.id), before=None,
                    after={"commission_id": str(commission.id), "amount": str(amount),
                           "reason": reason, "status": "Open"}, metadata_json={}))
    await db.commit()
    await db.refresh(item)
    return clawback_view(item)


@router.post("/clawbacks/{clawback_id}/resolve")
async def resolve_clawback(clawback_id: UUID, current: Current, db: DB) -> dict:
    await require_permission(db, current.user, "Finance", "manage-clawback")
    item = (await db.scalars(select(Clawback).where(Clawback.id == clawback_id).with_for_update())).one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Clawback was not found")
    if item.status != "Open":
        raise HTTPException(status_code=409, detail="Clawback is already resolved")
    item.status = "Resolved"
    db.add(AuditLog(actor_id=current.user.id, action="clawback.resolve",
                    entity="clawback", entity_id=str(item.id),
                    before={"status": "Open"}, after={"status": "Resolved"}, metadata_json={}))
    await db.commit()
    return clawback_view(item)


@router.post("/incentive-rules", status_code=201)
async def create_incentive_rule(payload: IncentiveRuleInput, current: Current, db: DB) -> dict:
    await require_permission(db, current.user, "Finance", "manage-incentives")
    name, metric = payload.name.strip(), payload.metric.strip()
    if not name or not metric:
        raise HTTPException(status_code=422, detail="Rule name and metric are required")
    item = IncentiveRule(name=name, metric=metric, target_value=payload.target_value,
                         amount=payload.amount, active=payload.active)
    db.add(item)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Incentive Rule name already exists") from exc
    await db.refresh(item)
    return incentive_rule_view(item)


@router.put("/incentive-rules/{rule_id}")
async def edit_incentive_rule(rule_id: UUID, payload: IncentiveRuleInput, current: Current, db: DB) -> dict:
    await require_permission(db, current.user, "Finance", "manage-incentives")
    item = (await db.scalars(select(IncentiveRule).where(IncentiveRule.id == rule_id).with_for_update())).one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Incentive Rule was not found")
    if (await db.scalars(select(IncentiveRecord.id).where(IncentiveRecord.rule_id == rule_id))).first():
        raise HTTPException(status_code=409, detail="A used Incentive Rule cannot be changed")
    item.name, item.metric = payload.name.strip(), payload.metric.strip()
    item.target_value, item.amount, item.active = payload.target_value, payload.amount, payload.active
    if not item.name or not item.metric:
        raise HTTPException(status_code=422, detail="Rule name and metric are required")
    item.updated_at = datetime.now(timezone.utc)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Incentive Rule name already exists") from exc
    return incentive_rule_view(item)


@router.delete("/incentive-rules/{rule_id}", status_code=204)
async def delete_incentive_rule(rule_id: UUID, current: Current, db: DB) -> None:
    await require_permission(db, current.user, "Finance", "manage-incentives")
    item = await db.get(IncentiveRule, rule_id)
    if not item:
        raise HTTPException(status_code=404, detail="Incentive Rule was not found")
    if (await db.scalars(select(IncentiveRecord.id).where(IncentiveRecord.rule_id == rule_id))).first():
        raise HTTPException(status_code=409, detail="Incentive Rule is used by a record")
    await db.delete(item)
    await db.commit()


async def validate_incentive(payload: IncentiveInput, db: DB) -> tuple[User, IncentiveRule, str, date]:
    user = await db.get(User, payload.user_id)
    rule = await db.get(IncentiveRule, payload.rule_id)
    if not user or not user.active or not rule or not rule.active:
        raise HTTPException(status_code=422, detail="Select an active User and Incentive Rule")
    kind, period_start = parse_period(payload.period)
    return user, rule, kind, period_start


@router.post("/incentives", status_code=201)
async def create_incentive(payload: IncentiveInput, current: Current, db: DB) -> dict:
    await require_permission(db, current.user, "Finance", "manage-incentives")
    user, rule, kind, period_start = await validate_incentive(payload, db)
    item = IncentiveRecord(user_id=user.id, rule_id=rule.id, period_kind=kind,
                           period_start=period_start, target_value=rule.target_value,
                           achievement=payload.achievement, amount=rule.amount, status=payload.status)
    db.add(item)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Incentive already exists for this User, period and rule") from exc
    await db.refresh(item)
    return incentive_view(item, rule)


@router.put("/incentives/{incentive_id}")
async def edit_incentive(incentive_id: UUID, payload: IncentiveInput, current: Current, db: DB) -> dict:
    await require_permission(db, current.user, "Finance", "manage-incentives")
    item = (await db.scalars(select(IncentiveRecord).where(IncentiveRecord.id == incentive_id).with_for_update())).one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Incentive was not found")
    user, rule, kind, period_start = await validate_incentive(payload, db)
    item.user_id, item.rule_id = user.id, rule.id
    item.period_kind, item.period_start = kind, period_start
    item.target_value, item.amount = rule.target_value, rule.amount
    item.achievement, item.status = payload.achievement, payload.status
    item.updated_at = datetime.now(timezone.utc)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Incentive already exists for this User, period and rule") from exc
    return incentive_view(item, rule)


@router.delete("/incentives/{incentive_id}", status_code=204)
async def delete_incentive(incentive_id: UUID, current: Current, db: DB) -> None:
    await require_permission(db, current.user, "Finance", "manage-incentives")
    item = await db.get(IncentiveRecord, incentive_id)
    if not item:
        raise HTTPException(status_code=404, detail="Incentive was not found")
    await db.delete(item)
    await db.commit()
