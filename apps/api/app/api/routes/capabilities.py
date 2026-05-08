from fastapi import APIRouter

from app.config import settings

router = APIRouter(prefix="/api/capabilities", tags=["capabilities"])


def _ringcentral_capability() -> dict[str, str | bool | None]:
    if settings.ringcentral_cookie_file:
        return {
            "auth_configured": True,
            "auth_method": "cookie_file",
            "enabled": True,
            "label": "RingCentral Recording URL",
            "message": (
                "RingCentral recording downloads can use the configured server "
                "cookie file."
            ),
            "status": "ready",
            "suggestion": "Paste an internal RingCentral recording URL to start.",
        }

    if settings.ringcentral_cookies_from_browser:
        return {
            "auth_configured": True,
            "auth_method": "browser_cookies",
            "enabled": True,
            "label": "RingCentral Recording URL",
            "message": (
                "RingCentral recording downloads can use configured browser cookies "
                "from the API host."
            ),
            "status": "ready",
            "suggestion": "Paste an internal RingCentral recording URL to start.",
        }

    return {
        "auth_configured": False,
        "auth_method": None,
        "enabled": False,
        "label": "RingCentral Recording URL",
        "message": "RingCentral server authentication is not configured.",
        "status": "requires_server_auth",
        "suggestion": (
            "Set RINGCENTRAL_COOKIE_FILE or RINGCENTRAL_COOKIES_FROM_BROWSER on "
            "the API server, then restart and retry."
        ),
    }


@router.get("")
def get_capabilities() -> dict[str, dict[str, dict[str, str | bool | None]]]:
    return {
        "input_modes": {
            "public_video": {
                "auth_configured": True,
                "auth_method": None,
                "enabled": True,
                "label": "Public Video URL",
                "message": "Public video analysis is available.",
                "status": "ready",
                "suggestion": "Paste a public video URL to start.",
            },
            "ringcentral_recording": _ringcentral_capability(),
        }
    }
