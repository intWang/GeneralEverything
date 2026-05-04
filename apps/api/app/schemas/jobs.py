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
    status: JobStatus
    stage: str
    created_at: datetime
