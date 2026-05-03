from app.models import InputMode
from app.services.ingestion import detect_source_type


def test_detects_ringcentral_recording_url() -> None:
    source = detect_source_type(
        "https://xmrupxmn-rxe-1-v.int.rclabenv.com/recordings/abc?isMeetingId=true"
    )
    assert source is InputMode.RINGCENTRAL_RECORDING


def test_detects_public_video_url() -> None:
    source = detect_source_type("https://www.youtube.com/watch?v=abc123")
    assert source is InputMode.PUBLIC_VIDEO
