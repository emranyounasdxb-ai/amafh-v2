"""Run database integration scripts against individually migrated temporary databases."""

import asyncio
import os
import subprocess
import sys
from uuid import uuid4

import asyncpg

SCRIPTS = (
    "check_auth_flow.py",
    "check_auth_expiry.py",
    "check_authorization.py",
    "check_user_account_setup.py",
    "check_organization_flow.py",
    "check_case_lifecycle.py",
    "check_complete_flow.py",
    "check_customer_flow.py",
    "check_product_stage_flow.py",
    "check_profile_media_flow.py",
    "check_csv_import_flow.py",
    "check_notifications_flow.py",
    "check_tasks_flow.py",
    "check_commission_flow.py",
    "check_incentive_flow.py",
    "check_reports_flow.py",
    "check_audit_flow.py",
    "check_security_baseline.py",
    "check_live_schema.py",
)


async def create_database(name: str) -> None:
    connection = await asyncpg.connect(
        user=os.environ["POSTGRES_USER"], password=os.environ["POSTGRES_PASSWORD"],
        host=os.getenv("POSTGRES_HOST", "localhost"), port=int(os.getenv("POSTGRES_PORT", "5432")),
        database="postgres",
    )
    try:
        await connection.execute(f'CREATE DATABASE "{name}"')
    finally:
        await connection.close()


def main() -> None:
    auth_database = ""
    for script in SCRIPTS:
        if script == "check_auth_expiry.py":
            name = auth_database
        else:
            name = "ci_" + uuid4().hex[:20]
            asyncio.run(create_database(name))
        if script == "check_auth_flow.py":
            auth_database = name
        environment = {**os.environ, "POSTGRES_DB": name}
        subprocess.run(["alembic", "upgrade", "head"], env=environment, check=True)
        subprocess.run([sys.executable, "tests/" + script], env=environment, check=True)
        print(f"Passed {script} on isolated database {name}", flush=True)


if __name__ == "__main__":
    main()
