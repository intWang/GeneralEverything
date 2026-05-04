"""add download shell fields

Revision ID: 20260504_03
Revises: 20260504_02
Create Date: 2026-05-04 00:00:01
"""

from collections.abc import Sequence
from typing import Optional

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260504_03"
down_revision: Optional[str] = "20260504_02"
branch_labels: Optional[Sequence[str]] = None
depends_on: Optional[Sequence[str]] = None


def upgrade() -> None:
    op.add_column(
        "analysis_jobs",
        sa.Column("download_status", sa.String(length=32), nullable=True),
    )
    op.add_column(
        "analysis_jobs",
        sa.Column("download_executor", sa.String(length=32), nullable=True),
    )
    op.add_column(
        "analysis_jobs",
        sa.Column("download_format_id", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "analysis_jobs",
        sa.Column("download_format_label", sa.Text(), nullable=True),
    )
    op.add_column(
        "analysis_jobs",
        sa.Column("download_artifact_path", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("analysis_jobs", "download_artifact_path")
    op.drop_column("analysis_jobs", "download_format_label")
    op.drop_column("analysis_jobs", "download_format_id")
    op.drop_column("analysis_jobs", "download_executor")
    op.drop_column("analysis_jobs", "download_status")
