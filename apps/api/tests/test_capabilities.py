from fastapi.testclient import TestClient

from app.config import settings
from app.main import app


def test_capabilities_reports_ringcentral_auth_missing(monkeypatch) -> None:
    monkeypatch.setattr(settings, "ringcentral_cookie_file", None)
    monkeypatch.setattr(settings, "ringcentral_cookies_from_browser", None)
    client = TestClient(app)

    response = client.get("/api/capabilities")

    assert response.status_code == 200
    payload = response.json()
    ringcentral = payload["input_modes"]["ringcentral_recording"]
    assert ringcentral["enabled"] is False
    assert ringcentral["auth_configured"] is False
    assert ringcentral["auth_method"] is None
    assert ringcentral["status"] == "requires_server_auth"


def test_capabilities_reports_ringcentral_cookie_file_auth(monkeypatch) -> None:
    monkeypatch.setattr(settings, "ringcentral_cookie_file", "/tmp/rc-cookies.txt")
    monkeypatch.setattr(settings, "ringcentral_cookies_from_browser", None)
    client = TestClient(app)

    response = client.get("/api/capabilities")

    assert response.status_code == 200
    ringcentral = response.json()["input_modes"]["ringcentral_recording"]
    assert ringcentral["enabled"] is True
    assert ringcentral["auth_configured"] is True
    assert ringcentral["auth_method"] == "cookie_file"
    assert ringcentral["status"] == "ready"
    assert "/tmp/rc-cookies.txt" not in ringcentral["message"]


def test_capabilities_prefers_browser_cookie_auth_without_exposing_profile(monkeypatch) -> None:
    monkeypatch.setattr(settings, "ringcentral_cookie_file", None)
    monkeypatch.setattr(settings, "ringcentral_cookies_from_browser", "chrome:Default")
    client = TestClient(app)

    response = client.get("/api/capabilities")

    assert response.status_code == 200
    ringcentral = response.json()["input_modes"]["ringcentral_recording"]
    assert ringcentral["enabled"] is True
    assert ringcentral["auth_configured"] is True
    assert ringcentral["auth_method"] == "browser_cookies"
    assert ringcentral["status"] == "ready"
    assert "chrome:Default" not in ringcentral["message"]
