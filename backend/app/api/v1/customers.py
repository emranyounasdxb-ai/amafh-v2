"""Customer records and atomic customer-through-application creation."""

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.api.v1.auth import Current, DB
from app.db.models import Bank, Case, CaseApproval, CaseHistory, CoordinatorAssignment, Customer, CustomerHistory, Product, ProductStage, ProductVariant, User
from app.security.authorization import has_permission, require_permission
from app.api.v1.notifications import add_notification

router = APIRouter(tags=["customers and applications"])


class CatalogueItem(BaseModel):
    id: UUID
    kind: Literal["banks", "products", "variants"]
    name: str
    parent_id: UUID | None
    active: bool


@router.get("/catalogue", response_model=list[CatalogueItem])
async def application_catalogue(current: Current, db: DB) -> list[CatalogueItem]:
    if not (await has_permission(db, current.user, "Cases", "create") or await has_permission(db, current.user, "Cases", "view") or await has_permission(db, current.user, "Finance", "view-commission")):
        raise HTTPException(status_code=403, detail="Permission required")
    banks = (await db.scalars(select(Bank).order_by(Bank.name))).all()
    products = (await db.scalars(select(Product).order_by(Product.name))).all()
    variants = (await db.scalars(select(ProductVariant).order_by(ProductVariant.name))).all()
    return ([CatalogueItem(id=item.id, kind="banks", name=item.name, parent_id=None, active=item.active) for item in banks]
            + [CatalogueItem(id=item.id, kind="products", name=item.name, parent_id=item.bank_id, active=item.active) for item in products]
            + [CatalogueItem(id=item.id, kind="variants", name=item.name, parent_id=item.product_id, active=item.active) for item in variants])


class CustomerInput(BaseModel):
    type: Literal["individual", "company"]
    emirates_id: str = Field(default="", max_length=64)
    passport_number: str = Field(default="", max_length=64)
    full_name: str = Field(default="", max_length=120)
    employer: str = Field(default="", max_length=120)
    company_name: str = Field(default="", max_length=120)
    contact_person: str = Field(default="", max_length=120)
    trade_license: str = Field(default="", max_length=64)
    mobile: str = Field(default="", max_length=120)
    email: str = Field(default="", max_length=120)


class CustomerView(CustomerInput):
    id: UUID
    active: bool
    created_at: datetime
    updated_at: datetime
    history: list[dict[str, str]]


class CustomerUpdate(BaseModel):
    customer: CustomerInput
    active: bool


class ApplicationInput(BaseModel):
    customer_id: UUID | None = None
    new_customer: CustomerInput | None = None
    bank_id: UUID
    product_id: UUID
    variant_id: UUID
    case_owner_id: UUID
    requested_amount: Decimal = Field(gt=0)


class ApplicationView(BaseModel):
    id: UUID
    case_number: str
    customer_id: UUID
    case_owner_id: UUID
    bank_id: UUID
    product_id: UUID
    variant_id: UUID
    requested_amount: Decimal | None
    status: str
    created_at: datetime


class ApplicationSummary(ApplicationView):
    bank: str
    product: str
    product_variant: str
    case_owner: str
    coordinator_id: UUID | None = None
    submitted_at: datetime | None = None
    bank_file_number: str | None = None
    locked_at: datetime | None = None
    current_stage_id: UUID | None = None
    stage_name: str | None = None
    stage_started_at: datetime | None = None
    stage_expected_duration_hours: Decimal | None = None
    stage_due_at: datetime | None = None


class CaseSummary(ApplicationSummary):
    approval_actor_id: UUID | None
    approved_at: datetime | None
    history: list[dict[str, str]]


class CaseEditInput(BaseModel):
    bank_id: UUID
    product_id: UUID
    variant_id: UUID
    case_owner_id: UUID
    requested_amount: Decimal = Field(gt=0)


class CaseActionInput(BaseModel):
    action: Literal["approve", "reject", "assign-coordinator", "submit-to-bank", "add-bank-file-number", "assign-owner", "edit", "edit-history", "update-stage"]
    value: str = ""
    draft: CaseEditInput | None = None


def clean_identity(value: str) -> str | None:
    normalized = value.strip()
    return normalized or None


def normalized_identity(value: str) -> str:
    return "".join(character for character in value.upper() if character not in " -")


def apply_customer(target: Customer, payload: CustomerInput) -> None:
    if payload.type == "individual":
        if not payload.full_name.strip():
            raise HTTPException(status_code=422, detail="Full Name is required")
        target.full_name = payload.full_name.strip()
        target.employer = payload.employer.strip()
        target.emirates_id = clean_identity(payload.emirates_id)
        target.passport_number = clean_identity(payload.passport_number)
        target.company_name = None
        target.contact_person = None
        target.trade_license = None
    else:
        if not payload.company_name.strip():
            raise HTTPException(status_code=422, detail="Company Name is required")
        target.company_name = payload.company_name.strip()
        target.contact_person = payload.contact_person.strip()
        target.trade_license = clean_identity(payload.trade_license)
        target.full_name = None
        target.employer = None
        target.emirates_id = None
        target.passport_number = None
    if len(payload.mobile) > 120 or len(payload.email) > 120:
        raise HTTPException(status_code=422, detail="Contact details are too long")
    target.mobile = payload.mobile.strip()
    target.email = payload.email.strip().lower()


async def check_identity(db: DB, payload: CustomerInput, exclude_id: UUID | None = None) -> None:
    customers = (await db.scalars(select(Customer).where(Customer.kind == payload.type))).all()
    for customer in customers:
        if customer.id == exclude_id:
            continue
        if payload.type == "individual":
            if payload.emirates_id.strip() and customer.emirates_id and normalized_identity(payload.emirates_id) == normalized_identity(customer.emirates_id):
                raise HTTPException(status_code=409, detail="Emirates ID is assigned to another customer")
            if payload.passport_number.strip() and customer.passport_number and normalized_identity(payload.passport_number) == normalized_identity(customer.passport_number):
                raise HTTPException(status_code=409, detail="Passport Number is assigned to another customer")
        elif payload.trade_license.strip() and customer.trade_license and normalized_identity(payload.trade_license) == normalized_identity(customer.trade_license):
            raise HTTPException(status_code=409, detail="Trade License is assigned to another customer")


def view_customer(customer: Customer, history: list[CustomerHistory]) -> CustomerView:
    return CustomerView(
        id=customer.id, type=customer.kind, emirates_id=customer.emirates_id or "",
        passport_number=customer.passport_number or "", full_name=customer.full_name or "",
        employer=customer.employer or "", company_name=customer.company_name or "",
        contact_person=customer.contact_person or "", trade_license=customer.trade_license or "",
        mobile=customer.mobile, email=customer.email, active=customer.active,
        created_at=customer.created_at, updated_at=customer.updated_at,
        history=[{"id": str(item.id), "label": item.event, "at": item.at.isoformat()} for item in history],
    )


async def customer_history(db: DB, customer_id: UUID) -> list[CustomerHistory]:
    return list((await db.scalars(select(CustomerHistory).where(CustomerHistory.customer_id == customer_id).order_by(CustomerHistory.at, CustomerHistory.id))).all())


@router.get("/customers", response_model=list[CustomerView])
async def list_customers(current: Current, db: DB) -> list[CustomerView]:
    if not (await has_permission(db, current.user, "Customers", "view") or await has_permission(db, current.user, "Cases", "create") or await has_permission(db, current.user, "Cases", "view")):
        raise HTTPException(status_code=403, detail="Permission required")
    customers = (await db.scalars(select(Customer).order_by(Customer.created_at, Customer.id))).all()
    return [view_customer(item, await customer_history(db, item.id)) for item in customers]


@router.put("/customers/{customer_id}", response_model=CustomerView)
async def update_customer(customer_id: UUID, payload: CustomerUpdate, current: Current, db: DB) -> CustomerView:
    await require_permission(db, current.user, "Customers", "edit")
    customer = await db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    if customer.kind != payload.customer.type:
        raise HTTPException(status_code=422, detail="Customer type cannot change")
    await check_identity(db, payload.customer, customer_id)
    apply_customer(customer, payload.customer)
    changed = customer.active != payload.active
    customer.active = payload.active
    customer.updated_at = datetime.now(timezone.utc)
    db.add(CustomerHistory(customer_id=customer_id, actor_id=current.user.id,
                           event=f"Status changed to {'active' if payload.active else 'inactive'}" if changed else "Customer updated"))
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Customer identity is already assigned") from exc
    await db.refresh(customer)
    return view_customer(customer, await customer_history(db, customer.id))


@router.delete("/customers/{customer_id}", status_code=204)
async def delete_customer(customer_id: UUID, current: Current, db: DB) -> None:
    await require_permission(db, current.user, "Customers", "delete")
    customer = await db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    if await db.scalar(select(func.count()).select_from(Case).where(Case.customer_id == customer_id)):
        raise HTTPException(status_code=409, detail="Related Applications/Cases prevent deletion")
    for event in await customer_history(db, customer_id):
        await db.delete(event)
    await db.delete(customer)
    await db.commit()


@router.post("/applications", status_code=201, response_model=ApplicationView)
async def create_application(payload: ApplicationInput, current: Current, db: DB) -> ApplicationView:
    await require_permission(db, current.user, "Cases", "create")
    if (payload.customer_id is None) == (payload.new_customer is None):
        raise HTTPException(status_code=422, detail="Select an existing customer or provide a new customer")
    bank = await db.get(Bank, payload.bank_id)
    product = await db.get(Product, payload.product_id)
    variant = await db.get(ProductVariant, payload.variant_id)
    owner = await db.get(User, payload.case_owner_id)
    if not bank or not product or not variant or not owner or not bank.active or not product.active or not variant.active or not owner.active or product.bank_id != bank.id or variant.product_id != product.id:
        raise HTTPException(status_code=422, detail="Select a valid active Bank, Product, Variant and Case Owner")
    if payload.customer_id:
        customer = await db.get(Customer, payload.customer_id)
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
    else:
        assert payload.new_customer is not None
        await check_identity(db, payload.new_customer)
        customer = Customer(kind=payload.new_customer.type, active=True)
        apply_customer(customer, payload.new_customer)
        db.add(customer)
        try:
            await db.flush()
        except IntegrityError as exc:
            await db.rollback()
            raise HTTPException(status_code=409, detail="Customer identity is already assigned") from exc
        db.add(CustomerHistory(customer_id=customer.id, actor_id=current.user.id,
                               event="Customer created through Application"))
    case_id = uuid4()
    case = Case(id=case_id, case_number=f"CASE-{str(case_id)[:8].upper()}", customer_id=customer.id,
                case_owner_id=owner.id, bank_id=bank.id, product_id=product.id,
                variant_id=variant.id, requested_amount=payload.requested_amount,
                status="Pending SM Approval")
    db.add(case)
    db.add(CaseHistory(case_id=case_id, event="Case Created", actor_id=current.user.id,
                       detail="Customer attached and application submitted."))
    await add_notification(db, owner.id, "case-assigned",
                           f"{case.case_number}: Case assigned", current.user.id, case.id)
    db.add(CustomerHistory(customer_id=customer.id, actor_id=current.user.id,
                           event="Application linked"))
    customer.updated_at = datetime.now(timezone.utc)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Customer identity or Case Number is already assigned") from exc
    await db.refresh(case)
    return ApplicationView(id=case.id, case_number=case.case_number, customer_id=case.customer_id,
                           case_owner_id=case.case_owner_id, bank_id=case.bank_id,
                           product_id=case.product_id, variant_id=case.variant_id,
                           requested_amount=case.requested_amount, status=case.status,
                           created_at=case.created_at)


@router.get("/applications", response_model=list[ApplicationSummary])
async def list_applications(current: Current, db: DB) -> list[ApplicationSummary]:
    if not (await has_permission(db, current.user, "Cases", "view") or await has_permission(db, current.user, "Customers", "view") or await has_permission(db, current.user, "Finance", "view-commission")):
        raise HTTPException(status_code=403, detail="Permission required")
    rows = (await db.execute(
        select(Case, Bank, Product, ProductVariant, User)
        .join(Bank, Bank.id == Case.bank_id)
        .join(Product, Product.id == Case.product_id)
        .join(ProductVariant, ProductVariant.id == Case.variant_id)
        .join(User, User.id == Case.case_owner_id)
        .order_by(Case.created_at, Case.id)
    )).all()
    return [ApplicationSummary(id=case.id, case_number=case.case_number, customer_id=case.customer_id,
            case_owner_id=case.case_owner_id, bank_id=case.bank_id, product_id=case.product_id,
            variant_id=case.variant_id, requested_amount=case.requested_amount, status=case.status,
            created_at=case.created_at, bank=bank.name, product=product.name,
            product_variant=variant.name, case_owner=owner.full_name,
            coordinator_id=case.coordinator_id, submitted_at=case.submitted_at,
            bank_file_number=case.bank_file_number, locked_at=case.locked_at,
            current_stage_id=case.current_stage_id,
            stage_name=(await db.get(ProductStage, case.current_stage_id)).name if case.current_stage_id else None,
            stage_started_at=case.stage_started_at,
            stage_expected_duration_hours=case.stage_expected_duration_hours,
            stage_due_at=case.stage_due_at)
            for case, bank, product, variant, owner in rows]


@router.get("/applications/{case_id}", response_model=CaseSummary)
async def application_detail(case_id: UUID, current: Current, db: DB) -> CaseSummary:
    if not (await has_permission(db, current.user, "Cases", "view") or await has_permission(db, current.user, "Customers", "view")):
        raise HTTPException(status_code=403, detail="Permission required")
    row = (await db.execute(
        select(Case, Bank, Product, ProductVariant, User)
        .join(Bank, Bank.id == Case.bank_id)
        .join(Product, Product.id == Case.product_id)
        .join(ProductVariant, ProductVariant.id == Case.variant_id)
        .join(User, User.id == Case.case_owner_id)
        .where(Case.id == case_id)
    )).one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Application/Case not found")
    case, bank, product, variant, owner = row
    can_view_history = await has_permission(db, current.user, "Cases", "view-history")
    history = (await db.scalars(select(CaseHistory).where(CaseHistory.case_id == case.id).order_by(CaseHistory.at, CaseHistory.id))).all() if can_view_history else []
    approval = (await db.scalars(select(CaseApproval).where(CaseApproval.case_id == case.id).order_by(CaseApproval.at.desc(), CaseApproval.id.desc()).limit(1))).one_or_none()
    return CaseSummary(id=case.id, case_number=case.case_number, customer_id=case.customer_id,
                       case_owner_id=case.case_owner_id, bank_id=case.bank_id,
                       product_id=case.product_id, variant_id=case.variant_id,
                       requested_amount=case.requested_amount, status=case.status,
                       created_at=case.created_at, bank=bank.name, product=product.name,
                       product_variant=variant.name, case_owner=owner.full_name,
                       bank_file_number=case.bank_file_number, coordinator_id=case.coordinator_id,
                       submitted_at=case.submitted_at, locked_at=case.locked_at,
                       current_stage_id=case.current_stage_id,
                       stage_name=(await db.get(ProductStage, case.current_stage_id)).name if case.current_stage_id else None,
                       stage_started_at=case.stage_started_at,
                       stage_expected_duration_hours=case.stage_expected_duration_hours,
                       stage_due_at=case.stage_due_at,
                       approval_actor_id=approval.actor_id if approval else None,
                       approved_at=approval.at if approval else None,
                       history=[{"id": str(item.id), "event": item.event, "actor_id": str(item.actor_id) if item.actor_id else "",
                                 "at": item.at.isoformat(), "detail": item.detail,
                                 "stage_id": str(item.stage_id) if item.stage_id else "",
                                 "stage_name": item.stage_name or "",
                                 "expected_duration_hours": str(item.expected_duration_hours) if item.expected_duration_hours else ""} for item in history])


@router.post("/applications/{case_id}/actions")
async def act_on_application(case_id: UUID, payload: CaseActionInput, current: Current, db: DB) -> dict[str, str]:
    await require_permission(db, current.user, "Cases", payload.action)
    case = (await db.scalars(select(Case).where(Case.id == case_id).with_for_update())).one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Application/Case not found")
    now = datetime.now(timezone.utc)
    value = payload.value.strip()
    detail = ""
    event = ""
    history_stage: ProductStage | None = None
    if payload.action == "edit":
        if case.status != "Pending SM Approval" or case.locked_at:
            raise HTTPException(status_code=409, detail="Original case information is protected after review or lock")
        draft = payload.draft
        if not draft:
            raise HTTPException(status_code=422, detail="Application details are required")
        bank = await db.get(Bank, draft.bank_id)
        product = await db.get(Product, draft.product_id)
        variant = await db.get(ProductVariant, draft.variant_id)
        owner = await db.get(User, draft.case_owner_id)
        if not bank or not product or not variant or not owner or not bank.active or not product.active or not variant.active or not owner.active or product.bank_id != bank.id or variant.product_id != product.id:
            raise HTTPException(status_code=422, detail="Select a valid active Bank, Product, Variant and Case Owner")
        case.bank_id, case.product_id, case.variant_id = bank.id, product.id, variant.id
        case.case_owner_id, case.requested_amount = owner.id, draft.requested_amount
        event = "Application updated"
    elif payload.action == "assign-owner":
        if case.status != "Pending SM Approval" or case.locked_at:
            raise HTTPException(status_code=409, detail="Case Owner cannot change after review or lock")
        try:
            owner = await db.get(User, UUID(value))
        except ValueError:
            owner = None
        if not owner or not owner.active:
            raise HTTPException(status_code=422, detail="Select an active Case Owner")
        case.case_owner_id = owner.id
        event, detail = "Case Owner changed", owner.full_name
    elif payload.action in ("approve", "reject"):
        if case.status != "Pending SM Approval":
            raise HTTPException(status_code=409, detail="This case has already been reviewed")
        case.status = "SM Approved" if payload.action == "approve" else "SM Rejected"
        db.add(CaseApproval(case_id=case.id, actor_id=current.user.id,
                            decision="approved" if payload.action == "approve" else "rejected", detail="", at=now))
        event = case.status
    elif payload.action == "assign-coordinator":
        if case.status != "SM Approved":
            raise HTTPException(status_code=409, detail="SM approval is required before coordinator handover")
        try:
            coordinator = await db.get(User, UUID(value))
        except ValueError:
            coordinator = None
        if not coordinator or not coordinator.active:
            raise HTTPException(status_code=422, detail="Select an active Case Coordinator")
        case.coordinator_id = coordinator.id
        db.add(CoordinatorAssignment(case_id=case.id, coordinator_id=coordinator.id,
                                     actor_id=current.user.id, at=now))
        event, detail = "Case Coordinator assigned", coordinator.full_name
    elif payload.action == "submit-to-bank":
        if case.status != "SM Approved" or not case.coordinator_id or case.submitted_at:
            raise HTTPException(status_code=409, detail="Approve and assign a coordinator before bank submission")
        if case.coordinator_id != current.user.id:
            raise HTTPException(status_code=403, detail="Only the assigned Case Coordinator can submit to the bank")
        case.submitted_at = now
        event = "Submitted to Bank"
    elif payload.action == "add-bank-file-number":
        if case.status != "SM Approved" or not case.coordinator_id or not case.submitted_at or case.bank_file_number:
            raise HTTPException(status_code=409, detail="Submit the approved Case before recording the Bank File Number")
        if case.coordinator_id != current.user.id:
            raise HTTPException(status_code=403, detail="Only the assigned Case Coordinator can add the Bank File Number")
        if not value or len(value) > 120:
            raise HTTPException(status_code=422, detail="Enter a Bank File Number of 120 characters or fewer")
        case.bank_file_number = value
        event, detail = "Bank File Number Added", value
        case.locked_at = now
    elif payload.action == "edit-history":
        if not value or len(value) > 500:
            raise HTTPException(status_code=422, detail="Enter history information of 500 characters or fewer")
        event, detail = "Case history updated", value
    elif payload.action == "update-stage":
        if case.status != "SM Approved" or not case.coordinator_id or not case.submitted_at or not case.locked_at:
            raise HTTPException(status_code=409, detail="Approve, assign a coordinator, submit and lock the Case before tracking stages")
        if case.coordinator_id != current.user.id:
            raise HTTPException(status_code=403, detail="Only the assigned Case Coordinator can update the Stage")
        try:
            history_stage = await db.get(ProductStage, UUID(value))
        except ValueError:
            history_stage = None
        if not history_stage or not history_stage.active or history_stage.product_id != case.product_id:
            raise HTTPException(status_code=422, detail="Select an active Stage configured for this Product")
        if case.current_stage_id == history_stage.id:
            raise HTTPException(status_code=409, detail="Case is already in this Stage")
        case.current_stage_id = history_stage.id
        case.stage_started_at = now
        case.stage_expected_duration_hours = history_stage.expected_duration_hours
        case.stage_due_at = now + timedelta(seconds=float(history_stage.expected_duration_hours * Decimal(3600)))
        event, detail = history_stage.name, f"Expected Duration: {history_stage.expected_duration_hours} hours."
    case.updated_at = now
    db.add(CaseHistory(case_id=case.id, event=event, actor_id=current.user.id, detail=detail, at=now,
                       stage_id=history_stage.id if history_stage else None,
                       stage_name=history_stage.name if history_stage else None,
                       expected_duration_hours=history_stage.expected_duration_hours if history_stage else None))
    category = {"approve": "case-reviewed", "reject": "case-reviewed",
                "assign-coordinator": "coordinator-assigned",
                "assign-owner": "case-assigned", "update-stage": "case-stage"}.get(payload.action)
    if category:
        recipient_id = case.coordinator_id if payload.action == "assign-coordinator" else case.case_owner_id
        if recipient_id:
            await add_notification(db, recipient_id, category,
                                   f"{case.case_number}: {event}", current.user.id, case.id)
    if payload.action == "add-bank-file-number":
        db.add(CaseHistory(case_id=case.id, event="Case Locked", actor_id=current.user.id, detail="", at=now + timedelta(microseconds=1)))
    await db.commit()
    return {"status": "updated"}


@router.delete("/applications/{case_id}", status_code=204)
async def delete_application(case_id: UUID, current: Current, db: DB) -> None:
    await require_permission(db, current.user, "Cases", "delete")
    case = (await db.scalars(select(Case).where(Case.id == case_id).with_for_update())).one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Application/Case not found")
    history = (await db.scalars(select(CaseHistory).where(CaseHistory.case_id == case_id))).all()
    if case.status != "Pending SM Approval" or case.submitted_at or case.bank_file_number or len(history) != 1:
        raise HTTPException(status_code=409, detail="Reviewed or changed Case history must be preserved")
    await db.delete(history[0])
    await db.delete(case)
    db.add(CustomerHistory(customer_id=case.customer_id, actor_id=current.user.id, event="Application removed"))
    await db.commit()
