from __future__ import annotations

import asyncio
from pathlib import Path
from subprocess import CompletedProcess
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.services.downloads.public_video import (
    PublicVideoDownloadError,
    execute_public_video_download_shell,
    plan_public_video_download_shell,
)
from app.tasks import process_analysis_job


def _make_job(stage: str = "metadata_ready", status: str = "running") -> SimpleNamespace:
    return SimpleNamespace(
        id=uuid4(),
        source_url="https://example.com/watch?v=test",
        input_mode="public_video",
        stage=stage,
        status=status,
        download_status=None,
        download_executor=None,
        download_format_id=None,
        download_format_label=None,
        download_artifact_path=None,
    )


def test_execute_public_video_download_shell_returns_ready_result(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    job = _make_job()
    planned = plan_public_video_download_shell(job, download_root=tmp_path)

    def fake_run(*_args, **_kwargs) -> CompletedProcess[str]:
        return CompletedProcess(
            args=["yt-dlp"],
            returncode=0,
            stdout=str(tmp_path / "artifact.mp4") + "\n",
            stderr="",
        )

    monkeypatch.setattr("app.services.downloads.public_video.subprocess.run", fake_run)

    result = execute_public_video_download_shell(job, planned=planned, download_root=tmp_path)

    assert result.status == "ready"
    assert result.stage == "download_ready"
    assert result.executor == "yt-dlp"
    assert result.artifact_path == str(tmp_path / "artifact.mp4")
    available_formats = result.model_dump()["available_formats"]
    assert next(
        format_choice
        for format_choice in available_formats
        if format_choice["format_id"] == "best"
    )["artifact_path"] == str(tmp_path / "artifact.mp4")
    assert all(
        format_choice["artifact_path"] is None
        for format_choice in available_formats
        if format_choice["format_id"] != "best"
    )


def test_execute_public_video_download_shell_discovers_artifact_when_stdout_is_empty(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    job = _make_job()
    planned = plan_public_video_download_shell(job, download_root=tmp_path)
    artifact_path = tmp_path / f"{job.id}.mp4"
    artifact_path.write_text("video", encoding="utf-8")

    def fake_run(*_args, **_kwargs) -> CompletedProcess[str]:
        return CompletedProcess(args=["yt-dlp"], returncode=0, stdout="", stderr="")

    monkeypatch.setattr("app.services.downloads.public_video.subprocess.run", fake_run)

    result = execute_public_video_download_shell(job, planned=planned, download_root=tmp_path)

    assert result.artifact_path == str(artifact_path)
    assert "%(ext)s" not in result.artifact_path


def test_execute_public_video_download_shell_rejects_missing_artifact_path(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    job = _make_job()
    planned = plan_public_video_download_shell(job, download_root=tmp_path)

    def fake_run(*_args, **_kwargs) -> CompletedProcess[str]:
        return CompletedProcess(args=["yt-dlp"], returncode=0, stdout="", stderr="")

    monkeypatch.setattr("app.services.downloads.public_video.subprocess.run", fake_run)

    with pytest.raises(PublicVideoDownloadError) as exc_info:
        execute_public_video_download_shell(job, planned=planned, download_root=tmp_path)

    assert exc_info.value.reason == "download_artifact_missing"


def test_execute_public_video_download_shell_normalizes_missing_tool(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    job = _make_job()

    def fake_run(*_args, **_kwargs) -> CompletedProcess[str]:
        raise FileNotFoundError("yt-dlp")

    monkeypatch.setattr("app.services.downloads.public_video.subprocess.run", fake_run)

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

    with pytest.raises(PublicVideoDownloadError) as exc_info:
        execute_public_video_download_shell(job, download_root=tmp_path)

    assert exc_info.value.reason == "download_failed"
    assert "download failed" in exc_info.value.message


def test_process_analysis_job_persists_download_shell_result(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    job = _make_job()
    job.title = "Example video"
    job.duration_seconds = 120
    job.thumbnail_url = "https://example.com/thumb.jpg"
    job.source_name = "Example"
    job.description = "Example description"

    planned = plan_public_video_download_shell(job, download_root=tmp_path)

    published_events: list[tuple[str, object]] = []

    monkeypatch.setattr(
        "app.tasks.plan_public_video_download_shell",
        lambda current_job: planned,
    )
    monkeypatch.setattr(
        "app.tasks.execute_public_video_download_shell",
        lambda current_job, planned=None: SimpleNamespace(
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
        ),
    )
    asyncio.run(
        process_analysis_job(
            {
                "publish": lambda event_name, payload: published_events.append((event_name, payload)),
                "load_job": lambda requested_job_id: job,
                "persist_job": lambda *_args, **_kwargs: None,
                "plan_public_video_download_shell": lambda current_job: planned,
                "execute_public_video_download_shell": lambda current_job, planned=None: SimpleNamespace(
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
                ),
            },
            job.id,
        )
    )

    assert job.download_status == "ready"
    assert job.download_artifact_path == str(tmp_path / "artifact.mp4")
    assert any(name == "video.download" for name, _payload in published_events)


def test_process_analysis_job_marks_download_failure(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    job = _make_job()
    planned = plan_public_video_download_shell(job, download_root=tmp_path)

    published_events: list[tuple[str, object]] = []

    asyncio.run(
        process_analysis_job(
            {
                "publish": lambda event_name, payload: published_events.append((event_name, payload)),
                "load_job": lambda requested_job_id: job,
                "persist_job": lambda *_args, **_kwargs: None,
                "plan_public_video_download_shell": lambda current_job: planned,
                "execute_public_video_download_shell": lambda current_job, planned=None: (_ for _ in ()).throw(
                    PublicVideoDownloadError("download_failed", "unable to download")
                ),
            },
            job.id,
        )
    )

    assert job.status == "failed"
    assert job.stage == "download_failed"
    assert (
        "error",
        {
            "job_id": str(job.id),
            "reason": "download_failed",
            "message": "unable to download",
        },
    ) in published_events
