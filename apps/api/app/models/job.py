import uuid
from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import DateTime, Enum, String, Text, Uuid, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class InputMode(str, PyEnum):
    PUBLIC_VIDEO = "public_video"
    RINGCENTRAL_RECORDING = "ringcentral_recording"


class JobStatus(str, PyEnum):
    QUEUED = "queued"
    RUNNING = "running"
    FAILED = "failed"
    COMPLETED = "completed"


class AnalysisJob(Base):
    __tablename__ = "analysis_jobs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    input_mode: Mapped[InputMode] = mapped_column(
        Enum(InputMode, name="input_mode"),
        nullable=False,
    )
    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration_seconds: Mapped[int | None] = mapped_column(nullable=True)
    thumbnail_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    download_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    download_executor: Mapped[str | None] = mapped_column(String(32), nullable=True)
    download_format_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    download_format_label: Mapped[str | None] = mapped_column(Text, nullable=True)
    download_artifact_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    transcript_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    transcript_extractor: Mapped[str | None] = mapped_column(String(32), nullable=True)
    transcript_audio_artifact_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    transcript_preview_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    transcript_segment_count: Mapped[int | None] = mapped_column(nullable=True)
    summary_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    summary_preview_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary_key_points_count: Mapped[int | None] = mapped_column(nullable=True)
    status: Mapped[JobStatus] = mapped_column(
        Enum(JobStatus, name="job_status"),
        default=JobStatus.QUEUED,
        server_default=text("'queued'"),
        nullable=False,
    )
    stage: Mapped[str] = mapped_column(
        String(64),
        default="queued",
        server_default=text("'queued'"),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.current_timestamp(),
        nullable=False,
    )
