"""add multilingual source fields

Revision ID: 20260504_08
Revises: 20260504_07
Create Date: 2026-05-04 00:00:06
"""

from collections.abc import Sequence
from typing import Optional

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260504_08"
down_revision: Optional[str] = "20260504_07"
branch_labels: Optional[Sequence[str]] = None
depends_on: Optional[Sequence[str]] = None


def upgrade() -> None:
    op.add_column(
        "analysis_jobs",
        sa.Column("detected_language_code", sa.String(length=16), nullable=True),
    )
    op.add_column(
        "analysis_jobs",
        sa.Column("detected_language_name", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "analysis_jobs",
        sa.Column("transcript_source_text", sa.Text(), nullable=True),
    )
    op.add_column(
        "analysis_jobs",
        sa.Column("transcript_source_segments_json", sa.Text(), nullable=True),
    )
    op.add_column(
        "analysis_jobs",
        sa.Column("summary_source_text", sa.Text(), nullable=True),
    )
    op.add_column(
        "analysis_jobs",
        sa.Column("summary_source_bullets_json", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("analysis_jobs", "summary_source_bullets_json")
    op.drop_column("analysis_jobs", "summary_source_text")
    op.drop_column("analysis_jobs", "transcript_source_segments_json")
    op.drop_column("analysis_jobs", "transcript_source_text")
    op.drop_column("analysis_jobs", "detected_language_name")
    op.drop_column("analysis_jobs", "detected_language_code")
