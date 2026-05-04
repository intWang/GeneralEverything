from fastapi.testclient import TestClient

from app.main import app
from app.services.connectors.ringcentral import is_ringcentral_recording_url


def test_ringcentral_recording_urls_are_supported() -> None:
    assert is_ringcentral_recording_url(
        "https://xmrupxmn-rxe-1-v.int.rclabenv.com/recordings/abc?isMeetingId=true"
    )


def test_non_ringcentral_hosts_are_not_supported() -> None:
    assert not is_ringcentral_recording_url(
        "https://notringcentral.example.com/recordings/abc?isMeetingId=true"
    )


def test_ringcentral_oauth_start_returns_not_implemented() -> None:
    client = TestClient(app)

    response = client.get("/api/oauth/ringcentral/start")

    assert response.status_code == 501
    assert response.json() == {
        "provider": "ringcentral",
        "status": "not_implemented",
    }
