"""Database-backed cookie sessions and owner-initiated password setup."""

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import hashlib
from typing import Annotated, AsyncIterator
from uuid import UUID

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import select, update, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.models import (
    AuditLog, Notification, OrganizationUnit, PasswordSetupLink, Session as LoginSession, User, UserType,
)
from app.security.authorization import granted_actions, has_permission
from app.security.passwords import hash_password, new_token, token_hash, validate_password, verify_password
import app.audit  # noqa: F401 - register transactional audit listeners

router = APIRouter(prefix="/auth", tags=["authentication"])
COOKIE = "amafh_session"


class LoginInput(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=1, max_length=128)


class PasswordInput(BaseModel):
    password: str


class ChangePasswordInput(BaseModel):
    current_password: str
    new_password: str


class SetupPasswordInput(BaseModel):
    token: str
    password: str


class SetupLinkInput(BaseModel):
    email: str = Field(min_length=3, max_length=320)


class NewUserInput(BaseModel):
    full_name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=320)
    user_type_id: UUID
    organization_id: UUID | None = None
    office_id: UUID | None = None
    department_id: UUID | None = None
    team_id: UUID | None = None
    organization_scope: str = "organization"


class UserView(BaseModel):
    id: UUID
    name: str
    email: str


class NewUserView(BaseModel):
    user: UserView
    setup_url: str
    expires_at: datetime


class UserTypeOption(BaseModel):
    id: UUID
    name: str


class SessionView(BaseModel):
    user: UserView


class SetupLinkView(BaseModel):
    setup_url: str
    expires_at: datetime


async def database(request: Request) -> AsyncIterator[AsyncSession]:
    async with request.app.state.session_factory() as session:
        session.info["redis"] = request.app.state.redis
        yield session


DB = Annotated[AsyncSession, Depends(database)]


@dataclass
class Principal:
    user: User
    session: LoginSession


def public_user(user: User) -> UserView:
    return UserView(id=user.id, name=user.full_name, email=user.email)


def unauthorized() -> HTTPException:
    return HTTPException(status_code=401, detail="Authentication required")


async def principal(
    db: DB,
    amafh_session: Annotated[str | None, Cookie()] = None,
) -> Principal:
    if not amafh_session:
        raise unauthorized()
    now = datetime.now(timezone.utc)
    settings = get_settings()
    row = (await db.execute(
        select(LoginSession, User)
        .join(User, User.id == LoginSession.user_id)
        .where(LoginSession.token_hash == token_hash(amafh_session))
    )).one_or_none()
    if not row:
        raise unauthorized()
    login_session, user = row
    if login_session.revoked_at or login_session.expires_at <= now or login_session.last_seen_at + timedelta(minutes=settings.session_idle_minutes) <= now or not user.active:
        if not login_session.revoked_at:
            login_session.revoked_at = now
            await db.commit()
        raise unauthorized()
    login_session.last_seen_at = now
    db.sync_session.info["audit_actor_id"] = user.id
    await db.commit()
    return Principal(user=user, session=login_session)


Current = Annotated[Principal, Depends(principal)]


def set_session_cookie(response: Response, token: str) -> None:
    settings = get_settings()
    response.set_cookie(
        key=COOKIE, value=token, httponly=True, secure=settings.session_cookie_secure,
        samesite="lax", path="/", max_age=settings.session_hours * 3600,
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(COOKIE, path="/", secure=get_settings().session_cookie_secure, httponly=True, samesite="lax")


@router.post("/login", response_model=SessionView)
async def login(payload: LoginInput, response: Response, db: DB) -> SessionView:
    email = payload.email.strip().lower()
    limiter = db.info.get("redis")
    if limiter is not None:
        key = "login-attempt:" + hashlib.sha256(email.encode("utf-8")).hexdigest()
        attempts = await limiter.incr(key)
        if attempts == 1:
            await limiter.expire(key, 900)
        if attempts > 10:
            raise HTTPException(status_code=429, detail="Too many login attempts; try again later")
    user = (await db.scalars(select(User).where(func.lower(User.email) == email))).one_or_none()
    if not user or not user.active or not verify_password(payload.password, user.password_hash):
        db.add(AuditLog(actor_id=None, action="login.failed", entity="User",
                        entity_id=str(user.id) if user else None, metadata_json={}))
        await db.commit()
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if limiter is not None:
        await limiter.delete(key)
    token = new_token()
    db.sync_session.info["audit_actor_id"] = user.id
    now = datetime.now(timezone.utc)
    db.add(LoginSession(
        user_id=user.id, token_hash=token_hash(token), created_at=now,
        last_seen_at=now, expires_at=now + timedelta(hours=get_settings().session_hours),
    ))
    await db.commit()
    set_session_cookie(response, token)
    return SessionView(user=public_user(user))


@router.get("/session", response_model=SessionView)
async def restore(current: Current) -> SessionView:
    return SessionView(user=public_user(current.user))


@router.post("/logout")
async def logout(response: Response, current: Current, db: DB) -> dict[str, str]:
    current.session.revoked_at = datetime.now(timezone.utc)
    await db.commit()
    clear_session_cookie(response)
    return {"status": "signed_out"}


@router.post("/logout-all")
async def logout_all(response: Response, current: Current, db: DB) -> dict[str, str]:
    await db.execute(update(LoginSession).where(LoginSession.user_id == current.user.id, LoginSession.revoked_at.is_(None)).values(revoked_at=datetime.now(timezone.utc)))
    db.add(AuditLog(actor_id=current.user.id, action="session.logout_all", entity="Session",
                    entity_id=str(current.user.id), metadata_json={}))
    await db.commit()
    clear_session_cookie(response)
    return {"status": "all_sessions_revoked"}


@router.post("/change-password")
async def change_password(payload: ChangePasswordInput, current: Current, db: DB) -> dict[str, str]:
    if not verify_password(payload.current_password, current.user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    try:
        new_hash = hash_password(payload.new_password)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    current.user.password_hash = new_hash
    db.add(Notification(recipient_id=current.user.id, actor_id=current.user.id,
                        category="system", message="Account password changed"))
    await db.execute(update(LoginSession).where(LoginSession.user_id == current.user.id, LoginSession.id != current.session.id, LoginSession.revoked_at.is_(None)).values(revoked_at=datetime.now(timezone.utc)))
    db.add(AuditLog(actor_id=current.user.id, action="password.change_sessions_revoked", entity="Session",
                    entity_id=str(current.user.id), metadata_json={}))
    await db.commit()
    return {"status": "password_changed"}


async def can_manage_users(db: AsyncSession, user: User) -> bool:
    return await has_permission(db, user, "Users", "edit")


async def has_user_permission(db: AsyncSession, user: User, action: str) -> bool:
    return await has_permission(db, user, "Users", action)


@router.get("/permissions")
async def current_permissions(current: Current, db: DB) -> dict[str, list[dict[str, str]]]:
    actions = await granted_actions(db, current.user)
    return {"permissions": [{"domain": domain, "action": action} for domain, action in sorted(actions)]}


@router.post("/users/{user_id}/setup-link", response_model=SetupLinkView)
async def generate_setup_link(user_id: UUID, current: Current, db: DB) -> SetupLinkView:
    if not await can_manage_users(db, current.user):
        raise HTTPException(status_code=403, detail="Permission required")
    target = (await db.scalars(select(User).where(User.id == user_id).with_for_update())).one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    return await create_setup_link(target, current, db)


@router.post("/setup-link", response_model=SetupLinkView)
async def generate_setup_link_by_email(payload: SetupLinkInput, current: Current, db: DB) -> SetupLinkView:
    if not await can_manage_users(db, current.user):
        raise HTTPException(status_code=403, detail="Permission required")
    target = (await db.scalars(select(User).where(func.lower(User.email) == payload.email.strip().lower()).with_for_update())).one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    return await create_setup_link(target, current, db)


async def create_setup_link(target: User, current: Principal, db: AsyncSession) -> SetupLinkView:
    now = datetime.now(timezone.utc)
    await db.execute(update(PasswordSetupLink).where(PasswordSetupLink.user_id == target.id, PasswordSetupLink.used_at.is_(None), PasswordSetupLink.revoked_at.is_(None)).values(revoked_at=now))
    token = new_token()
    expires_at = now + timedelta(minutes=get_settings().setup_link_minutes)
    db.add(PasswordSetupLink(user_id=target.id, token_hash=token_hash(token), created_by_id=current.user.id, created_at=now, expires_at=expires_at))
    db.add(AuditLog(actor_id=current.user.id, action="password_setup.issue", entity="User",
                    entity_id=str(target.id), metadata_json={"expires_at": expires_at.isoformat()}))
    await db.commit()
    return SetupLinkView(setup_url=f"/set-password?token={token}", expires_at=expires_at)


@router.post("/users", response_model=NewUserView, status_code=201)
async def create_user_for_setup(payload: NewUserInput, current: Current, db: DB) -> NewUserView:
    """Provision an inactive account; only its recipient can activate it with the link."""
    if not await has_user_permission(db, current.user, "create"):
        raise HTTPException(status_code=403, detail="Permission required")
    email = payload.email.strip().lower()
    full_name = payload.full_name.strip()
    if not full_name or "@" not in email or email.startswith("@") or email.endswith("@"):
        raise HTTPException(status_code=422, detail="Valid name and email required")
    user_type = await db.get(UserType, payload.user_type_id)
    if not user_type or not user_type.active:
        raise HTTPException(status_code=422, detail="Select an active user type")
    expected = {"organization": "organization_id", "office": "office_id", "department": "department_id", "team": "team_id"}
    if payload.organization_scope not in expected:
        raise HTTPException(status_code=422, detail="Invalid organization scope")
    ids = [payload.organization_id, payload.office_id, payload.department_id, payload.team_id]
    kinds = ["organizations", "offices", "departments", "teams"]
    prior = None
    for index, unit_id in enumerate(ids):
        if not unit_id:
            if any(ids[index + 1:]):
                raise HTTPException(status_code=422, detail="Organization hierarchy is incomplete")
            break
        unit = await db.get(OrganizationUnit, unit_id)
        if not unit or not unit.active or unit.kind != kinds[index] or (index > 0 and unit.parent_id != prior):
            raise HTTPException(status_code=422, detail="Invalid organization hierarchy")
        prior = unit_id
    if payload.organization_scope != "organization" and getattr(payload, expected[payload.organization_scope]) is None:
        raise HTTPException(status_code=422, detail="Organization scope needs a matching unit")
    target = User(email=email, full_name=full_name, user_type_id=user_type.id,
                  organization_id=payload.organization_id, office_id=payload.office_id,
                  department_id=payload.department_id, team_id=payload.team_id,
                  organization_scope=payload.organization_scope, active=False)
    db.add(target)
    try:
        await db.flush()
        link = await create_setup_link(target, current, db)
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Email is already assigned") from exc
    return NewUserView(user=public_user(target), setup_url=link.setup_url, expires_at=link.expires_at)


@router.get("/user-types", response_model=list[UserTypeOption])
async def available_user_types(current: Current, db: DB) -> list[UserTypeOption]:
    if not await has_user_permission(db, current.user, "create"):
        raise HTTPException(status_code=403, detail="Permission required")
    types = (await db.scalars(select(UserType).where(UserType.active.is_(True)).order_by(UserType.name))).all()
    return [UserTypeOption(id=item.id, name=item.name) for item in types]


@router.get("/users", response_model=list[UserView])
async def selectable_users(current: Current, db: DB) -> list[UserView]:
    if not (await has_permission(db, current.user, "Users", "view") or await has_permission(db, current.user, "Cases", "create") or await has_permission(db, current.user, "Cases", "view") or await has_permission(db, current.user, "Tasks", "view") or await has_permission(db, current.user, "Tasks", "create") or await has_permission(db, current.user, "Finance", "view-commission") or await has_permission(db, current.user, "Finance", "view-incentives")):
        raise HTTPException(status_code=403, detail="Permission required")
    users = (await db.scalars(select(User).where(User.active.is_(True)).order_by(User.full_name, User.id))).all()
    return [public_user(user) for user in users]


@router.post("/setup-password")
async def setup_password(payload: SetupPasswordInput, db: DB) -> dict[str, str]:
    try:
        validate_password(payload.password)
        digest = token_hash(payload.token)
    except (ValueError, UnicodeEncodeError) as exc:
        raise HTTPException(status_code=422, detail="Invalid setup request") from exc
    link = (await db.scalars(select(PasswordSetupLink).where(PasswordSetupLink.token_hash == digest).with_for_update())).one_or_none()
    now = datetime.now(timezone.utc)
    if not link or link.used_at or link.revoked_at or link.expires_at <= now:
        raise HTTPException(status_code=400, detail="Setup link is invalid or expired")
    user = await db.get(User, link.user_id)
    if not user:
        raise HTTPException(status_code=400, detail="Setup link is invalid or expired")
    first_setup = user.password_hash is None
    user.password_hash = hash_password(payload.password)
    if first_setup:
        user.active = True
    link.used_at = now
    await db.execute(update(PasswordSetupLink).where(PasswordSetupLink.user_id == user.id, PasswordSetupLink.id != link.id, PasswordSetupLink.used_at.is_(None), PasswordSetupLink.revoked_at.is_(None)).values(revoked_at=now))
    await db.execute(update(LoginSession).where(LoginSession.user_id == user.id, LoginSession.revoked_at.is_(None)).values(revoked_at=now))
    await db.commit()
    return {"status": "password_set"}
