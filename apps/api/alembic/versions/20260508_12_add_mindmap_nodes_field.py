"""Add structured mind map nodes JSON field."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260508_12"
down_revision = "20260508_11"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "analysis_jobs",
        sa.Column("mindmap_nodes_json", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("analysis_jobs", "mindmap_nodes_json")
