from app.services.connectors.ringcentral import is_ringcentral_recording_url


def test_ringcentral_recording_urls_are_supported() -> None:
    assert is_ringcentral_recording_url(
        "https://xmrupxmn-rxe-1-v.int.rclabenv.com/recordings/abc?isMeetingId=true"
    )
