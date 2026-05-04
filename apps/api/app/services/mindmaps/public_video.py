from __future__ import annotations

from dataclasses import dataclass


@dataclass(slots=True)
class PublicVideoMindMapShell:
    status: str
    stage: str
    preview_text: str | None
    node_count: int | None

    def model_dump(self) -> dict[str, str | int | None]:
        return {
            "status": self.status,
            "stage": self.stage,
            "preview_text": self.preview_text,
            "node_count": self.node_count,
        }


class PublicVideoMindMapShellError(RuntimeError):
    def __init__(self, reason: str, message: str) -> None:
        super().__init__(message)
        self.reason = reason
        self.message = message


def generate_public_video_mindmap_shell(job: object) -> PublicVideoMindMapShell:
    summary_status = getattr(job, "summary_status", None)
    if summary_status and summary_status != "ready":
        raise PublicVideoMindMapShellError(
            "summary_not_ready",
            "The summary shell is not ready for mind map generation.",
        )

    summary_preview_text = getattr(job, "summary_preview_text", None)
    if not summary_preview_text:
        raise PublicVideoMindMapShellError(
            "missing_summary_preview",
            "The job does not have summary preview text for mind map generation.",
        )

    key_points_count = getattr(job, "summary_key_points_count", None) or 1
    preview_text = f"Mind map shell generated from summary preview: {summary_preview_text}"

    return PublicVideoMindMapShell(
        status="ready",
        stage="mindmap_generated",
        preview_text=preview_text,
        node_count=max(int(key_points_count), 1),
    )
