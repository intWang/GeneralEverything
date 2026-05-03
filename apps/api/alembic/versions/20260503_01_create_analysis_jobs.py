"""create analysis jobs

Revision ID: 20260503_01
Revises:
Create Date: 2026-05-03 00:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260503_01"
down_revision: str | None = None
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None

input_mode_enum = sa.Enum(
    "public_video",
    "ringcentral_recording",
    name="input_mode",
)
job_status_enum = sa.Enum(
    "queued",
    "running",
    "failed",
    "completed",
    name="job_status",
)


def upgrade() -> None:
    bind = op.get_bind()
    input_mode_enum.create(bind, checkfirst=True)
    job_status_enum.create(bind, checkfirst=True)
    op.create_table(
        "analysis_jobs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("input_mode", input_mode_enum, nullable=False),
        sa.Column("source_url", sa.Text(), nullable=False),
        sa.Column(
            "status",
            job_status_enum,
            nullable=False,
            server_default="queued",
        ),
        sa.Column(
            "stage",
            sa.String(length=64),
            nullable=False,
            server_default="queued",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("analysis_jobs")
    bind = op.get_bind()
    job_status_enum.drop(bind, checkfirst=True)
    input_mode_enum.drop(bind, checkfirst=True)
