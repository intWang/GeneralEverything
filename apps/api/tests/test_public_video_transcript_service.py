from __future__ import annotations

import subprocess
from uuid import UUID

import pytest

from app.models.job import AnalysisJob, InputMode, JobStatus
from app.services.transcripts.public_video import (
    PublicVideoTranscriptExecutionError,
    PublicVideoTranscriptShellError,
    execute_public_video_transcript_shell,
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
        transcript_audio_artifact_path="var/transcripts/public-video/demo.wav",
    )


def test_prepare_public_video_transcript_shell_returns_ready_result() -> None:
    def run_command(command: list[str], **_: object) -> subprocess.CompletedProcess[str]:
        assert command[:4] == ["/tmp/fake-ffmpeg", "-y", "-i", "var/downloads/public-video/demo.mp4"]
        assert command[-1] == "var/transcripts/public-video/12345678-1234-5678-1234-567812345678.wav"
        return subprocess.CompletedProcess(command, 0, stdout="", stderr="")

    result = prepare_public_video_transcript_shell(
        _make_job(),
        ffmpeg_command="/tmp/fake-ffmpeg",
        run_command=run_command,
    )

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


def test_prepare_public_video_transcript_shell_uses_imageio_ffmpeg_fallback(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured_command: list[str] | None = None

    def fake_run(command: list[str], **_: object) -> subprocess.CompletedProcess[str]:
        nonlocal captured_command
        captured_command = command
        return subprocess.CompletedProcess(command, 0, stdout="", stderr="")

    monkeypatch.setattr(
        "app.services.transcripts.public_video.shutil.which",
        lambda tool: None if tool == "ffmpeg" else tool,
    )
    monkeypatch.setattr(
        "app.services.transcripts.public_video._load_imageio_ffmpeg_command",
        lambda: "/tmp/imageio-ffmpeg",
    )

    result = prepare_public_video_transcript_shell(_make_job(), run_command=fake_run)

    assert result.status == "ready"
    assert captured_command is not None
    assert captured_command[0] == "/tmp/imageio-ffmpeg"


def test_execute_public_video_transcript_shell_returns_generated_result() -> None:
    def fake_transcriber(audio_artifact_path: str):
        assert audio_artifact_path == "var/transcripts/public-video/demo.wav"
        return type("TranscriptResult", (), {
            "status": "ready",
            "stage": "transcript_generated",
            "detected_language_code": "en",
            "detected_language_name": "English",
            "source_text": "Hello team, welcome to the meeting.",
            "source_segments": [
                {"start": 0.0, "end": 2.4, "text": "Hello team, welcome to the meeting."},
            ],
            "preview_text": "Hello team, welcome to the meeting.",
            "segment_count": 1,
        })()

    result = execute_public_video_transcript_shell(_make_job(), transcriber=fake_transcriber)

    assert result.status == "ready"
    assert result.stage == "transcript_generated"
    assert result.segment_count == 1
    assert result.detected_language_code == "en"
    assert result.detected_language_name == "English"
    assert result.source_text == "Hello team, welcome to the meeting."
    assert result.preview_text == "Hello team, welcome to the meeting."


def test_execute_public_video_transcript_shell_returns_detected_language_and_source_text() -> None:
    def fake_runner(_job: object):
        return type("TranscriptResult", (), {
            "status": "ready",
            "stage": "transcript_generated",
            "detected_language_code": "zh",
            "detected_language_name": "Chinese",
            "source_text": "大家好，欢迎来到今天的会议。",
            "source_segments": [
                {"start": 0.0, "end": 2.1, "text": "大家好，欢迎来到今天的会议。"},
            ],
            "preview_text": "大家好，欢迎来到今天的会议。",
            "segment_count": 1,
        })()

    result = execute_public_video_transcript_shell(_make_job(), runner=fake_runner)

    assert result.detected_language_code == "zh"
    assert result.detected_language_name == "Chinese"
    assert result.source_text == "大家好，欢迎来到今天的会议。"
    assert result.source_segments == [
        {"start": 0.0, "end": 2.1, "text": "大家好，欢迎来到今天的会议。"},
    ]
    assert result.segment_count == 1


def test_execute_public_video_transcript_shell_requires_audio_artifact() -> None:
    job = _make_job()
    job.transcript_audio_artifact_path = None

    with pytest.raises(PublicVideoTranscriptExecutionError) as exc_info:
        execute_public_video_transcript_shell(job)

    assert exc_info.value.reason == "missing_audio_artifact"


def test_execute_public_video_transcript_shell_requires_ready_transcript_shell() -> None:
    job = _make_job()
    job.transcript_status = "failed"
    job.transcript_audio_artifact_path = "var/transcripts/public-video/demo.wav"

    with pytest.raises(PublicVideoTranscriptExecutionError) as exc_info:
        execute_public_video_transcript_shell(job)

    assert exc_info.value.reason == "transcript_not_ready"


def test_execute_public_video_transcript_shell_allows_processing_state() -> None:
    job = _make_job()
    job.transcript_status = "processing"

    def fake_transcriber(audio_artifact_path: str):
        assert audio_artifact_path == "var/transcripts/public-video/demo.wav"
        return type("TranscriptResult", (), {
            "status": "ready",
            "stage": "transcript_generated",
            "detected_language_code": "zh",
            "detected_language_name": "Chinese",
            "source_text": "大家好，欢迎来到今天的会议。",
            "source_segments": [
                {"start": 0.0, "end": 2.1, "text": "大家好，欢迎来到今天的会议。"},
            ],
            "preview_text": "大家好，欢迎来到今天的会议。",
            "segment_count": 1,
        })()

    result = execute_public_video_transcript_shell(job, transcriber=fake_transcriber)

    assert result.stage == "transcript_generated"
    assert result.detected_language_name == "Chinese"
