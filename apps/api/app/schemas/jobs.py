from datetime import datetime
import uuid

from pydantic import BaseModel, ConfigDict, HttpUrl

from app.models import InputMode, JobStatus


class CreateJobRequest(BaseModel):
    source_url: HttpUrl


class JobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    input_mode: InputMode
    source_url: HttpUrl
    title: str | None
    duration_seconds: int | None
    thumbnail_url: HttpUrl | None
    source_name: str | None
    description: str | None
    download_status: str | None
    download_executor: str | None
    download_format_id: str | None
    download_format_label: str | None
    download_artifact_path: str | None
    transcript_status: str | None
    transcript_extractor: str | None
    transcript_audio_artifact_path: str | None
    status: JobStatus
    stage: str
    created_at: datetime
