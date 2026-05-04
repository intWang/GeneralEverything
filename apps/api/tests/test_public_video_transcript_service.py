from __future__ import annotations

from uuid import UUID

import pytest

from app.models.job import AnalysisJob, InputMode, JobStatus
from app.services.transcripts.public_video import (
    PublicVideoTranscriptShellError,
    prepare_public_video_transcript_shell,
)


def _make_job(download_artifact_path: str | None = "var/downloads/public-video/demo.mp4") -> AnalysisJob:
    return AnalysisJob(
        id=UUID("12345678-1234-5678-1234-567812345678"),
        input_mode=InputMode.PUBLIC_VIDEO,
        source_url="https://example.com/watch?v=test",
        status=JobStatus.RUNNING,
        stage="download_ready",
        download_artifact_path=download_artifact_path,
    )


def test_prepare_public_video_transcript_shell_returns_ready_result() -> None:
    result = prepare_public_video_transcript_shell(_make_job())

    assert result.status == "ready"
    assert result.stage == "transcript_ready"
    assert result.extractor == "ffmpeg"
    assert (
        result.audio_artifact_path
        == "var/transcripts/public-video/12345678-1234-5678-1234-567812345678.wav"
    )


def test_prepare_public_video_transcript_shell_requires_download_artifact() -> None:
    with pytest.raises(PublicVideoTranscriptShellError) as exc_info:
        prepare_public_video_transcript_shell(_make_job(download_artifact_path=None))

    assert exc_info.value.reason == "missing_download_artifact"
