from __future__ import annotations

from dataclasses import dataclass


@dataclass(slots=True)
class PublicVideoSummaryShell:
    status: str
    stage: str
    preview_text: str | None
    key_points_count: int | None

    def model_dump(self) -> dict[str, str | int | None]:
        return {
            "status": self.status,
            "stage": self.stage,
            "preview_text": self.preview_text,
            "key_points_count": self.key_points_count,
        }


class PublicVideoSummaryShellError(RuntimeError):
    def __init__(self, reason: str, message: str) -> None:
        super().__init__(message)
        self.reason = reason
        self.message = message


def generate_public_video_summary_shell(job: object) -> PublicVideoSummaryShell:
    transcript_status = getattr(job, "transcript_status", None)
    if transcript_status and transcript_status != "ready":
        raise PublicVideoSummaryShellError(
            "transcript_not_ready",
            "The transcript shell is not ready for summary generation.",
        )

    transcript_preview_text = getattr(job, "transcript_preview_text", None)
    if not transcript_preview_text:
        raise PublicVideoSummaryShellError(
            "missing_transcript_preview",
            "The job does not have transcript preview text for summary generation.",
        )

    segment_count = getattr(job, "transcript_segment_count", None) or 1
    preview_text = (
        f"Summary shell generated from transcript preview: {transcript_preview_text}"
    )

    return PublicVideoSummaryShell(
        status="ready",
        stage="summary_generated",
        preview_text=preview_text,
        key_points_count=min(int(segment_count), 3),
    )
