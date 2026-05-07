from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
import json
from typing import Any

from app.models.job import AnalysisJob
from app.services.qa_pipeline import describe_job_qa_shell


CONTENT_TYPE = "text/markdown; charset=utf-8"


@dataclass(frozen=True)
class MarkdownReportExport:
    content_type: str
    filename: str
    generated_at: str
    job_id: str
    markdown: str


def build_markdown_report_export(
    job: AnalysisJob,
    *,
    generated_at: datetime | None = None,
) -> MarkdownReportExport:
    export_time = generated_at or datetime.now(UTC)
    generated_at_text = export_time.isoformat()
    job_id = str(job.id)

    return MarkdownReportExport(
        content_type=CONTENT_TYPE,
        filename=f"get-analysis-{job_id}.md",
        generated_at=generated_at_text,
        job_id=job_id,
        markdown=render_markdown_report(job, generated_at=generated_at_text),
    )


def render_markdown_report(job: AnalysisJob, *, generated_at: str) -> str:
    title = job.title or "Untitled analysis"
    lines = [
        f"# Analysis Report: {title}",
        "",
        f"- Job ID: `{job.id}`",
        f"- Export time: {generated_at}",
        "",
    ]

    lines.extend(_video_metadata_section(job))
    lines.extend(_download_details_section(job))
    lines.extend(_summary_layers_section(job))
    lines.extend(_transcript_timeline_section(job))
    lines.extend(_mindmap_section(job))
    lines.extend(_ask_ai_section(job))
    lines.extend(_references_section(job))

    return "\n".join(lines).rstrip() + "\n"


def _video_metadata_section(job: AnalysisJob) -> list[str]:
    return [
        "## Video metadata",
        "",
        f"- title: {_value(job.title)}",
        f"- source: {_value(job.source_url)}",
        f"- source_name: {_value(job.source_name)}",
        f"- duration: {_format_duration(job.duration_seconds)}",
        f"- description: {_value(job.description)}",
        f"- input_mode: {job.input_mode.value}",
        f"- status: {job.status.value}",
        f"- stage: {job.stage}",
        "",
    ]


def _download_details_section(job: AnalysisJob) -> list[str]:
    download_progress = _safe_json_object(getattr(job, "download_progress_json", None))
    download_formats = _safe_json_list(getattr(job, "download_formats_json", None))
    diagnostics = _safe_json_list(getattr(job, "diagnostics_json", None))
    lines = [
        "## Download/source details",
        "",
        f"- download_status: {_value(job.download_status)}",
        f"- download_executor: {_value(job.download_executor)}",
        "- download_format: "
        f"{_format_download_format(job.download_format_id, job.download_format_label)}",
        f"- download_artifact: {_value(job.download_artifact_path)}",
    ]

    if download_progress:
        lines.extend(["", "### Download progress", ""])
        lines.extend(_json_bullets(download_progress))

    if download_formats:
        lines.extend(["", "### Available formats", ""])
        for item in download_formats:
            if not isinstance(item, dict):
                continue
            label = item.get("format_label") or item.get("format_id") or "format"
            details = ", ".join(
                str(value)
                for value in (
                    item.get("format_id"),
                    item.get("resolution"),
                    item.get("container"),
                    item.get("kind"),
                    item.get("artifact_path"),
                )
                if value
            )
            lines.append(f"- {label}: {details or 'details unavailable'}")

    if diagnostics:
        lines.extend(["", "### Diagnostics", ""])
        for diagnostic in diagnostics:
            if not isinstance(diagnostic, dict):
                continue
            lines.append(
                "- "
                f"{_value(diagnostic.get('reason'))} "
                f"({_value(diagnostic.get('stage'))}): "
                f"{_value(diagnostic.get('message'))} "
                f"Suggestion: {_value(diagnostic.get('suggestion'))}"
            )

    lines.append("")
    return lines


def _summary_layers_section(job: AnalysisJob) -> list[str]:
    lines = ["## Summary layers", ""]

    lines.extend(
        [
            "### summary_source_text",
            "",
            job.summary_source_text or "No summary_source_text is available yet.",
            "",
            "### summary_source_bullets",
            "",
        ]
    )
    if job.summary_source_bullets:
        lines.extend(f"- {bullet}" for bullet in job.summary_source_bullets)
    else:
        lines.append("- No summary_source_bullets are available yet.")

    structured_summary = job.summary_structured
    lines.extend(["", "### summary_structured", ""])
    if structured_summary:
        abstract = structured_summary.get("abstract")
        if abstract:
            lines.extend(["#### Abstract", "", abstract, ""])

        for key, label in (
            ("key_points", "Key Points"),
            ("action_items", "Action Items"),
            ("decisions", "Decisions"),
            ("risks", "Risks"),
        ):
            lines.extend([f"#### {label}", ""])
            items = structured_summary.get(key) or []
            if items:
                for item in items:
                    lines.append(_format_summary_item(item, structured_summary))
            else:
                lines.append("- None recorded.")
            lines.append("")

        citations = structured_summary.get("citations") or []
        if citations:
            lines.extend(["#### Summary citations", ""])
            for citation in citations:
                lines.append(_format_citation_bullet("summary citation", citation))
    else:
        lines.append("No structured summary is available yet.")

    lines.append("")
    return lines


def _transcript_timeline_section(job: AnalysisJob) -> list[str]:
    lines = ["## Transcript timeline", ""]

    segments = job.transcript_source_segments or []
    if segments:
        for segment in segments:
            lines.append(
                f"- [{_format_range(segment.get('start_seconds'), segment.get('end_seconds'))}] "
                f"{segment.get('text')}"
            )
    else:
        lines.append("- No timestamped transcript_source_segments are available yet.")

    lines.extend(["", "### transcript_source_text fallback", ""])
    lines.append(job.transcript_source_text or "No transcript_source_text fallback is available yet.")
    lines.append("")
    return lines


def _mindmap_section(job: AnalysisJob) -> list[str]:
    lines = ["## Mind map", ""]

    if job.mindmap_nodes:
        lines.extend(_render_mindmap_node(job.mindmap_nodes))
    elif job.mindmap_preview_text:
        lines.extend(["### Preview fallback", "", job.mindmap_preview_text])
    else:
        lines.append("No structured mind map or preview fallback is available yet.")

    lines.append("")
    return lines


def _ask_ai_section(job: AnalysisJob) -> list[str]:
    readiness = describe_job_qa_shell(job)
    return [
        "## Ask AI",
        "",
        "Ask AI references are generated on demand for each question.",
        "No persisted ask history yet; this export does not invent prior Q&A.",
        "",
        "### Readiness context",
        "",
        f"- state: {readiness.state}",
        f"- grounding_status: {readiness.grounding_status}",
        f"- answer_placeholder: {readiness.answer_placeholder}",
        f"- can_submit: {str(readiness.can_submit).lower()}",
        "",
    ]


def _references_section(job: AnalysisJob) -> list[str]:
    lines = ["## References and timestamps", ""]
    found_reference = False

    structured_summary = job.summary_structured or {}
    for citation in structured_summary.get("citations") or []:
        found_reference = True
        lines.append(_format_citation_bullet("summary citation", citation))

    for reference in _collect_mindmap_references(job.mindmap_nodes):
        found_reference = True
        lines.append(_format_citation_bullet("mindmap reference", reference))

    for segment in job.transcript_source_segments or []:
        found_reference = True
        lines.append(
            "- transcript segment "
            f"{_value(segment.get('id'))}: "
            f"{_format_range(segment.get('start_seconds'), segment.get('end_seconds'))}"
        )

    if not found_reference:
        lines.append("- No timestamped references are available yet.")

    lines.append("")
    return lines


def _format_summary_item(item: dict[str, Any], structured_summary: dict[str, Any]) -> str:
    citation_ids = item.get("citation_ids") or []
    citations_by_id = {
        citation.get("id"): citation
        for citation in structured_summary.get("citations") or []
        if citation.get("id")
    }
    references = [
        f"{citation_id} ({_format_range(citation.get('start_seconds'), citation.get('end_seconds'))})"
        for citation_id in citation_ids
        if (citation := citations_by_id.get(citation_id))
    ]
    suffix = f" [{'; '.join(references)}]" if references else ""
    return f"- {item.get('text')}{suffix}"


def _render_mindmap_node(node: dict[str, Any], depth: int = 0) -> list[str]:
    indent = "  " * depth
    lines = [f"{indent}- {node.get('label')}"]
    summary = node.get("summary")
    if summary:
        lines.append(f"{indent}  - summary: {summary}")
    for reference in node.get("references") or []:
        lines.append(f"{indent}  - {_format_citation_inline('reference', reference)}")
    for child in node.get("children") or []:
        lines.extend(_render_mindmap_node(child, depth + 1))
    return lines


def _collect_mindmap_references(node: dict[str, Any] | None) -> list[dict[str, Any]]:
    if not node:
        return []

    references = list(node.get("references") or [])
    for child in node.get("children") or []:
        references.extend(_collect_mindmap_references(child))
    return references


def _format_citation_bullet(label: str, citation: dict[str, Any]) -> str:
    identifier = citation.get("id") or citation.get("segment_id") or "reference"
    return f"- {label} {identifier}: {_format_citation_inline('', citation).strip()}"


def _format_citation_inline(label: str, citation: dict[str, Any]) -> str:
    prefix = f"{label}: " if label else ""
    segment = citation.get("segment_id")
    citation_label = citation.get("label")
    details = []
    if segment:
        details.append(f"segment={segment}")
    if citation_label:
        details.append(f"label={citation_label}")
    details.append(_format_range(citation.get("start_seconds"), citation.get("end_seconds")))
    return f"{prefix}{', '.join(details)}"


def _json_bullets(value: dict[str, Any]) -> list[str]:
    return [f"- {key}: {_value(item)}" for key, item in value.items()]


def _safe_json_object(raw_value: str | None) -> dict[str, Any] | None:
    if not raw_value:
        return None

    try:
        value = json.loads(raw_value)
    except (TypeError, ValueError):
        return None

    return value if isinstance(value, dict) else None


def _safe_json_list(raw_value: str | None) -> list[Any] | None:
    if not raw_value:
        return None

    try:
        value = json.loads(raw_value)
    except (TypeError, ValueError):
        return None

    return value if isinstance(value, list) else None


def _format_download_format(format_id: str | None, format_label: str | None) -> str:
    if format_id and format_label:
        return f"{format_id} ({format_label})"
    return _value(format_id or format_label)


def _format_range(start_seconds: object, end_seconds: object) -> str:
    return f"{_format_timestamp(start_seconds)}-{_format_timestamp(end_seconds)}"


def _format_timestamp(total_seconds: object) -> str:
    if not isinstance(total_seconds, int | float):
        return "unknown"

    safe_seconds = max(0, int(total_seconds))
    hours = safe_seconds // 3600
    minutes = (safe_seconds % 3600) // 60
    seconds = safe_seconds % 60
    if hours:
        return f"{hours:02d}:{minutes:02d}:{seconds:02d}"
    return f"{minutes:02d}:{seconds:02d}"


def _format_duration(total_seconds: int | None) -> str:
    if total_seconds is None:
        return "Not available"

    safe_seconds = max(0, int(total_seconds))
    hours = safe_seconds // 3600
    minutes = (safe_seconds % 3600) // 60
    seconds = safe_seconds % 60
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}"


def _value(value: object) -> str:
    if value is None or value == "":
        return "Not available"
    return str(value)
