"""Unique incentive rule names and per-user period assignments.

Revision ID: d7f8a4e260b3
Revises: c9e2f50b71a4
"""

from alembic import op
import sqlalchemy as sa

revision = "d7f8a4e260b3"
down_revision = "c9e2f50b71a4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index("uq_incentive_rule_name_ci", "incentive_rules", [sa.text("lower(name)")], unique=True)
    op.create_unique_constraint("uq_incentive_user_period_rule", "incentive_records",
                                ["user_id", "period_kind", "period_start", "rule_id"])


def downgrade() -> None:
    op.drop_constraint("uq_incentive_user_period_rule", "incentive_records", type_="unique")
    op.drop_index("uq_incentive_rule_name_ci", table_name="incentive_rules")
