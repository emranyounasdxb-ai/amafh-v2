from sqlalchemy import CheckConstraint, ForeignKeyConstraint, Index, UniqueConstraint

from app.db import models  # noqa: F401 - register mapped tables
from app.db.base import Base


def test_application_schema_has_required_relational_entities() -> None:
    required = {
        "users", "user_types", "permissions", "user_type_permissions",
        "organization_units", "banks", "products", "product_variants",
        "product_stages", "customers", "customer_history", "cases",
        "case_history", "case_approvals", "coordinator_assignments",
        "tasks", "task_notes", "notifications", "profile_media",
        "csv_imports", "attendance_import_rows", "commission_rules", "commission_records",
        "clawbacks", "incentive_rules", "incentive_records", "audit_logs",
        "sessions", "password_setup_links",
    }
    assert required == set(Base.metadata.tables)
    assert all(table.primary_key.columns for table in Base.metadata.tables.values())


def test_permissions_are_assigned_through_user_types() -> None:
    grants = Base.metadata.tables["user_type_permissions"]
    targets = {fk.target_fullname for fk in grants.foreign_keys}
    assert targets == {"user_types.id", "permissions.id"}
    assert not any(fk.target_fullname == "users.id" for fk in grants.foreign_keys)


def test_case_stage_and_history_keep_product_and_timing_references() -> None:
    cases = Base.metadata.tables["cases"]
    history = Base.metadata.tables["case_history"]
    stages = Base.metadata.tables["product_stages"]
    assert {"current_stage_id", "stage_started_at", "stage_expected_duration_hours", "stage_due_at"} <= set(cases.columns.keys())
    assert {"stage_id", "stage_name", "expected_duration_hours", "at"} <= set(history.columns.keys())
    assert {fk.target_fullname for fk in history.foreign_keys} >= {"cases.id", "product_stages.id"}
    assert any(isinstance(item, UniqueConstraint) and {column.name for column in item.columns} == {"product_id", "sequence"} for item in stages.constraints)


def test_customer_identity_and_finance_constraints_are_present() -> None:
    customers = Base.metadata.tables["customers"]
    assert {index.name for index in customers.indexes} >= {
        "uq_customer_emirates_id", "uq_customer_passport", "uq_customer_trade_license"
    }
    assert all(index.unique for index in customers.indexes)
    assert any(isinstance(item, CheckConstraint) and item.name == "ck_commission_value" for item in Base.metadata.tables["commission_rules"].constraints)
    assert any(isinstance(item, ForeignKeyConstraint) for item in Base.metadata.tables["commission_records"].constraints)
