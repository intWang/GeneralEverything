from __future__ import annotations

from pathlib import Path
from subprocess import CompletedProcess
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.services.downloads.ringcentral import (
    RingCentralDownloadAuth,
    RingCentralDownloadError,
    execute_ringcentral_download_shell,
    plan_ringcentral_download_shell,
)


def _make_job(source_url: str | None = None) -> SimpleNamespace:
    return SimpleNamespace(
        id=uuid4(),
        source_url=source_url
        or "https://xmrupxmn-rxe-1-v.int.rclabenv.com/recordings/abc?isMeetingId=true&code=secret",
    )


def test_execute_ringcentral_download_shell_uses_cookie_file(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    job = _make_job()
    cookie_file = tmp_path / "cookies.txt"
    cookie_file.write_text("# Netscape cookie file", encoding="utf-8")
    planned = plan_ringcentral_download_shell(job, download_root=tmp_path)
    captured_command: list[str] = []

    def fake_run(command: list[str], **_kwargs) -> CompletedProcess[str]:
        captured_command.extend(command)
        return CompletedProcess(
            args=command,
            returncode=0,
            stdout=str(tmp_path / "recording.mp4") + "\n",
            stderr="",
        )

    monkeypatch.setattr("app.services.downloads.ringcentral.subprocess.run", fake_run)
    monkeypatch.setattr(
        "app.services.downloads.ringcentral._resolve_yt_dlp_command",
        lambda: ["yt-dlp"],
    )

    result = execute_ringcentral_download_shell(
        job,
        auth=RingCentralDownloadAuth(cookie_file=str(cookie_file)),
        planned=planned,
        download_root=tmp_path,
    )

    assert result.status == "ready"
    assert result.artifact_path == str(tmp_path / "recording.mp4")
    assert "--cookies" in captured_command
    assert str(cookie_file) in captured_command
    assert "code=secret" not in captured_command[-1]


def test_execute_ringcentral_download_shell_uses_browser_cookie_source(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    job = _make_job()
    planned = plan_ringcentral_download_shell(job, download_root=tmp_path)
    captured_command: list[str] = []

    def fake_run(command: list[str], **_kwargs) -> CompletedProcess[str]:
        captured_command.extend(command)
        return CompletedProcess(
            args=command,
            returncode=0,
            stdout=str(tmp_path / "recording.mp4") + "\n",
            stderr="",
        )

    monkeypatch.setattr("app.services.downloads.ringcentral.subprocess.run", fake_run)
    monkeypatch.setattr(
        "app.services.downloads.ringcentral._resolve_yt_dlp_command",
        lambda: ["yt-dlp"],
    )

    execute_ringcentral_download_shell(
        job,
        auth=RingCentralDownloadAuth(cookies_from_browser="chrome:Default"),
        planned=planned,
        download_root=tmp_path,
    )

    assert "--cookies-from-browser" in captured_command
    assert "chrome:Default" in captured_command


def test_execute_ringcentral_download_shell_requires_auth_context(tmp_path: Path) -> None:
    job = _make_job()

    with pytest.raises(RingCentralDownloadError) as exc_info:
        execute_ringcentral_download_shell(job, auth=RingCentralDownloadAuth(), download_root=tmp_path)

    assert exc_info.value.reason == "ringcentral_auth_required"
    assert "cookie" in exc_info.value.message.lower()


def test_execute_ringcentral_download_shell_redacts_sensitive_failure_output(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    job = _make_job()

    def fake_run(command: list[str], **_kwargs) -> CompletedProcess[str]:
        return CompletedProcess(
            args=command,
            returncode=1,
            stdout="",
            stderr="failed with code=secret and access_token=hidden",
        )

    monkeypatch.setattr("app.services.downloads.ringcentral.subprocess.run", fake_run)
    monkeypatch.setattr(
        "app.services.downloads.ringcentral._resolve_yt_dlp_command",
        lambda: ["yt-dlp"],
    )

    with pytest.raises(RingCentralDownloadError) as exc_info:
        execute_ringcentral_download_shell(
            job,
            auth=RingCentralDownloadAuth(cookies_from_browser="chrome"),
            download_root=tmp_path,
        )

    assert exc_info.value.reason == "ringcentral_download_failed"
    assert "code=secret" not in exc_info.value.message
    assert "access_token=hidden" not in exc_info.value.message
