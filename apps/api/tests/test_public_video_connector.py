import asyncio
from uuid import UUID

from app.tasks import process_analysis_job
from app.services.connectors.public_video import normalize_yt_dlp_metadata


def test_normalizes_public_video_metadata() -> None:
    metadata = normalize_yt_dlp_metadata(
        {
            "title": "Sample Video",
            "duration": 120,
            "thumbnail": "https://example.com/thumb.jpg",
            "uploader": "Example Channel",
            "description": "A short description",
        }
    )

    assert metadata.title == "Sample Video"
    assert metadata.duration_seconds == 120
    assert metadata.thumbnail_url == "https://example.com/thumb.jpg"
    assert metadata.source_name == "Example Channel"


def test_process_analysis_job_publishes_stub_metadata_event() -> None:
    calls = []

    def publish(event_name: str, payload: dict) -> None:
        calls.append((event_name, payload))

    asyncio.run(
        process_analysis_job(
            {"publish": publish},
            UUID("12345678-1234-5678-1234-567812345678"),
        )
    )

    assert calls == [
        (
            "video.metadata",
            {"job_id": "12345678-1234-5678-1234-567812345678"},
        )
    ]
