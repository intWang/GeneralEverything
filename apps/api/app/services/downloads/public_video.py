from __future__ import annotations

from dataclasses import dataclass, field
import importlib.util
from pathlib import Path
import shutil
import subprocess
import sys

from app.services.downloads.progress import DownloadFormatChoice


DEFAULT_DOWNLOAD_ROOT = Path("var/downloads/public-video")


@dataclass(slots=True)
class PublicVideoDownloadShell:
    status: str
    stage: str
    executor: str
    format_id: str
    format_label: str
    artifact_path: str | None
    available_formats: list[DownloadFormatChoice] = field(default_factory=list)
    output_template: str | None = None

    def model_dump(self) -> dict[str, object]:
        return {
            "status": self.status,
            "stage": self.stage,
            "executor": self.executor,
            "format_id": self.format_id,
            "format_label": self.format_label,
            "artifact_path": self.artifact_path,
            "available_formats": [
                format_choice.model_dump() for format_choice in self.available_formats
            ],
        }


class PublicVideoDownloadError(RuntimeError):
    def __init__(self, reason: str, message: str) -> None:
        super().__init__(message)
        self.reason = reason
        self.message = message


def _resolve_yt_dlp_command() -> list[str]:
    system_binary = shutil.which("yt-dlp")
    if system_binary:
        return [system_binary]

    if importlib.util.find_spec("yt_dlp") is not None:
        return [sys.executable, "-m", "yt_dlp"]

    return ["yt-dlp"]


def plan_public_video_download_shell(job: object, download_root: Path | None = None) -> PublicVideoDownloadShell:
    root = download_root or DEFAULT_DOWNLOAD_ROOT
    job_id = str(getattr(job, "id", "unknown"))
    output_template = root / f"{job_id}.%(ext)s"
    available_formats = _default_available_formats()
    return PublicVideoDownloadShell(
        status="queued",
        stage="queued_download",
        executor="yt-dlp",
        format_id="best",
        format_label="Best available",
        artifact_path=None,
        available_formats=available_formats,
        output_template=str(output_template),
    )


def execute_public_video_download_shell(
    job: object,
    planned: PublicVideoDownloadShell | None = None,
    download_root: Path | None = None,
) -> PublicVideoDownloadShell:
    shell = planned or plan_public_video_download_shell(job, download_root=download_root)
    source_url = getattr(job, "source_url", None)
    if not source_url:
        raise PublicVideoDownloadError("missing_source_url", "The job does not have a source URL.")

    output_template = (
        shell.output_template
        or shell.artifact_path
        or str((download_root or DEFAULT_DOWNLOAD_ROOT) / f"{getattr(job, 'id', 'unknown')}.%(ext)s")
    )
    output_path = Path(output_template)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    command = [
        *_resolve_yt_dlp_command(),
        "--no-progress",
        "--newline",
        "-f",
        shell.format_id or "best",
        "-o",
        output_template,
        "--print",
        "after_move:filepath",
        source_url,
    ]

    try:
        result = subprocess.run(
            command,
            check=False,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError as exc:
        raise PublicVideoDownloadError("tool_missing", "yt-dlp is not installed or not available on PATH.") from exc
    except OSError as exc:
        raise PublicVideoDownloadError("download_unavailable", f"Unable to start yt-dlp download: {exc}") from exc

    if result.returncode != 0:
        message = (result.stderr or result.stdout or "yt-dlp failed to download the video.").strip()
        raise PublicVideoDownloadError("download_failed", message)

    final_path = _extract_downloaded_path(result.stdout, output_template)
    if final_path is None:
        raise PublicVideoDownloadError(
            "download_artifact_missing",
            "yt-dlp completed but did not report or create a downloadable artifact.",
        )
    available_formats = _with_selected_artifact_path(
        shell.available_formats,
        shell.format_id,
        final_path,
    )
    return PublicVideoDownloadShell(
        status="ready",
        stage="download_ready",
        executor=shell.executor,
        format_id=shell.format_id,
        format_label=shell.format_label,
        artifact_path=final_path,
        available_formats=available_formats,
        output_template=output_template,
    )


def _extract_downloaded_path(stdout: str, output_template: str) -> str | None:
    lines = [line.strip() for line in stdout.splitlines() if line.strip()]
    if lines:
        return lines[-1]

    if "%(ext)s" not in output_template:
        return output_template

    output_path = Path(output_template)
    matches = sorted(output_path.parent.glob(output_path.name.replace("%(ext)s", "*")))
    return str(matches[-1]) if matches else None


def _default_available_formats() -> list[DownloadFormatChoice]:
    return [
        DownloadFormatChoice(
            format_id="best",
            format_label="Best available",
            resolution="source",
            container=None,
            kind="video",
            artifact_path=None,
        ),
        DownloadFormatChoice(
            format_id="bestaudio/best",
            format_label="Audio only",
            resolution="audio",
            container=None,
            kind="audio",
            artifact_path=None,
        ),
    ]


def _with_selected_artifact_path(
    available_formats: list[DownloadFormatChoice],
    selected_format_id: str,
    artifact_path: str,
) -> list[DownloadFormatChoice]:
    updated_formats: list[DownloadFormatChoice] = []
    for format_choice in available_formats:
        if format_choice.format_id == selected_format_id:
            updated_formats.append(
                format_choice.model_copy(update={"artifact_path": artifact_path})
            )
        else:
            updated_formats.append(format_choice)

    return updated_formats
