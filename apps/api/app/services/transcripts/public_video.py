from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import subprocess
from typing import Callable


DEFAULT_TRANSCRIPT_ROOT = Path("var/transcripts/public-video")


@dataclass(slots=True)
class PublicVideoTranscriptShell:
    status: str
    stage: str
    extractor: str
    audio_artifact_path: str | None

    def model_dump(self) -> dict[str, str | None]:
        return {
            "status": self.status,
            "stage": self.stage,
            "extractor": self.extractor,
            "audio_artifact_path": self.audio_artifact_path,
        }


class PublicVideoTranscriptShellError(RuntimeError):
    def __init__(self, reason: str, message: str) -> None:
        super().__init__(message)
        self.reason = reason
        self.message = message


def prepare_public_video_transcript_shell(
    job: object,
    transcript_root: Path | None = None,
    run_command: Callable[..., subprocess.CompletedProcess[str]] | None = None,
) -> PublicVideoTranscriptShell:
    download_status = getattr(job, "download_status", None)
    if download_status and download_status != "ready":
        raise PublicVideoTranscriptShellError(
            "download_not_ready",
            "The job download is not ready for transcript preparation.",
        )

    download_artifact_path = getattr(job, "download_artifact_path", None)
    if not download_artifact_path:
        raise PublicVideoTranscriptShellError(
            "missing_download_artifact",
            "The job does not have a downloaded video artifact to prepare for transcript extraction.",
        )

    job_id = str(getattr(job, "id", "unknown"))
    root = transcript_root or DEFAULT_TRANSCRIPT_ROOT
    audio_artifact_path = root / f"{job_id}.wav"
    audio_artifact_path.parent.mkdir(parents=True, exist_ok=True)

    command = [
        "ffmpeg",
        "-y",
        "-i",
        str(download_artifact_path),
        "-vn",
        "-acodec",
        "pcm_s16le",
        "-ar",
        "16000",
        "-ac",
        "1",
        str(audio_artifact_path),
    ]

    runner = run_command or subprocess.run
    try:
        result = runner(
            command,
            check=False,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError as exc:
        raise PublicVideoTranscriptShellError(
            "tool_missing",
            "ffmpeg is not installed or not available on PATH.",
        ) from exc
    except OSError as exc:
        raise PublicVideoTranscriptShellError(
            "extraction_unavailable",
            f"Unable to start ffmpeg audio extraction: {exc}",
        ) from exc

    if result.returncode != 0:
        message = (result.stderr or result.stdout or "ffmpeg failed to extract audio.").strip()
        raise PublicVideoTranscriptShellError("extraction_failed", message)

    return PublicVideoTranscriptShell(
        status="ready",
        stage="transcript_ready",
        extractor="ffmpeg",
        audio_artifact_path=str(audio_artifact_path),
    )
