from __future__ import annotations

import asyncio
from pathlib import Path
from subprocess import CompletedProcess
from types import SimpleNamespace
from uuid import UUID

import pytest

from app.models.job import AnalysisJob, InputMode, JobStatus
from app.services.downloads.public_video import (
    PublicVideoDownloadError,
    execute_public_video_download_shell,
    plan_public_video_download_shell,
)
from app.tasks import process_analysis_job


def _make_job(stage: str = "metadata_ready", status: JobStatus = JobStatus.RUNNING) -> AnalysisJob:
    return AnalysisJob(
        id=UUID("12345678-1234-5678-1234-567812345678"),
        input_mode=InputMode.PUBLIC_VIDEO,
        source_url="https://example.com/watch?v=test",
        status=status,
        stage=stage,
        title="Example video",
    )


def test_plan_public_video_download_shell_returns_structured_plan() -> None:
    shell = plan_public_video_download_shell(_make_job())

    assert shell.status == "queued"
    assert shell.stage == "queued_download"
    assert shell.executor == "yt-dlp"
    assert shell.format_id == "best"
    assert shell.format_label == "Best available"
    assert shell.artifact_path == "var/downloads/public-video/12345678-1234-5678-1234-567812345678.%(ext)s"


def test_execute_public_video_download_shell_returns_ready_result(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    job = _make_job()
    planned = plan_public_video_download_shell(job, download_root=tmp_path)

    def fake_run(*_args, **_kwargs) -> CompletedProcess[str]:
        return CompletedProcess(
            args=["python", "-m", "yt_dlp"],
            returncode=0,
            stdout=str(tmp_path / "artifact.mp4") + "\n",
            stderr="",
        )

    monkeypatch.setattr("app.services.downloads.public_video.subprocess.run", fake_run)
    monkeypatch.setattr(
        "app.services.downloads.public_video._resolve_yt_dlp_command",
        lambda: ["python", "-m", "yt_dlp"],
    )

    result = execute_public_video_download_shell(job, planned=planned, download_root=tmp_path)

    assert result.status == "ready"
    assert result.stage == "download_ready"
    assert result.executor == "yt-dlp"
    assert result.artifact_path == str(tmp_path / "artifact.mp4")


def test_execute_public_video_download_shell_normalizes_missing_tool(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    job = _make_job()

    def fake_run(*_args, **_kwargs) -> CompletedProcess[str]:
        raise FileNotFoundError("yt-dlp")

    monkeypatch.setattr("app.services.downloads.public_video.subprocess.run", fake_run)
    monkeypatch.setattr(
        "app.services.downloads.public_video._resolve_yt_dlp_command",
        lambda: ["yt-dlp"],
    )

    with pytest.raises(PublicVideoDownloadError) as exc_info:
        execute_public_video_download_shell(job, download_root=tmp_path)

    assert exc_info.value.reason == "tool_missing"


def test_execute_public_video_download_shell_normalizes_non_zero_exit(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    job = _make_job()

    def fake_run(*_args, **_kwargs) -> CompletedProcess[str]:
        return CompletedProcess(
            args=["yt-dlp"],
            returncode=1,
            stdout="",
            stderr="download failed",
        )

    monkeypatch.setattr("app.services.downloads.public_video.subprocess.run", fake_run)
    monkeypatch.setattr(
        "app.services.downloads.public_video._resolve_yt_dlp_command",
        lambda: ["python", "-m", "yt_dlp"],
    )

    with pytest.raises(PublicVideoDownloadError) as exc_info:
        execute_public_video_download_shell(job, download_root=tmp_path)

    assert exc_info.value.reason == "download_failed"
    assert "download failed" in exc_info.value.message


def test_execute_public_video_download_shell_uses_python_module_fallback(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    job = _make_job()
    captured_command: list[str] | None = None

    def fake_run(command: list[str], **_kwargs) -> CompletedProcess[str]:
        nonlocal captured_command
        captured_command = command
        return CompletedProcess(
            args=command,
            returncode=0,
            stdout=str(tmp_path / "artifact.mp4") + "\n",
            stderr="",
        )

    monkeypatch.setattr("app.services.downloads.public_video.subprocess.run", fake_run)
    monkeypatch.setattr(
        "app.services.downloads.public_video._resolve_yt_dlp_command",
        lambda: ["python", "-m", "yt_dlp"],
    )

    execute_public_video_download_shell(job, download_root=tmp_path)

    assert captured_command is not None
    assert captured_command[:3] == ["python", "-m", "yt_dlp"]


def test_process_analysis_job_persists_download_shell_result(tmp_path: Path) -> None:
    calls: list[tuple[str, object]] = []
    persisted_jobs = []
    job = _make_job()
    planned_download = plan_public_video_download_shell(job, download_root=tmp_path)

    def publish(event_name: str, payload: dict) -> None:
        calls.append((event_name, payload))

    def load_job(requested_job_id: UUID) -> AnalysisJob:
        assert requested_job_id == job.id
        return job

    def persist_job(updated_job: AnalysisJob) -> None:
        persisted_jobs.append((updated_job.download_status, updated_job.stage))

    def execute_download(_job: AnalysisJob, planned=None):
        assert planned is planned_download
        return SimpleNamespace(
            status="ready",
            stage="download_ready",
            executor="yt-dlp",
            format_id="best",
            format_label="Best available",
            artifact_path=str(tmp_path / "artifact.mp4"),
            model_dump=lambda: {
                "status": "ready",
                "stage": "download_ready",
                "executor": "yt-dlp",
                "format_id": "best",
                "format_label": "Best available",
                "artifact_path": str(tmp_path / "artifact.mp4"),
            },
        )

    def prepare_transcript(_job: AnalysisJob):
        return SimpleNamespace(
            status="ready",
            stage="transcript_ready",
            extractor="ffmpeg",
            audio_artifact_path=str(tmp_path / "artifact.wav"),
            model_dump=lambda: {
                "status": "ready",
                "stage": "transcript_ready",
                "extractor": "ffmpeg",
                "audio_artifact_path": str(tmp_path / "artifact.wav"),
            },
        )

    def execute_transcript(_job: AnalysisJob):
        return SimpleNamespace(
            status="ready",
            stage="transcript_generated",
            detected_language_code="en",
            detected_language_name="English",
            source_text="Hello team.",
            source_segments=[{"start": 0.0, "end": 1.0, "text": "Hello team."}],
            source_segments_json=lambda: '[{"start": 0.0, "end": 1.0, "text": "Hello team."}]',
            preview_text="Hello team.",
            segment_count=1,
            model_dump=lambda: {
                "status": "ready",
                "stage": "transcript_generated",
                "detected_language_code": "en",
                "detected_language_name": "English",
                "source_text": "Hello team.",
                "source_segments": [{"start": 0.0, "end": 1.0, "text": "Hello team."}],
                "preview_text": "Hello team.",
                "segment_count": 1,
            },
        )

    asyncio.run(
        process_analysis_job(
            {
                "publish": publish,
                "load_job": load_job,
                "persist_job": persist_job,
                "plan_public_video_download_shell": lambda current_job: planned_download,
                "execute_public_video_download_shell": execute_download,
                "prepare_public_video_transcript_shell": prepare_transcript,
                "execute_public_video_transcript_shell": execute_transcript,
            },
            job.id,
        )
    )

    assert any(name == "video.download" for name, _payload in calls)
    assert ("ready", "download_ready") in persisted_jobs
    assert job.download_status == "ready"
    assert job.download_artifact_path == str(tmp_path / "artifact.mp4")


def test_process_analysis_job_marks_download_failure(tmp_path: Path) -> None:
    calls: list[tuple[str, object]] = []
    persisted_jobs = []
    job = _make_job()
    planned_download = plan_public_video_download_shell(job, download_root=tmp_path)

    def publish(event_name: str, payload: dict) -> None:
        calls.append((event_name, payload))

    def load_job(requested_job_id: UUID) -> AnalysisJob:
        assert requested_job_id == job.id
        return job

    def persist_job(updated_job: AnalysisJob) -> None:
        persisted_jobs.append((updated_job.status.value, updated_job.stage))

    def execute_download(_job: AnalysisJob, planned=None):
        assert planned is planned_download
        raise PublicVideoDownloadError("download_failed", "unable to download")

    asyncio.run(
        process_analysis_job(
            {
                "publish": publish,
                "load_job": load_job,
                "persist_job": persist_job,
                "plan_public_video_download_shell": lambda current_job: planned_download,
                "execute_public_video_download_shell": execute_download,
            },
            job.id,
        )
    )

    assert persisted_jobs == [("failed", "download_failed")]
    assert job.status == JobStatus.FAILED
    assert job.stage == "download_failed"
    assert (
        "error",
        {
            "job_id": str(job.id),
            "reason": "download_failed",
            "message": "unable to download",
        },
    ) in calls


def test_process_analysis_job_persists_transcript_shell_after_download(tmp_path: Path) -> None:
    calls: list[tuple[str, object]] = []
    persisted_jobs = []
    job = _make_job()
    planned_download = plan_public_video_download_shell(job, download_root=tmp_path)

    def publish(event_name: str, payload: dict) -> None:
        calls.append((event_name, payload))

    def load_job(requested_job_id: UUID) -> AnalysisJob:
        assert requested_job_id == job.id
        return job

    def persist_job(updated_job: AnalysisJob) -> None:
        persisted_jobs.append(
            (
                updated_job.download_status,
                updated_job.stage,
                updated_job.transcript_status,
            )
        )

    def execute_download(_job: AnalysisJob, planned=None):
        assert planned is planned_download
        return SimpleNamespace(
            status="ready",
            stage="download_ready",
            executor="yt-dlp",
            format_id="best",
            format_label="Best available",
            artifact_path=str(tmp_path / "artifact.mp4"),
            model_dump=lambda: {
                "status": "ready",
                "stage": "download_ready",
                "executor": "yt-dlp",
                "format_id": "best",
                "format_label": "Best available",
                "artifact_path": str(tmp_path / "artifact.mp4"),
            },
        )

    def prepare_transcript(_job: AnalysisJob):
        return SimpleNamespace(
            status="ready",
            stage="transcript_ready",
            extractor="ffmpeg",
            audio_artifact_path=str(tmp_path / "artifact.wav"),
            model_dump=lambda: {
                "status": "ready",
                "stage": "transcript_ready",
                "extractor": "ffmpeg",
                "audio_artifact_path": str(tmp_path / "artifact.wav"),
            },
        )

    def execute_transcript(_job: AnalysisJob):
        return SimpleNamespace(
            status="ready",
            stage="transcript_generated",
            detected_language_code="en",
            detected_language_name="English",
            source_text="Hello team.",
            source_segments=[{"start": 0.0, "end": 1.0, "text": "Hello team."}],
            source_segments_json=lambda: '[{"start": 0.0, "end": 1.0, "text": "Hello team."}]',
            preview_text="Hello team.",
            segment_count=1,
            model_dump=lambda: {
                "status": "ready",
                "stage": "transcript_generated",
                "detected_language_code": "en",
                "detected_language_name": "English",
                "source_text": "Hello team.",
                "source_segments": [{"start": 0.0, "end": 1.0, "text": "Hello team."}],
                "preview_text": "Hello team.",
                "segment_count": 1,
            },
        )

    asyncio.run(
        process_analysis_job(
            {
                "publish": publish,
                "load_job": load_job,
                "persist_job": persist_job,
                "plan_public_video_download_shell": lambda current_job: planned_download,
                "execute_public_video_download_shell": execute_download,
                "prepare_public_video_transcript_shell": prepare_transcript,
                "execute_public_video_transcript_shell": execute_transcript,
            },
            job.id,
        )
    )

    assert any(name == "video.download" for name, _payload in calls)
    assert any(name == "transcript.shell" for name, _payload in calls)
    assert ("ready", "download_ready", None) in persisted_jobs
    assert ("ready", "transcript_ready", "ready") in persisted_jobs
    assert ("ready", "generating_transcript", "processing") in persisted_jobs
    assert job.transcript_status == "ready"
    assert job.transcript_extractor == "ffmpeg"
    assert job.transcript_audio_artifact_path == str(tmp_path / "artifact.wav")
