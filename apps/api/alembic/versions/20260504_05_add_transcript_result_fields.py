"""add transcript result fields

Revision ID: 20260504_05
Revises: 20260504_04
Create Date: 2026-05-04 00:00:03
"""

from collections.abc import Sequence
from typing import Optional

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260504_05"
down_revision: Optional[str] = "20260504_04"
branch_labels: Optional[Sequence[str]] = None
depends_on: Optional[Sequence[str]] = None


def upgrade() -> None:
    op.add_column(
        "analysis_jobs",
        sa.Column("transcript_preview_text", sa.Text(), nullable=True),
    )
    op.add_column(
        "analysis_jobs",
        sa.Column("transcript_segment_count", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("analysis_jobs", "transcript_segment_count")
    op.drop_column("analysis_jobs", "transcript_preview_text")
