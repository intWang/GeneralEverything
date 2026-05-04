import json
import subprocess

from app.schemas.video_metadata import VideoMetadata


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
        "yt-dlp",
        "--dump-single-json",
        "--skip-download",
        source_url,
    ]


def probe_public_video_metadata(
    source_url: str,
    run_probe=subprocess.run,
) -> VideoMetadata:
    command = build_yt_dlp_probe_command(source_url)
    result = run_probe(
        command,
        capture_output=True,
        text=True,
        check=False,
    )

    if result.returncode != 0:
        stderr = (result.stderr or "").strip()
        reason = "unsupported_url" if "Unsupported URL" in stderr else "probe_failed"
        raise PublicVideoProbeError(
            reason=reason,
            message=stderr or "yt-dlp metadata probe failed",
        )

    payload = json.loads(result.stdout or "{}")
    return normalize_yt_dlp_metadata(payload)
