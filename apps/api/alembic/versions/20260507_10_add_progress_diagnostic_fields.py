"""add progress diagnostic fields

Revision ID: 20260507_10
Revises: 20260504_09
Create Date: 2026-05-07 00:00:10
"""

from collections.abc import Sequence
from typing import Optional

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260507_10"
down_revision: Optional[str] = "20260504_09"
branch_labels: Optional[Sequence[str]] = None
depends_on: Optional[Sequence[str]] = None


def upgrade() -> None:
    op.add_column(
        "analysis_jobs",
        sa.Column("download_progress_json", sa.Text(), nullable=True),
    )
    op.add_column(
        "analysis_jobs",
        sa.Column("download_formats_json", sa.Text(), nullable=True),
    )
    op.add_column(
        "analysis_jobs",
        sa.Column("diagnostics_json", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("analysis_jobs", "diagnostics_json")
    op.drop_column("analysis_jobs", "download_formats_json")
    op.drop_column("analysis_jobs", "download_progress_json")
