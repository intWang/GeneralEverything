from datetime import datetime
import uuid

from pydantic import BaseModel, ConfigDict, HttpUrl

from app.models import InputMode, JobStatus


class CreateJobRequest(BaseModel):
    source_url: HttpUrl


class AskJobQuestionRequest(BaseModel):
    question: str


class AskJobQuestionResponse(BaseModel):
    answer: str
    grounded: bool
    job_id: uuid.UUID
    question: str
    references: list[str]


class TranslateJobContentRequest(BaseModel):
    content_type: str
    target_language_code: str


class TranslateJobContentResponse(BaseModel):
    content_type: str
    job_id: uuid.UUID
    source_language_code: str
    target_language_code: str
    translated_text: str


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
    detected_language_code: str | None
    detected_language_name: str | None
    transcript_preview_text: str | None
    transcript_source_text: str | None
    transcript_translations: dict[str, str] | None = None
    transcript_segment_count: int | None
    summary_status: str | None
    summary_preview_text: str | None
    summary_source_text: str | None
    summary_source_bullets: list[str] | None = None
    summary_translations: dict[str, str] | None = None
    summary_key_points_count: int | None
    mindmap_status: str | None
    mindmap_preview_text: str | None
    mindmap_node_count: int | None
    status: JobStatus
    stage: str
    created_at: datetime
