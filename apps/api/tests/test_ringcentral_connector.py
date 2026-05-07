from fastapi.testclient import TestClient

from app.main import app
from app.services.connectors.ringcentral import (
    RingCentralProbeError,
    is_ringcentral_recording_url,
    sanitize_ringcentral_url,
)


def test_ringcentral_recording_urls_are_supported() -> None:
    assert is_ringcentral_recording_url(
        "https://xmrupxmn-rxe-1-v.int.rclabenv.com/recordings/abc?isMeetingId=true"
    )


def test_non_ringcentral_hosts_are_not_supported() -> None:
    assert not is_ringcentral_recording_url(
        "https://notringcentral.example.com/recordings/abc?isMeetingId=true"
    )


def test_sanitize_ringcentral_url_removes_sensitive_query_tokens() -> None:
    sanitized = sanitize_ringcentral_url(
        "https://xmrupxmn-rxe-1-v.int.rclabenv.com/recordings/abc?code=secret&headless=true"
    )

    assert sanitized == (
        "https://xmrupxmn-rxe-1-v.int.rclabenv.com/recordings/abc?headless=true"
    )
    assert "secret" not in sanitized


def test_ringcentral_probe_error_exposes_safe_diagnostic() -> None:
    error = RingCentralProbeError(
        reason="ringcentral_auth_required",
        message="This RingCentral recording requires a signed-in session.",
    )

    assert error.diagnostic().reason == "ringcentral_auth_required"
    assert error.diagnostic().stage == "metadata_probe"


def test_ringcentral_oauth_start_returns_not_implemented() -> None:
    client = TestClient(app)

    response = client.get("/api/oauth/ringcentral/start")

    assert response.status_code == 501
    assert response.json() == {
        "provider": "ringcentral",
        "status": "not_implemented",
    }
