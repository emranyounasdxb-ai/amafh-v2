"""One-time repair of the isolated auth browser fixture after server authorization."""

import asyncio
from sqlalchemy import select

from app.core.config import get_settings
from app.db.models import Permission, User, UserTypePermission
from app.db.session import create_engine, create_session_factory


async def main():
    engine = create_engine(get_settings())
    try:
        async with create_session_factory(engine)() as db:
            owner = (await db.scalars(select(User).where(User.email == "owner-auth-check@example.test"))).one()
            permission = (await db.scalars(select(Permission).where(Permission.domain == "Users", Permission.action == "view"))).one_or_none()
            if not permission:
                permission = Permission(domain="Users", action="view", description="View users", enabled=True)
                db.add(permission)
                await db.flush()
            if not await db.get(UserTypePermission, (owner.user_type_id, permission.id)):
                db.add(UserTypePermission(user_type_id=owner.user_type_id, permission_id=permission.id))
            await db.commit()
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
