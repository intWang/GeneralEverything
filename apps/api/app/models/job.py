import uuid
from datetime import datetime
from enum import Enum as PyEnum
import json

from sqlalchemy import DateTime, Enum, String, Text, Uuid, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


def _normalize_summary_structured_item(item: object) -> dict | None:
    if not isinstance(item, dict):
        return None

    text_value = item.get("text")
    if not isinstance(text_value, str):
        return None

    citation_ids = item.get("citation_ids", [])
    if not isinstance(citation_ids, list) or not all(
        isinstance(citation_id, str) for citation_id in citation_ids
    ):
        return None

    return {
        "text": text_value,
        "citation_ids": citation_ids,
    }


def _normalize_summary_structured_items(value: object) -> list[dict] | None:
    if value is None:
        return []

    if not isinstance(value, list):
        return None

    normalized_items: list[dict] = []
    for item in value:
        normalized_item = _normalize_summary_structured_item(item)
        if normalized_item is None:
            return None
        normalized_items.append(normalized_item)

    return normalized_items


def _normalize_summary_citation(citation: object) -> dict | None:
    if not isinstance(citation, dict):
        return None

    citation_id = citation.get("id")
    if not isinstance(citation_id, str):
        return None

    segment_id = citation.get("segment_id")
    if segment_id is not None and not isinstance(segment_id, str):
        return None

    start_seconds = citation.get("start_seconds")
    if start_seconds is not None and not isinstance(start_seconds, int | float):
        return None

    end_seconds = citation.get("end_seconds")
    if end_seconds is not None and not isinstance(end_seconds, int | float):
        return None

    label = citation.get("label")
    if label is not None and not isinstance(label, str):
        return None

    return {
        "id": citation_id,
        "segment_id": segment_id,
        "start_seconds": float(start_seconds) if start_seconds is not None else None,
        "end_seconds": float(end_seconds) if end_seconds is not None else None,
        "label": label,
    }


def _normalize_summary_citations(value: object) -> list[dict] | None:
    if value is None:
        return []

    if not isinstance(value, list):
        return None

    normalized_citations: list[dict] = []
    for citation in value:
        normalized_citation = _normalize_summary_citation(citation)
        if normalized_citation is None:
            return None
        normalized_citations.append(normalized_citation)

    return normalized_citations


def _normalize_summary_structured(value: object) -> dict | None:
    if not isinstance(value, dict):
        return None

    abstract = value.get("abstract")
    if abstract is not None and not isinstance(abstract, str):
        return None

    key_points = _normalize_summary_structured_items(value.get("key_points"))
    action_items = _normalize_summary_structured_items(value.get("action_items"))
    decisions = _normalize_summary_structured_items(value.get("decisions"))
    risks = _normalize_summary_structured_items(value.get("risks"))
    citations = _normalize_summary_citations(value.get("citations"))
    if any(
        normalized_value is None
        for normalized_value in (key_points, action_items, decisions, risks, citations)
    ):
        return None

    return {
        "abstract": abstract,
        "key_points": key_points,
        "action_items": action_items,
        "decisions": decisions,
        "risks": risks,
        "citations": citations,
    }


def _normalize_mindmap_reference(reference: object) -> dict | None:
    if not isinstance(reference, dict):
        return None

    segment_id = reference.get("segment_id")
    if segment_id is not None and not isinstance(segment_id, str):
        return None

    start_seconds = reference.get("start_seconds")
    if start_seconds is not None and not isinstance(start_seconds, int | float):
        return None

    end_seconds = reference.get("end_seconds")
    if end_seconds is not None and not isinstance(end_seconds, int | float):
        return None

    label = reference.get("label")
    if label is not None and not isinstance(label, str):
        return None

    normalized: dict = {
        "segment_id": segment_id,
        "start_seconds": float(start_seconds) if start_seconds is not None else None,
        "end_seconds": float(end_seconds) if end_seconds is not None else None,
        "label": label,
    }

    return normalized


def _normalize_mindmap_references(value: object) -> list[dict] | None:
    if value is None:
        return []

    if not isinstance(value, list):
        return None

    normalized_references: list[dict] = []
    for reference in value:
        normalized_reference = _normalize_mindmap_reference(reference)
        if normalized_reference is None:
            return None
        normalized_references.append(normalized_reference)

    return normalized_references


MAX_MINDMAP_NODE_DEPTH = 64


def _normalize_mindmap_node(value: object, depth: int = 0) -> dict | None:
    if depth > MAX_MINDMAP_NODE_DEPTH:
        return None

    if not isinstance(value, dict):
        return None

    node_id = value.get("id")
    label = value.get("label")
    if not isinstance(node_id, str) or not isinstance(label, str):
        return None

    summary = value.get("summary")
    if summary is not None and not isinstance(summary, str):
        return None

    children_value = value.get("children", [])
    if not isinstance(children_value, list):
        return None

    references = _normalize_mindmap_references(value.get("references"))
    if references is None:
        return None

    children: list[dict] = []
    for child in children_value:
        normalized_child = _normalize_mindmap_node(child, depth + 1)
        if normalized_child is None:
            return None
        children.append(normalized_child)

    normalized_node = {
        "id": node_id,
        "label": label,
        "children": children,
        "references": references,
    }
    if summary is not None:
        normalized_node["summary"] = summary

    return normalized_node


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
    download_progress_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    download_formats_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    diagnostics_json: Mapped[str | None] = mapped_column(Text, nullable=True)
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
    summary_structured_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary_translations_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary_key_points_count: Mapped[int | None] = mapped_column(nullable=True)
    mindmap_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    mindmap_preview_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    mindmap_nodes_json: Mapped[str | None] = mapped_column(Text, nullable=True)
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

    def has_public_video_metadata(self) -> bool:
        return self.input_mode == InputMode.PUBLIC_VIDEO and any(
            (
                self.duration_seconds is not None,
                self.thumbnail_url,
                self.source_name,
                self.description,
            )
        )

    def reset_pipeline_for_retry(self) -> None:
        self.status = JobStatus.QUEUED
        self.stage = "metadata_ready" if self.has_public_video_metadata() else "queued"
        self.download_status = None
        self.download_executor = None
        self.download_format_id = None
        self.download_format_label = None
        self.download_artifact_path = None
        self.download_progress_json = None
        self.download_formats_json = None
        self.diagnostics_json = None
        self.transcript_status = None
        self.transcript_extractor = None
        self.transcript_audio_artifact_path = None
        self.detected_language_code = None
        self.detected_language_name = None
        self.transcript_preview_text = None
        self.transcript_source_text = None
        self.transcript_source_segments_json = None
        self.transcript_translations_json = None
        self.transcript_segment_count = None
        self.summary_status = None
        self.summary_preview_text = None
        self.summary_source_text = None
        self.summary_source_bullets_json = None
        self.summary_structured_json = None
        self.summary_translations_json = None
        self.summary_key_points_count = None
        self.mindmap_status = None
        self.mindmap_preview_text = None
        self.mindmap_nodes_json = None
        self.mindmap_node_count = None

    @property
    def transcript_translations(self) -> dict[str, str] | None:
        if not self.transcript_translations_json:
            return None

        return json.loads(self.transcript_translations_json)

    @property
    def transcript_source_segments(self) -> list[dict] | None:
        if not self.transcript_source_segments_json:
            return None

        try:
            source_segments = json.loads(self.transcript_source_segments_json)
        except (json.JSONDecodeError, TypeError):
            return None

        if not isinstance(source_segments, list):
            return None

        normalized_segments: list[dict] = []
        for index, segment in enumerate(source_segments, start=1):
            if not isinstance(segment, dict):
                continue

            text_value = segment.get("text")
            if not isinstance(text_value, str):
                continue

            start_seconds = segment.get("start_seconds", segment.get("start"))
            end_seconds = segment.get("end_seconds", segment.get("end"))
            if not isinstance(start_seconds, int | float) or not isinstance(
                end_seconds,
                int | float,
            ):
                continue

            segment_id = segment.get("id")
            normalized_segments.append(
                {
                    "id": segment_id if isinstance(segment_id, str) else f"segment-{index}",
                    "start_seconds": float(start_seconds),
                    "end_seconds": float(end_seconds),
                    "text": text_value,
                }
            )

        return normalized_segments or None

    @property
    def download_progress(self) -> dict | None:
        if not self.download_progress_json:
            return None

        return json.loads(self.download_progress_json)

    @property
    def download_formats(self) -> list[dict] | None:
        if not self.download_formats_json:
            return None

        return json.loads(self.download_formats_json)

    @property
    def diagnostics(self) -> list[dict] | None:
        if not self.diagnostics_json:
            return None

        return json.loads(self.diagnostics_json)

    @property
    def summary_source_bullets(self) -> list[str] | None:
        if not self.summary_source_bullets_json:
            return None

        try:
            source_bullets = json.loads(self.summary_source_bullets_json)
        except (json.JSONDecodeError, TypeError):
            return None

        return source_bullets if isinstance(source_bullets, list) else None

    @property
    def summary_structured(self) -> dict | None:
        if not self.summary_structured_json:
            return None

        try:
            structured_summary = json.loads(self.summary_structured_json)
        except (json.JSONDecodeError, TypeError):
            return None

        return _normalize_summary_structured(structured_summary)

    @property
    def summary_translations(self) -> dict[str, str] | None:
        if not self.summary_translations_json:
            return None

        return json.loads(self.summary_translations_json)

    @property
    def mindmap_nodes(self) -> dict | None:
        if not self.mindmap_nodes_json:
            return None

        try:
            mindmap_nodes = json.loads(self.mindmap_nodes_json)
        except (RecursionError, json.JSONDecodeError, TypeError):
            return None

        try:
            return _normalize_mindmap_node(mindmap_nodes)
        except RecursionError:
            return None
