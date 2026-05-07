from datetime import datetime
import uuid

from pydantic import BaseModel, ConfigDict, Field, HttpUrl

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


class SummaryCitation(BaseModel):
    id: str
    segment_id: str | None = None
    start_seconds: float | None = None
    end_seconds: float | None = None
    label: str | None = None


class SummaryStructuredItem(BaseModel):
    text: str
    citation_ids: list[str] = Field(default_factory=list)


class StructuredSummary(BaseModel):
    abstract: str | None = None
    key_points: list[SummaryStructuredItem] = Field(default_factory=list)
    action_items: list[SummaryStructuredItem] = Field(default_factory=list)
    decisions: list[SummaryStructuredItem] = Field(default_factory=list)
    risks: list[SummaryStructuredItem] = Field(default_factory=list)
    citations: list[SummaryCitation] = Field(default_factory=list)


class MindMapReference(BaseModel):
    segment_id: str | None = None
    start_seconds: float | None = None
    end_seconds: float | None = None
    label: str | None = None


class MindMapNode(BaseModel):
    id: str
    label: str
    summary: str | None = None
    children: list["MindMapNode"] = Field(default_factory=list)
    references: list[MindMapReference] = Field(default_factory=list)


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
    download_progress: dict | None = None
    download_formats: list[dict] | None = None
    diagnostics: list[dict] | None = None
    transcript_status: str | None
    transcript_extractor: str | None
    transcript_audio_artifact_path: str | None
    detected_language_code: str | None
    detected_language_name: str | None
    transcript_preview_text: str | None
    transcript_source_text: str | None
    transcript_source_segments: list[dict] | None = None
    transcript_translations: dict[str, str] | None = None
    transcript_segment_count: int | None
    summary_status: str | None
    summary_preview_text: str | None
    summary_source_text: str | None
    summary_source_bullets: list[str] | None = None
    summary_structured: StructuredSummary | None = None
    summary_translations: dict[str, str] | None = None
    summary_key_points_count: int | None
    mindmap_status: str | None
    mindmap_preview_text: str | None
    mindmap_nodes: MindMapNode | None = None
    mindmap_node_count: int | None
    status: JobStatus
    stage: str
    created_at: datetime
