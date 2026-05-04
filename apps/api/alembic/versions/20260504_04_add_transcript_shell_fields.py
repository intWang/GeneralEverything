"""add transcript shell fields

Revision ID: 20260504_04
Revises: 20260504_03
Create Date: 2026-05-04 00:00:02
"""

from collections.abc import Sequence
from typing import Optional

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260504_04"
down_revision: Optional[str] = "20260504_03"
branch_labels: Optional[Sequence[str]] = None
depends_on: Optional[Sequence[str]] = None


def upgrade() -> None:
    op.add_column(
        "analysis_jobs",
        sa.Column("transcript_status", sa.String(length=32), nullable=True),
    )
    op.add_column(
        "analysis_jobs",
        sa.Column("transcript_extractor", sa.String(length=32), nullable=True),
    )
    op.add_column(
        "analysis_jobs",
        sa.Column("transcript_audio_artifact_path", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("analysis_jobs", "transcript_audio_artifact_path")
    op.drop_column("analysis_jobs", "transcript_extractor")
    op.drop_column("analysis_jobs", "transcript_status")
