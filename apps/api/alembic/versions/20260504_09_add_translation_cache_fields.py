"""add translation cache fields

Revision ID: 20260504_09
Revises: 20260504_08
Create Date: 2026-05-04 00:00:07
"""

from collections.abc import Sequence
from typing import Optional

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260504_09"
down_revision: Optional[str] = "20260504_08"
branch_labels: Optional[Sequence[str]] = None
depends_on: Optional[Sequence[str]] = None


def upgrade() -> None:
    op.add_column(
        "analysis_jobs",
        sa.Column("transcript_translations_json", sa.Text(), nullable=True),
    )
    op.add_column(
        "analysis_jobs",
        sa.Column("summary_translations_json", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("analysis_jobs", "summary_translations_json")
    op.drop_column("analysis_jobs", "transcript_translations_json")
