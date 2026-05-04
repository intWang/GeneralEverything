from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import subprocess


DEFAULT_DOWNLOAD_ROOT = Path("var/downloads/public-video")


@dataclass(slots=True)
class PublicVideoDownloadShell:
    status: str
    stage: str
    executor: str
    format_id: str
    format_label: str
    artifact_path: str | None

    def model_dump(self) -> dict[str, str | None]:
        return {
            "status": self.status,
            "stage": self.stage,
            "executor": self.executor,
            "format_id": self.format_id,
            "format_label": self.format_label,
            "artifact_path": self.artifact_path,
        }


class PublicVideoDownloadError(RuntimeError):
    def __init__(self, reason: str, message: str) -> None:
        super().__init__(message)
        self.reason = reason
        self.message = message


def plan_public_video_download_shell(job: object, download_root: Path | None = None) -> PublicVideoDownloadShell:
    root = download_root or DEFAULT_DOWNLOAD_ROOT
    job_id = str(getattr(job, "id", "unknown"))
    artifact_path = root / f"{job_id}.%(ext)s"
    return PublicVideoDownloadShell(
        status="queued",
        stage="queued_download",
        executor="yt-dlp",
        format_id="best",
        format_label="Best available",
        artifact_path=str(artifact_path),
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

    output_template = shell.artifact_path or str((download_root or DEFAULT_DOWNLOAD_ROOT) / f"{getattr(job, 'id', 'unknown')}.%(ext)s")
    output_path = Path(output_template)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    command = [
        "yt-dlp",
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
    return PublicVideoDownloadShell(
        status="ready",
        stage="download_ready",
        executor=shell.executor,
        format_id=shell.format_id,
        format_label=shell.format_label,
        artifact_path=final_path,
    )


def _extract_downloaded_path(stdout: str, fallback_path: str) -> str:
    lines = [line.strip() for line in stdout.splitlines() if line.strip()]
    return lines[-1] if lines else fallback_path
