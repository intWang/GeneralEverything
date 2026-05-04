from __future__ import annotations

from uuid import UUID

import pytest

from app.models.job import AnalysisJob, InputMode, JobStatus
from app.services.summaries.public_video import (
    PublicVideoSummaryShellError,
    generate_public_video_summary_shell,
)


def _make_job(
    transcript_preview_text: str | None = "Transcript shell generated for demo.wav.",
) -> AnalysisJob:
    return AnalysisJob(
        id=UUID("12345678-1234-5678-1234-567812345678"),
        input_mode=InputMode.PUBLIC_VIDEO,
        source_url="https://example.com/watch?v=test",
        status=JobStatus.RUNNING,
        stage="transcript_generated",
        transcript_status="ready",
        transcript_preview_text=transcript_preview_text,
        transcript_segment_count=2,
    )


def test_generate_public_video_summary_shell_returns_generated_result() -> None:
    result = generate_public_video_summary_shell(_make_job())

    assert result.status == "ready"
    assert result.stage == "summary_generated"
    assert result.key_points_count == 2
    assert "Transcript shell generated for demo.wav." in (result.preview_text or "")


def test_generate_public_video_summary_shell_requires_transcript_preview() -> None:
    with pytest.raises(PublicVideoSummaryShellError) as exc_info:
        generate_public_video_summary_shell(_make_job(transcript_preview_text=None))

    assert exc_info.value.reason == "missing_transcript_preview"


def test_generate_public_video_summary_shell_requires_ready_transcript() -> None:
    job = _make_job()
    job.transcript_status = "failed"

    with pytest.raises(PublicVideoSummaryShellError) as exc_info:
        generate_public_video_summary_shell(job)

    assert exc_info.value.reason == "transcript_not_ready"
