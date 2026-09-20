"""Database-backed reporting snapshot with explicit report permissions."""

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.api.v1.auth import Current, DB
from app.db.models import Bank, Case, Clawback, CommissionRecord, IncentiveRecord, Product, ProductStage, ProductVariant, Task
from app.security.authorization import has_permission, require_permission

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/export-check")
async def export_check(current: Current, db: DB) -> dict:
    await require_permission(db, current.user, "Reports", "export")
    return {"allowed": True}


@router.get("/snapshot")
async def snapshot(current: Current, db: DB) -> dict:
    await require_permission(db, current.user, "Reports", "view")
    rows = (await db.execute(
        select(Case, Bank, Product, ProductVariant)
        .join(Bank, Bank.id == Case.bank_id)
        .join(Product, Product.id == Case.product_id)
        .join(ProductVariant, ProductVariant.id == Case.variant_id)
        .order_by(Case.created_at, Case.id)
    )).all()
    stages = {item.id: item.name for item in (await db.scalars(select(ProductStage))).all()}
    cases = [{"id": str(case.id), "case_number": case.case_number,
              "customer_id": str(case.customer_id), "case_owner_id": str(case.case_owner_id),
              "coordinator_id": str(case.coordinator_id) if case.coordinator_id else None,
              "bank": bank.name, "product": product.name, "product_variant": variant.name,
              "status": case.status, "stage": stages.get(case.current_stage_id) or (
                  "Submitted to Bank" if case.submitted_at else "Case Created"),
              "stage_id": str(case.current_stage_id) if case.current_stage_id else None,
              "stage_started_at": case.stage_started_at.isoformat() if case.stage_started_at else None,
              "stage_expected_duration_hours": str(case.stage_expected_duration_hours) if case.stage_expected_duration_hours else None,
              "created_at": case.created_at.isoformat(),
              "submitted_at": case.submitted_at.isoformat() if case.submitted_at else None}
             for case, bank, product, variant in rows]
    performance = await has_permission(db, current.user, "Reports", "view-performance")
    tasks = []
    if performance:
        tasks = [{"id": str(item.id), "case_id": str(item.case_id) if item.case_id else None,
                  "status": item.status} for item in (await db.scalars(select(Task))).all()]
    finance = None
    if await has_permission(db, current.user, "Reports", "view-financial"):
        commissions = (await db.scalars(select(CommissionRecord))).all()
        clawbacks = (await db.scalars(select(Clawback))).all()
        incentives = (await db.scalars(select(IncentiveRecord))).all()
        finance = {"commissions": [{"case_id": str(item.case_id), "status": item.status,
                                    "amount": str(item.amount)} for item in commissions],
                   "clawbacks": [{"case_id": str(item.case_id), "amount": str(item.amount)} for item in clawbacks],
                   "incentives": [{"amount": str(item.amount)} for item in incentives]}
    return {"as_of": datetime.now(timezone.utc).isoformat(), "cases": cases,
            "tasks": tasks, "finance": finance}
