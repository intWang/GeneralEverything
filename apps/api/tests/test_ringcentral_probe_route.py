from fastapi.testclient import TestClient

from app.config import settings
from app.main import app
from app.services.downloads.progress import DownloadDiagnostic


def test_probe_ringcentral_requires_server_auth(monkeypatch) -> None:
    monkeypatch.setattr(settings, "ringcentral_cookie_file", None)
    monkeypatch.setattr(settings, "ringcentral_cookies_from_browser", None)
    client = TestClient(app)

    response = client.post(
        "/api/ringcentral/probe",
        json={
            "source_url": (
                "https://xmrupxmn-rxe-1-v.int.rclabenv.com/recordings/abc"
                "?isMeetingId=true&code=secret"
            )
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is False
    assert payload["input_mode"] == "ringcentral_recording"
    assert "code=secret" not in payload["source_url"]
    assert payload["diagnostic"]["reason"] == "ringcentral_auth_required"


def test_probe_ringcentral_returns_sanitized_success(monkeypatch) -> None:
    monkeypatch.setattr(settings, "ringcentral_cookie_file", None)
    monkeypatch.setattr(settings, "ringcentral_cookies_from_browser", "chrome:Default")
    client = TestClient(app)

    def fake_probe(source_url, auth):
        assert "code=secret" not in source_url
        assert auth.cookies_from_browser == "chrome:Default"
        return {
            "ok": True,
            "title": "Team sync recording",
            "duration_seconds": 3480,
        }

    monkeypatch.setattr("app.api.routes.ringcentral.probe_ringcentral_recording_access", fake_probe)

    response = client.post(
        "/api/ringcentral/probe",
        json={
            "source_url": (
                "https://xmrupxmn-rxe-1-v.int.rclabenv.com/recordings/abc"
                "?isMeetingId=true&code=secret"
            )
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is True
    assert payload["title"] == "Team sync recording"
    assert payload["duration_seconds"] == 3480
    assert "code=secret" not in payload["source_url"]
    assert payload["diagnostic"] is None


def test_probe_ringcentral_returns_safe_failure_diagnostic(monkeypatch) -> None:
    monkeypatch.setattr(settings, "ringcentral_cookie_file", "/tmp/cookies.txt")
    monkeypatch.setattr(settings, "ringcentral_cookies_from_browser", None)
    client = TestClient(app)

    def fake_probe(source_url, auth):
        return {
            "ok": False,
            "diagnostic": DownloadDiagnostic(
                reason="ringcentral_permission_denied",
                stage="probe",
                message="The authenticated RingCentral session cannot access this recording.",
                suggestion="Confirm your account has permission, then retry.",
            ).model_dump(),
        }

    monkeypatch.setattr("app.api.routes.ringcentral.probe_ringcentral_recording_access", fake_probe)

    response = client.post(
        "/api/ringcentral/probe",
        json={
            "source_url": (
                "https://xmrupxmn-rxe-1-v.int.rclabenv.com/recordings/abc"
                "?isMeetingId=true&code=secret"
            )
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is False
    assert payload["diagnostic"]["reason"] == "ringcentral_permission_denied"
    assert "code=secret" not in str(payload)


def test_probe_ringcentral_rejects_non_ringcentral_urls() -> None:
    client = TestClient(app)

    response = client.post(
        "/api/ringcentral/probe",
        json={"source_url": "https://example.com/video"},
    )

    assert response.status_code == 400
