from app.schemas.video_metadata import VideoMetadata


def normalize_yt_dlp_metadata(payload: dict) -> VideoMetadata:
    return VideoMetadata(
        title=payload.get("title", "Untitled"),
        duration_seconds=payload.get("duration"),
        thumbnail_url=payload.get("thumbnail"),
        source_name=payload.get("uploader"),
        description=payload.get("description"),
    )
