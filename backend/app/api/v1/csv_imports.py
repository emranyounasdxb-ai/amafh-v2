"""Three controlled CSV intakes with server preview and atomic confirmation."""

import csv
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from io import StringIO
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.api.v1.auth import Current, DB
from app.core.config import get_settings
from app.db.models import AttendanceImportRow, Case, CaseHistory, CsvImport, OrganizationUnit, PasswordSetupLink, ProductStage, User, UserType
from app.security.authorization import has_permission, require_permission
from app.security.passwords import new_token, token_hash
from app.api.v1.notifications import add_notification

router = APIRouter(prefix="/imports", tags=["CSV imports"])
Kind = Literal["attendance", "case-stage", "users"]
HEADERS = {
    "attendance": ["userEmail", "date", "status"],
    "case-stage": ["caseNumber", "stage"],
    "users": ["fullName", "email", "userType", "organization", "organizationScope", "officeBranch", "department", "team"],
}


class PreviewInput(BaseModel):
    kind: Kind
    csv: str = Field(min_length=1, max_length=2_000_000)


class ConfirmInput(BaseModel):
    preview_id: UUID


def parse_csv(kind: Kind, source: str) -> list[dict]:
    if "\0" in source or len(source.encode("utf-8")) > 2_000_000:
        raise HTTPException(status_code=422, detail="Choose a text CSV no larger than 2 MB")
    try:
        reader = csv.reader(StringIO(source.lstrip("\ufeff")), strict=True)
        header = next(reader, None)
        if header != HEADERS[kind]:
            raise HTTPException(status_code=422, detail=f"CSV headers must be: {', '.join(HEADERS[kind])}")
        records = list(reader)
    except csv.Error as exc:
        raise HTTPException(status_code=422, detail="CSV could not be parsed") from exc
    if len(records) > 1000:
        raise HTTPException(status_code=422, detail="Import at most 1000 rows at a time")
    return [{"line": index + 2,
             "values": dict(zip(HEADERS[kind], [cell.strip() for cell in cells])),
             "errors": ["Incorrect column count."] if len(cells) != len(HEADERS[kind]) else []}
            for index, cells in enumerate(records)]


def parse_id(value: str) -> UUID | None:
    try:
        return UUID(value)
    except ValueError:
        return None


async def resolve_org(values: dict[str, str], db: DB) -> dict[str, UUID | None]:
    scope = values["organizationScope"]
    if scope not in ("organization", "office", "department", "team"):
        raise ValueError("Invalid organization scope.")
    ids: dict[str, UUID | None] = {"organization_id": None, "office_id": None, "department_id": None, "team_id": None}
    prior: UUID | None = None
    fields = (("organization", "organization_id", "organizations"),
              ("officeBranch", "office_id", "offices"),
              ("department", "department_id", "departments"),
              ("team", "team_id", "teams"))
    for index, (label, key, kind) in enumerate(fields):
        name = values[label]
        if not name:
            if any(values[future_label] for future_label, _, _ in fields[index + 1:]):
                raise ValueError("Organization hierarchy is incomplete.")
            break
        unit = (await db.scalars(select(OrganizationUnit).where(
            OrganizationUnit.kind == kind,
            OrganizationUnit.parent_id == prior if prior else OrganizationUnit.parent_id.is_(None),
            func.lower(OrganizationUnit.name) == name.lower(),
            OrganizationUnit.active.is_(True),
        ))).one_or_none()
        if not unit:
            raise ValueError(f"Active {label} was not found in its parent scope.")
        ids[key] = unit.id
        prior = unit.id
    required = {"organization": "organization_id", "office": "office_id", "department": "department_id", "team": "team_id"}[scope]
    if ids[required] is None:
        raise ValueError("Organization scope needs a matching unit.")
    return ids


async def validate_rows(kind: Kind, rows: list[dict], db: DB, actor: User) -> tuple[list[dict], int, int]:
    seen: set[str] = set()
    matched = unmatched = 0
    for row in rows:
        values, errors = row["values"], row["errors"]
        if len(values) != len(HEADERS[kind]):
            continue
        if kind == "attendance":
            email = values["userEmail"].lower()
            user = (await db.scalars(select(User).where(func.lower(User.email) == email))).one_or_none()
            if not user:
                errors.append("User email was not found.")
            try:
                day = date.fromisoformat(values["date"])
                if day.isoformat() != values["date"]:
                    raise ValueError()
            except ValueError:
                day = None
                errors.append("Invalid date.")
            if values["status"] not in ("Present", "Absent", "Late"):
                errors.append("Invalid attendance status.")
            key = f"{email}:{values['date']}"
            existing = bool(user and day and (await db.scalars(select(AttendanceImportRow.id).where(
                AttendanceImportRow.user_id == user.id, AttendanceImportRow.date == day))).first())
            if key in seen or existing:
                errors.append("Duplicate attendance entry.")
            seen.add(key)
        elif kind == "case-stage":
            identifier = parse_id(values["caseNumber"])
            case = (await db.scalars(select(Case).where(
                (Case.case_number == values["caseNumber"]) | (Case.id == identifier) if identifier else Case.case_number == values["caseNumber"]
            ))).one_or_none()
            if not case:
                errors.append("Case was not found.")
                unmatched += 1
            else:
                matched += 1
                stage = (await db.scalars(select(ProductStage).where(
                    ProductStage.product_id == case.product_id,
                    ProductStage.name == values["stage"], ProductStage.active.is_(True)
                ))).one_or_none()
                if not stage:
                    errors.append("Stage is not active for this Case Product.")
                if case.status != "SM Approved" or not case.coordinator_id or not case.submitted_at or not case.locked_at:
                    errors.append("Case is not ready for stage tracking.")
                if case.coordinator_id != actor.id:
                    errors.append("Acting user is not the assigned Case Coordinator.")
                if stage and case.current_stage_id == stage.id:
                    errors.append("Case is already in this Stage.")
            if values["caseNumber"] in seen:
                errors.append("Duplicate Case row.")
            seen.add(values["caseNumber"])
        else:
            email = values["email"].lower()
            name = values["fullName"]
            if not name or len(name) > 120:
                errors.append("Full Name is required and must be 120 characters or fewer.")
            if len(email) > 320 or not email or "@" not in email or email.startswith("@") or email.endswith("@"):
                errors.append("Valid email is required.")
            if email in seen or (await db.scalars(select(User.id).where(func.lower(User.email) == email))).first():
                errors.append("Duplicate user email.")
            seen.add(email)
            user_type = (await db.scalars(select(UserType).where(
                func.lower(UserType.name) == values["userType"].lower(), UserType.active.is_(True)
            ))).one_or_none()
            if not user_type:
                errors.append("Active User Type was not found.")
            try:
                await resolve_org(values, db)
            except ValueError as exc:
                errors.append(str(exc))
    return rows, matched, unmatched


def preview_view(item: CsvImport) -> dict:
    rows = item.summary.get("rows", [])
    return {"id": str(item.id), "kind": item.kind, "rows": rows,
            "valid": sum(not row["errors"] for row in rows),
            "invalid": sum(bool(row["errors"]) for row in rows),
            "matchedCases": item.summary.get("matchedCases", 0),
            "unmatchedCases": item.summary.get("unmatchedCases", 0)}


def result_view(item: CsvImport, setup_links: list[str] | None = None) -> dict:
    details = [f"Line {row['line']}: {' '.join(row['errors'])}" for row in item.summary.get("rows", []) if row["errors"]]
    return {"id": str(item.id), "kind": item.kind, "at": (item.confirmed_at or item.created_at).isoformat(),
            "actorId": str(item.actor_id), "success": item.imported_count,
            "failed": item.error_count, "details": details + (setup_links or [])}


@router.post("/preview", status_code=201)
async def preview(payload: PreviewInput, current: Current, db: DB) -> dict:
    await require_permission(db, current.user, "Imports", payload.kind)
    rows = parse_csv(payload.kind, payload.csv)
    rows, matched, unmatched = await validate_rows(payload.kind, rows, db, current.user)
    item = CsvImport(kind=payload.kind, file_name="upload.csv", actor_id=current.user.id,
                     status="preview", row_count=len(rows), imported_count=0,
                     error_count=sum(bool(row["errors"]) for row in rows),
                     summary={"rows": rows, "matchedCases": matched, "unmatchedCases": unmatched})
    db.add(item)
    await db.commit()
    return preview_view(item)


@router.get("/history")
async def history(current: Current, db: DB) -> list[dict]:
    rows = (await db.scalars(select(CsvImport).where(CsvImport.status == "confirmed")
                             .order_by(CsvImport.confirmed_at.desc(), CsvImport.id.desc()).limit(100))).all()
    allowed = {kind for kind in HEADERS if await has_permission(db, current.user, "Imports", kind)}
    return [result_view(item) for item in rows if item.kind in allowed]


@router.post("/confirm")
async def confirm(payload: ConfirmInput, current: Current, db: DB) -> dict:
    item = (await db.scalars(select(CsvImport).where(CsvImport.id == payload.preview_id).with_for_update())).one_or_none()
    if not item or item.actor_id != current.user.id:
        raise HTTPException(status_code=404, detail="Import preview not found")
    if item.status != "preview":
        raise HTTPException(status_code=409, detail="Import was already confirmed")
    await require_permission(db, current.user, "Imports", item.kind)
    original = item.summary["rows"]
    if not any(not row["errors"] for row in original):
        raise HTTPException(status_code=422, detail="No valid rows are available to import")
    fresh = [{"line": row["line"], "values": row["values"], "errors": []} for row in original]
    fresh, _, _ = await validate_rows(item.kind, fresh, db, current.user)
    if any(not original[index]["errors"] and row["errors"] for index, row in enumerate(fresh)):
        raise HTTPException(status_code=409, detail="Source data changed; upload and preview the CSV again")
    if item.kind == "case-stage":
        await require_permission(db, current.user, "Cases", "update-stage")
    setup_links: list[str] = []
    now = datetime.now(timezone.utc)
    for row in original:
        if row["errors"]:
            continue
        values = row["values"]
        if item.kind == "attendance":
            user = (await db.scalars(select(User).where(func.lower(User.email) == values["userEmail"].lower()))).one()
            db.add(AttendanceImportRow(user_id=user.id, date=date.fromisoformat(values["date"]),
                                       status=values["status"], import_id=item.id))
        elif item.kind == "case-stage":
            identifier = parse_id(values["caseNumber"])
            case = (await db.scalars(select(Case).where(
                (Case.case_number == values["caseNumber"]) | (Case.id == identifier) if identifier else Case.case_number == values["caseNumber"]
            ).with_for_update())).one()
            stage = (await db.scalars(select(ProductStage).where(
                ProductStage.product_id == case.product_id,
                ProductStage.name == values["stage"], ProductStage.active.is_(True)
            ))).one()
            case.current_stage_id = stage.id
            case.stage_started_at = now
            case.stage_expected_duration_hours = stage.expected_duration_hours
            case.stage_due_at = now + timedelta(seconds=float(stage.expected_duration_hours * Decimal(3600)))
            case.updated_at = now
            db.add(CaseHistory(case_id=case.id, event=stage.name, actor_id=current.user.id,
                               detail=f"CSV import {item.id}; Expected Duration: {stage.expected_duration_hours} hours.",
                               stage_id=stage.id, stage_name=stage.name,
                               expected_duration_hours=stage.expected_duration_hours, at=now))
            await add_notification(db, case.case_owner_id, "case-stage",
                                   f"{case.case_number}: {stage.name}", current.user.id, case.id)
        else:
            user_type = (await db.scalars(select(UserType).where(
                func.lower(UserType.name) == values["userType"].lower(), UserType.active.is_(True)
            ))).one()
            ids = await resolve_org(values, db)
            user = User(email=values["email"].lower(), full_name=values["fullName"],
                        user_type_id=user_type.id, organization_scope=values["organizationScope"],
                        active=False, **ids)
            db.add(user)
            await db.flush()
            token = new_token()
            db.add(PasswordSetupLink(user_id=user.id, token_hash=token_hash(token),
                                     created_by_id=current.user.id, created_at=now,
                                     expires_at=now + timedelta(minutes=get_settings().setup_link_minutes)))
            setup_links.append(f"Line {row['line']}: /set-password?token={token}")
    item.status = "confirmed"
    item.imported_count = sum(not row["errors"] for row in original)
    item.error_count = sum(bool(row["errors"]) for row in original)
    item.confirmed_at = now
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Import conflicted with current data; preview again") from exc
    return result_view(item, setup_links)
