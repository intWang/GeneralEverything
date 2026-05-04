from __future__ import annotations

import subprocess
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
        download_status="ready",
        download_artifact_path=download_artifact_path,
    )


def test_prepare_public_video_transcript_shell_returns_ready_result() -> None:
    def run_command(command: list[str], **_: object) -> subprocess.CompletedProcess[str]:
        assert command[:4] == ["ffmpeg", "-y", "-i", "var/downloads/public-video/demo.mp4"]
        assert command[-1] == "var/transcripts/public-video/12345678-1234-5678-1234-567812345678.wav"
        return subprocess.CompletedProcess(command, 0, stdout="", stderr="")

    result = prepare_public_video_transcript_shell(_make_job(), run_command=run_command)

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


def test_prepare_public_video_transcript_shell_requires_ready_download() -> None:
    job = _make_job()
    job.download_status = "failed"

    with pytest.raises(PublicVideoTranscriptShellError) as exc_info:
        prepare_public_video_transcript_shell(job)

    assert exc_info.value.reason == "download_not_ready"


def test_prepare_public_video_transcript_shell_normalizes_missing_ffmpeg() -> None:
    def run_command(_command: list[str], **_: object) -> subprocess.CompletedProcess[str]:
        raise FileNotFoundError("ffmpeg")

    with pytest.raises(PublicVideoTranscriptShellError) as exc_info:
        prepare_public_video_transcript_shell(_make_job(), run_command=run_command)

    assert exc_info.value.reason == "tool_missing"


def test_prepare_public_video_transcript_shell_normalizes_ffmpeg_failure() -> None:
    def run_command(command: list[str], **_: object) -> subprocess.CompletedProcess[str]:
        return subprocess.CompletedProcess(command, 1, stdout="", stderr="ffmpeg failed")

    with pytest.raises(PublicVideoTranscriptShellError) as exc_info:
        prepare_public_video_transcript_shell(_make_job(), run_command=run_command)

    assert exc_info.value.reason == "extraction_failed"
