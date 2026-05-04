"""add summary shell fields

Revision ID: 20260504_06
Revises: 20260504_05
Create Date: 2026-05-04 00:00:04
"""

from collections.abc import Sequence
from typing import Optional

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260504_06"
down_revision: Optional[str] = "20260504_05"
branch_labels: Optional[Sequence[str]] = None
depends_on: Optional[Sequence[str]] = None


def upgrade() -> None:
    op.add_column(
        "analysis_jobs",
        sa.Column("summary_status", sa.String(length=32), nullable=True),
    )
    op.add_column(
        "analysis_jobs",
        sa.Column("summary_preview_text", sa.Text(), nullable=True),
    )
    op.add_column(
        "analysis_jobs",
        sa.Column("summary_key_points_count", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("analysis_jobs", "summary_key_points_count")
    op.drop_column("analysis_jobs", "summary_preview_text")
    op.drop_column("analysis_jobs", "summary_status")
