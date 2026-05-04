import uuid
from datetime import datetime
from enum import Enum as PyEnum
import json

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
    detected_language_code: Mapped[str | None] = mapped_column(String(16), nullable=True)
    detected_language_name: Mapped[str | None] = mapped_column(String(64), nullable=True)
    transcript_preview_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    transcript_source_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    transcript_source_segments_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    transcript_translations_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    transcript_segment_count: Mapped[int | None] = mapped_column(nullable=True)
    summary_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    summary_preview_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary_source_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary_source_bullets_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary_translations_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary_key_points_count: Mapped[int | None] = mapped_column(nullable=True)
    mindmap_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    mindmap_preview_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    mindmap_node_count: Mapped[int | None] = mapped_column(nullable=True)
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

    @property
    def transcript_translations(self) -> dict[str, str] | None:
        if not self.transcript_translations_json:
            return None

        return json.loads(self.transcript_translations_json)

    @property
    def summary_source_bullets(self) -> list[str] | None:
        if not self.summary_source_bullets_json:
            return None

        return json.loads(self.summary_source_bullets_json)

    @property
    def summary_translations(self) -> dict[str, str] | None:
        if not self.summary_translations_json:
            return None

        return json.loads(self.summary_translations_json)
