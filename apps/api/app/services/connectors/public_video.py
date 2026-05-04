import json
import subprocess

from app.schemas.video_metadata import VideoMetadata
from app.services.downloads.public_video import _resolve_yt_dlp_command


class PublicVideoProbeError(RuntimeError):
    def __init__(self, reason: str, message: str) -> None:
        super().__init__(message)
        self.reason = reason
        self.message = message


def normalize_yt_dlp_metadata(payload: dict) -> VideoMetadata:
    return VideoMetadata(
        title=payload.get("title", "Untitled"),
        duration_seconds=payload.get("duration"),
        thumbnail_url=payload.get("thumbnail"),
        source_name=payload.get("uploader"),
        description=payload.get("description"),
    )


def build_yt_dlp_probe_command(source_url: str) -> list[str]:
    return [
        *_resolve_yt_dlp_command(),
        "--dump-single-json",
        "--skip-download",
        source_url,
    ]


def probe_public_video_metadata(
    source_url: str,
    run_probe=subprocess.run,
) -> VideoMetadata:
    command = build_yt_dlp_probe_command(source_url)
    try:
        result = run_probe(
            command,
            capture_output=True,
            text=True,
            check=False,
        )
    except FileNotFoundError as exc:
        raise PublicVideoProbeError(
            reason="tool_missing",
            message="yt-dlp is not installed or not available on PATH",
        ) from exc

    if result.returncode != 0:
        stderr = (result.stderr or "").strip()
        reason = "unsupported_url" if "Unsupported URL" in stderr else "probe_failed"
        raise PublicVideoProbeError(
            reason=reason,
            message=stderr or "yt-dlp metadata probe failed",
        )

    try:
        payload = json.loads(result.stdout or "{}")
    except json.JSONDecodeError as exc:
        raise PublicVideoProbeError(
            reason="invalid_output",
            message="yt-dlp returned malformed metadata output",
        ) from exc
    return normalize_yt_dlp_metadata(payload)
