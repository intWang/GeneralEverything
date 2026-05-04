"""add job metadata fields

Revision ID: 20260504_02
Revises: 20260503_01
Create Date: 2026-05-04 00:00:00
"""

from collections.abc import Sequence
from typing import Optional

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260504_02"
down_revision: Optional[str] = "20260503_01"
branch_labels: Optional[Sequence[str]] = None
depends_on: Optional[Sequence[str]] = None


def upgrade() -> None:
    op.add_column("analysis_jobs", sa.Column("title", sa.Text(), nullable=True))
    op.add_column(
        "analysis_jobs",
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
    )
    op.add_column("analysis_jobs", sa.Column("thumbnail_url", sa.Text(), nullable=True))
    op.add_column("analysis_jobs", sa.Column("source_name", sa.Text(), nullable=True))
    op.add_column("analysis_jobs", sa.Column("description", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("analysis_jobs", "description")
    op.drop_column("analysis_jobs", "source_name")
    op.drop_column("analysis_jobs", "thumbnail_url")
    op.drop_column("analysis_jobs", "duration_seconds")
    op.drop_column("analysis_jobs", "title")
