"""Read-only schema check plus a rolled-back customer identity constraint probe."""

import asyncio
from uuid import uuid4

from sqlalchemy import inspect, text
from sqlalchemy.exc import IntegrityError

from app.core.config import get_settings
from app.db.session import create_engine


async def main() -> None:
    engine = create_engine(get_settings())
    try:
        async with engine.connect() as connection:
            tables = await connection.run_sync(lambda sync: set(inspect(sync).get_table_names()))
            expected = {
                "users", "user_types", "permissions", "user_type_permissions",
                "organization_units", "banks", "products", "product_variants",
                "product_stages", "customers", "customer_history", "cases",
                "case_history", "case_approvals", "coordinator_assignments",
                "tasks", "task_notes", "notifications", "profile_media",
                "csv_imports", "commission_rules", "commission_records",
                "clawbacks", "incentive_rules", "incentive_records", "audit_logs",
                "sessions", "password_setup_links",
            }
            assert expected <= tables, expected - tables

            await connection.rollback()
            transaction = await connection.begin()
            try:
                statement = text("""
                    INSERT INTO customers
                    (id, kind, full_name, emirates_id, mobile, email, active)
                    VALUES (:id, 'individual', 'Identity probe', :emirates_id, '', '', true)
                """)
                await connection.execute(statement, {"id": uuid4(), "emirates_id": "784-2000-0000000-1"})
                try:
                    await connection.execute(statement, {"id": uuid4(), "emirates_id": "784 2000 0000000 1"})
                except IntegrityError:
                    pass
                else:
                    raise AssertionError("Normalized duplicate Emirates ID was accepted")
            finally:
                await transaction.rollback()
        print(f"Verified {len(expected)} application tables and normalized customer identity uniqueness")
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
