"""Relational persistence for the approved AMAFH application concepts.

This module defines storage and constraints. Business transitions and permission
decisions belong to the API service layer, where they can be transactional.
"""

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean, CheckConstraint, Date, DateTime, ForeignKey, Index, Integer,
    LargeBinary, Numeric, String, Text, UniqueConstraint, func, text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def id_column():
    return mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)


def created_column():
    return mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class UserType(Base):
    __tablename__ = "user_types"
    id: Mapped[UUID] = id_column()
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = created_column()
    updated_at: Mapped[datetime] = created_column()
    __table_args__ = (Index("uq_user_types_name_ci", func.lower(name), unique=True),)


class Permission(Base):
    __tablename__ = "permissions"
    id: Mapped[UUID] = id_column()
    domain: Mapped[str] = mapped_column(String(120), nullable=False)
    action: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = created_column()
    updated_at: Mapped[datetime] = created_column()
    __table_args__ = (Index("uq_permissions_domain_action_ci", func.lower(domain), func.lower(action), unique=True),)


class UserTypePermission(Base):
    __tablename__ = "user_type_permissions"
    user_type_id: Mapped[UUID] = mapped_column(ForeignKey("user_types.id", ondelete="CASCADE"), primary_key=True)
    permission_id: Mapped[UUID] = mapped_column(ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True)
    assigned_at: Mapped[datetime] = created_column()


class OrganizationUnit(Base):
    __tablename__ = "organization_units"
    id: Mapped[UUID] = id_column()
    kind: Mapped[str] = mapped_column(String(32), nullable=False)
    parent_id: Mapped[UUID | None] = mapped_column(ForeignKey("organization_units.id", ondelete="RESTRICT"))
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = created_column()
    updated_at: Mapped[datetime] = created_column()
    __table_args__ = (
        CheckConstraint("kind IN ('organizations','offices','departments','teams','business-units')", name="ck_organization_kind"),
        Index("uq_organization_sibling_name_ci", kind, func.coalesce(parent_id, text("'00000000-0000-0000-0000-000000000000'::uuid")), func.lower(name), unique=True),
    )


class User(Base):
    __tablename__ = "users"
    id: Mapped[UUID] = id_column()
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    password_hash: Mapped[str | None] = mapped_column(String(255))
    user_type_id: Mapped[UUID] = mapped_column(ForeignKey("user_types.id", ondelete="RESTRICT"), nullable=False)
    reporting_manager_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    organization_id: Mapped[UUID | None] = mapped_column(ForeignKey("organization_units.id", ondelete="RESTRICT"))
    office_id: Mapped[UUID | None] = mapped_column(ForeignKey("organization_units.id", ondelete="RESTRICT"))
    department_id: Mapped[UUID | None] = mapped_column(ForeignKey("organization_units.id", ondelete="RESTRICT"))
    team_id: Mapped[UUID | None] = mapped_column(ForeignKey("organization_units.id", ondelete="RESTRICT"))
    organization_scope: Mapped[str] = mapped_column(String(32), nullable=False, default="organization")
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = created_column()
    updated_at: Mapped[datetime] = created_column()
    __table_args__ = (Index("uq_users_email_ci", func.lower(email), unique=True),)


class Bank(Base):
    __tablename__ = "banks"
    id: Mapped[UUID] = id_column()
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = created_column()
    updated_at: Mapped[datetime] = created_column()
    __table_args__ = (Index("uq_banks_name_ci", func.lower(name), unique=True),)


class Product(Base):
    __tablename__ = "products"
    id: Mapped[UUID] = id_column()
    bank_id: Mapped[UUID] = mapped_column(ForeignKey("banks.id", ondelete="RESTRICT"), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = created_column()
    updated_at: Mapped[datetime] = created_column()
    __table_args__ = (Index("uq_products_bank_name_ci", bank_id, func.lower(name), unique=True),)


class ProductVariant(Base):
    __tablename__ = "product_variants"
    id: Mapped[UUID] = id_column()
    product_id: Mapped[UUID] = mapped_column(ForeignKey("products.id", ondelete="RESTRICT"), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = created_column()
    updated_at: Mapped[datetime] = created_column()
    __table_args__ = (Index("uq_variants_product_name_ci", product_id, func.lower(name), unique=True),)


class ProductStage(Base):
    __tablename__ = "product_stages"
    id: Mapped[UUID] = id_column()
    product_id: Mapped[UUID] = mapped_column(ForeignKey("products.id", ondelete="RESTRICT"), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    expected_duration_hours: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = created_column()
    updated_at: Mapped[datetime] = created_column()
    __table_args__ = (
        CheckConstraint("sequence > 0", name="ck_stage_sequence_positive"),
        CheckConstraint("expected_duration_hours > 0", name="ck_stage_duration_positive"),
        UniqueConstraint("product_id", "sequence", name="uq_stage_product_sequence"),
        Index("uq_stages_product_name_ci", product_id, func.lower(name), unique=True),
    )


class Customer(Base):
    __tablename__ = "customers"
    id: Mapped[UUID] = id_column()
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(120))
    employer: Mapped[str | None] = mapped_column(String(120))
    emirates_id: Mapped[str | None] = mapped_column(String(64))
    passport_number: Mapped[str | None] = mapped_column(String(64))
    company_name: Mapped[str | None] = mapped_column(String(120))
    contact_person: Mapped[str | None] = mapped_column(String(120))
    trade_license: Mapped[str | None] = mapped_column(String(64))
    mobile: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    email: Mapped[str] = mapped_column(String(320), nullable=False, default="")
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = created_column()
    updated_at: Mapped[datetime] = created_column()
    __table_args__ = (
        CheckConstraint("kind IN ('individual','company')", name="ck_customer_kind"),
        Index("uq_customer_emirates_id", func.upper(func.replace(func.replace(emirates_id, "-", ""), " ", "")), unique=True, postgresql_where=emirates_id.is_not(None)),
        Index("uq_customer_passport", func.upper(func.replace(func.replace(passport_number, "-", ""), " ", "")), unique=True, postgresql_where=passport_number.is_not(None)),
        Index("uq_customer_trade_license", func.upper(func.replace(func.replace(trade_license, "-", ""), " ", "")), unique=True, postgresql_where=trade_license.is_not(None)),
    )


class CustomerHistory(Base):
    __tablename__ = "customer_history"
    id: Mapped[UUID] = id_column()
    customer_id: Mapped[UUID] = mapped_column(ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False)
    event: Mapped[str] = mapped_column(String(160), nullable=False)
    actor_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    at: Mapped[datetime] = created_column()


class Case(Base):
    __tablename__ = "cases"
    id: Mapped[UUID] = id_column()
    case_number: Mapped[str] = mapped_column(String(40), unique=True, nullable=False)
    customer_id: Mapped[UUID] = mapped_column(ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False)
    case_owner_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    bank_id: Mapped[UUID] = mapped_column(ForeignKey("banks.id", ondelete="RESTRICT"), nullable=False)
    product_id: Mapped[UUID] = mapped_column(ForeignKey("products.id", ondelete="RESTRICT"), nullable=False)
    variant_id: Mapped[UUID] = mapped_column(ForeignKey("product_variants.id", ondelete="RESTRICT"), nullable=False)
    requested_amount: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    status: Mapped[str] = mapped_column(String(40), nullable=False)
    current_stage_id: Mapped[UUID | None] = mapped_column(ForeignKey("product_stages.id", ondelete="RESTRICT"))
    stage_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    stage_expected_duration_hours: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    stage_due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    coordinator_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    bank_file_number: Mapped[str | None] = mapped_column(String(120))
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    locked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = created_column()
    updated_at: Mapped[datetime] = created_column()
    __table_args__ = (
        CheckConstraint("requested_amount IS NULL OR requested_amount > 0", name="ck_case_amount_positive"),
        CheckConstraint("stage_expected_duration_hours IS NULL OR stage_expected_duration_hours > 0", name="ck_case_stage_duration_positive"),
    )


class CaseHistory(Base):
    __tablename__ = "case_history"
    id: Mapped[UUID] = id_column()
    case_id: Mapped[UUID] = mapped_column(ForeignKey("cases.id", ondelete="RESTRICT"), nullable=False)
    event: Mapped[str] = mapped_column(String(160), nullable=False)
    actor_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    stage_id: Mapped[UUID | None] = mapped_column(ForeignKey("product_stages.id", ondelete="RESTRICT"))
    stage_name: Mapped[str | None] = mapped_column(String(120))
    expected_duration_hours: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    detail: Mapped[str] = mapped_column(Text, nullable=False, default="")
    at: Mapped[datetime] = created_column()
    __table_args__ = (Index("ix_case_history_case_at", case_id, at),)


class CaseApproval(Base):
    __tablename__ = "case_approvals"
    id: Mapped[UUID] = id_column()
    case_id: Mapped[UUID] = mapped_column(ForeignKey("cases.id", ondelete="RESTRICT"), nullable=False)
    actor_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    decision: Mapped[str] = mapped_column(String(16), nullable=False)
    detail: Mapped[str] = mapped_column(Text, nullable=False, default="")
    at: Mapped[datetime] = created_column()
    __table_args__ = (CheckConstraint("decision IN ('approved','rejected')", name="ck_approval_decision"),)


class CoordinatorAssignment(Base):
    __tablename__ = "coordinator_assignments"
    id: Mapped[UUID] = id_column()
    case_id: Mapped[UUID] = mapped_column(ForeignKey("cases.id", ondelete="RESTRICT"), nullable=False)
    coordinator_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    actor_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    at: Mapped[datetime] = created_column()


class Task(Base):
    __tablename__ = "tasks"
    id: Mapped[UUID] = id_column()
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    customer_id: Mapped[UUID | None] = mapped_column(ForeignKey("customers.id", ondelete="RESTRICT"))
    case_id: Mapped[UUID | None] = mapped_column(ForeignKey("cases.id", ondelete="RESTRICT"))
    assigned_to_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    created_by_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    priority: Mapped[str] = mapped_column(String(16), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = created_column()
    updated_at: Mapped[datetime] = created_column()
    __table_args__ = (
        CheckConstraint("priority IN ('Low','Medium','High','Urgent')", name="ck_task_priority"),
        CheckConstraint("status IN ('Open','In Progress','Completed','Cancelled')", name="ck_task_status"),
    )


class TaskNote(Base):
    __tablename__ = "task_notes"
    id: Mapped[UUID] = id_column()
    task_id: Mapped[UUID] = mapped_column(ForeignKey("tasks.id", ondelete="RESTRICT"), nullable=False)
    actor_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    at: Mapped[datetime] = created_column()


class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[UUID] = id_column()
    recipient_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    actor_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    category: Mapped[str] = mapped_column(String(60), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    related_case_id: Mapped[UUID | None] = mapped_column(ForeignKey("cases.id", ondelete="RESTRICT"))
    related_task_id: Mapped[UUID | None] = mapped_column(ForeignKey("tasks.id", ondelete="RESTRICT"))
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    at: Mapped[datetime] = created_column()


class ProfileMedia(Base):
    __tablename__ = "profile_media"
    id: Mapped[UUID] = id_column()
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(500), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(80), nullable=False)
    byte_size: Mapped[int] = mapped_column(Integer, nullable=False)
    uploaded_by_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    created_at: Mapped[datetime] = created_column()
    __table_args__ = (
        CheckConstraint("kind IN ('avatar','banner')", name="ck_profile_media_kind"),
        CheckConstraint("byte_size > 0", name="ck_profile_media_size"),
        UniqueConstraint("user_id", "kind", name="uq_profile_media_user_kind"),
    )


class CsvImport(Base):
    __tablename__ = "csv_imports"
    id: Mapped[UUID] = id_column()
    kind: Mapped[str] = mapped_column(String(30), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    actor_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    row_count: Mapped[int] = mapped_column(Integer, nullable=False)
    imported_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    summary: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = created_column()
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    __table_args__ = (CheckConstraint("kind IN ('attendance','case-stage','users')", name="ck_csv_import_kind"),)


class AttendanceImportRow(Base):
    __tablename__ = "attendance_import_rows"
    id: Mapped[UUID] = id_column()
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(12), nullable=False)
    import_id: Mapped[UUID] = mapped_column(ForeignKey("csv_imports.id", ondelete="RESTRICT"), nullable=False)
    created_at: Mapped[datetime] = created_column()
    __table_args__ = (
        CheckConstraint("status IN ('Present','Absent','Late')", name="ck_attendance_import_status"),
        UniqueConstraint("user_id", "date", name="uq_attendance_import_user_date"),
    )


class CommissionRule(Base):
    __tablename__ = "commission_rules"
    id: Mapped[UUID] = id_column()
    bank_id: Mapped[UUID] = mapped_column(ForeignKey("banks.id", ondelete="RESTRICT"), nullable=False)
    product_id: Mapped[UUID | None] = mapped_column(ForeignKey("products.id", ondelete="RESTRICT"))
    variant_id: Mapped[UUID | None] = mapped_column(ForeignKey("product_variants.id", ondelete="RESTRICT"))
    method: Mapped[str] = mapped_column(String(20), nullable=False)
    value: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)
    effective_until: Mapped[date | None] = mapped_column(Date)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = created_column()
    updated_at: Mapped[datetime] = created_column()
    __table_args__ = (
        CheckConstraint("method IN ('Fixed Amount','Percentage')", name="ck_commission_method"),
        CheckConstraint("value > 0 AND (method <> 'Percentage' OR value <= 100)", name="ck_commission_value"),
        CheckConstraint("effective_until IS NULL OR effective_until >= effective_from", name="ck_commission_dates"),
    )


class CommissionRecord(Base):
    __tablename__ = "commission_records"
    id: Mapped[UUID] = id_column()
    case_id: Mapped[UUID] = mapped_column(ForeignKey("cases.id", ondelete="RESTRICT"), nullable=False)
    case_owner_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    rule_id: Mapped[UUID] = mapped_column(ForeignKey("commission_rules.id", ondelete="RESTRICT"), nullable=False)
    bank_id: Mapped[UUID] = mapped_column(ForeignKey("banks.id", ondelete="RESTRICT"), nullable=False)
    product_id: Mapped[UUID] = mapped_column(ForeignKey("products.id", ondelete="RESTRICT"), nullable=False)
    variant_id: Mapped[UUID] = mapped_column(ForeignKey("product_variants.id", ondelete="RESTRICT"), nullable=False)
    basis: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    calculated_at: Mapped[datetime] = created_column()
    pending_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    actor_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    __table_args__ = (
        CheckConstraint("status IN ('Calculated','Pending','Approved','Paid')", name="ck_commission_status"),
        UniqueConstraint("case_id", name="uq_commission_case"),
    )


class Clawback(Base):
    __tablename__ = "clawbacks"
    id: Mapped[UUID] = id_column()
    commission_id: Mapped[UUID] = mapped_column(ForeignKey("commission_records.id", ondelete="RESTRICT"), nullable=False)
    case_id: Mapped[UUID] = mapped_column(ForeignKey("cases.id", ondelete="RESTRICT"), nullable=False)
    original_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    actor_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    at: Mapped[datetime] = created_column()
    __table_args__ = (CheckConstraint("amount > 0", name="ck_clawback_amount"),)


class IncentiveRule(Base):
    __tablename__ = "incentive_rules"
    id: Mapped[UUID] = id_column()
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    metric: Mapped[str] = mapped_column(String(120), nullable=False)
    target_value: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = created_column()
    updated_at: Mapped[datetime] = created_column()
    __table_args__ = (Index("uq_incentive_rule_name_ci", func.lower(name), unique=True),)


class IncentiveRecord(Base):
    __tablename__ = "incentive_records"
    id: Mapped[UUID] = id_column()
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    rule_id: Mapped[UUID] = mapped_column(ForeignKey("incentive_rules.id", ondelete="RESTRICT"), nullable=False)
    period_kind: Mapped[str] = mapped_column(String(12), nullable=False)
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    target_value: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    achievement: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    created_at: Mapped[datetime] = created_column()
    updated_at: Mapped[datetime] = created_column()
    __table_args__ = (
        CheckConstraint("period_kind IN ('monthly','quarterly')", name="ck_incentive_period_kind"),
        UniqueConstraint("user_id", "period_kind", "period_start", "rule_id", name="uq_incentive_user_period_rule"),
    )


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[UUID] = id_column()
    actor_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    action: Mapped[str] = mapped_column(String(160), nullable=False)
    entity: Mapped[str] = mapped_column(String(120), nullable=False)
    entity_id: Mapped[str | None] = mapped_column(String(120))
    before: Mapped[dict | None] = mapped_column(JSONB)
    after: Mapped[dict | None] = mapped_column(JSONB)
    metadata_json: Mapped[dict] = mapped_column("metadata", JSONB, nullable=False, default=dict)
    at: Mapped[datetime] = created_column()
    __table_args__ = (Index("ix_audit_entity_at", entity, entity_id, at),)


class Session(Base):
    __tablename__ = "sessions"
    id: Mapped[UUID] = id_column()
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    token_hash: Mapped[bytes] = mapped_column(LargeBinary(32), nullable=False, unique=True)
    created_at: Mapped[datetime] = created_column()
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_seen_at: Mapped[datetime] = created_column()
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class PasswordSetupLink(Base):
    __tablename__ = "password_setup_links"
    id: Mapped[UUID] = id_column()
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    token_hash: Mapped[bytes] = mapped_column(LargeBinary(32), nullable=False, unique=True)
    created_by_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    created_at: Mapped[datetime] = created_column()
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
