"""Server-side permissions; a User Type has no implicit rights."""

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Permission, User, UserType, UserTypePermission


async def granted_actions(db: AsyncSession, user: User) -> set[tuple[str, str]]:
    if not user.active:
        return set()
    rows = await db.execute(
        select(Permission.domain, Permission.action)
        .join(UserTypePermission, UserTypePermission.permission_id == Permission.id)
        .join(UserType, UserType.id == UserTypePermission.user_type_id)
        .where(UserType.id == user.user_type_id, UserType.active.is_(True), Permission.enabled.is_(True))
    )
    return set(rows.all())


async def has_permission(db: AsyncSession, user: User, domain: str, action: str) -> bool:
    return (domain, action) in await granted_actions(db, user)


async def require_permission(db: AsyncSession, user: User, domain: str, action: str) -> None:
    if not await has_permission(db, user, domain, action):
        raise HTTPException(status_code=403, detail="Permission required")
