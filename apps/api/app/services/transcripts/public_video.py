from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


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
) -> PublicVideoTranscriptShell:
    download_artifact_path = getattr(job, "download_artifact_path", None)
    if not download_artifact_path:
        raise PublicVideoTranscriptShellError(
            "missing_download_artifact",
            "The job does not have a downloaded video artifact to prepare for transcript extraction.",
        )

    job_id = str(getattr(job, "id", "unknown"))
    root = transcript_root or DEFAULT_TRANSCRIPT_ROOT
    audio_artifact_path = root / f"{job_id}.wav"

    return PublicVideoTranscriptShell(
        status="ready",
        stage="transcript_ready",
        extractor="ffmpeg",
        audio_artifact_path=str(audio_artifact_path),
    )
