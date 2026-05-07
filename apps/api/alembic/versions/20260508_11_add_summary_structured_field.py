"""Add structured summary JSON field."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260508_11"
down_revision = "20260507_10"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "analysis_jobs",
        sa.Column("summary_structured_json", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("analysis_jobs", "summary_structured_json")
