from __future__ import annotations

from uuid import UUID

import pytest

from app.models.job import AnalysisJob, InputMode, JobStatus
from app.services.mindmaps.public_video import (
    PublicVideoMindMapShellError,
    generate_public_video_mindmap_shell,
)


def _make_job(
    summary_preview_text: str | None = "Summary shell generated from transcript preview.",
) -> AnalysisJob:
    return AnalysisJob(
        id=UUID("12345678-1234-5678-1234-567812345678"),
        input_mode=InputMode.PUBLIC_VIDEO,
        source_url="https://example.com/watch?v=test",
        status=JobStatus.RUNNING,
        stage="summary_generated",
        summary_status="ready",
        summary_preview_text=summary_preview_text,
        summary_key_points_count=2,
    )


def test_generate_public_video_mindmap_shell_returns_generated_result() -> None:
    result = generate_public_video_mindmap_shell(_make_job())

    assert result.status == "ready"
    assert result.stage == "mindmap_generated"
    assert result.node_count == 2
    assert "Summary shell generated from transcript preview." in (result.preview_text or "")


def test_generate_public_video_mindmap_shell_requires_summary_preview() -> None:
    with pytest.raises(PublicVideoMindMapShellError) as exc_info:
        generate_public_video_mindmap_shell(_make_job(summary_preview_text=None))

    assert exc_info.value.reason == "missing_summary_preview"


def test_generate_public_video_mindmap_shell_requires_ready_summary() -> None:
    job = _make_job()
    job.summary_status = "failed"

    with pytest.raises(PublicVideoMindMapShellError) as exc_info:
        generate_public_video_mindmap_shell(job)

    assert exc_info.value.reason == "summary_not_ready"
