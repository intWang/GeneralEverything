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
