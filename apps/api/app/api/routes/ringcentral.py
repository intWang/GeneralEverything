from fastapi import APIRouter, HTTPException

from app.config import settings
from app.schemas.jobs import RingCentralProbeRequest, RingCentralProbeResponse
from app.services.connectors.ringcentral import sanitize_ringcentral_url
from app.services.downloads.ringcentral import (
    RingCentralDownloadAuth,
    RingCentralDownloadError,
    probe_ringcentral_recording_access,
)
from app.services.ingestion import detect_source_type
from app.models import InputMode

router = APIRouter(prefix="/api/ringcentral", tags=["ringcentral"])


def _configured_ringcentral_auth() -> RingCentralDownloadAuth:
    return RingCentralDownloadAuth(
        cookie_file=settings.ringcentral_cookie_file,
        cookies_from_browser=settings.ringcentral_cookies_from_browser,
    )


@router.post("/probe", response_model=RingCentralProbeResponse)
def probe_ringcentral_recording(
    payload: RingCentralProbeRequest,
) -> RingCentralProbeResponse:
    source_url = str(payload.source_url)
    if detect_source_type(source_url) != InputMode.RINGCENTRAL_RECORDING:
        raise HTTPException(
            status_code=400,
            detail="Only RingCentral recording URLs can be probed with this endpoint.",
        )

    sanitized_url = sanitize_ringcentral_url(source_url)
    auth = _configured_ringcentral_auth()
    if not auth.has_context():
        error = RingCentralDownloadError(
            "ringcentral_auth_required",
            "RingCentral probe requires a configured cookie file or browser cookie source.",
        )
        return RingCentralProbeResponse(
            ok=False,
            input_mode=InputMode.RINGCENTRAL_RECORDING,
            source_url=sanitized_url,
            diagnostic=error.diagnostic(),
        )

    result = probe_ringcentral_recording_access(sanitized_url, auth=auth)
    return RingCentralProbeResponse(
        ok=bool(result.get("ok")),
        input_mode=InputMode.RINGCENTRAL_RECORDING,
        source_url=sanitized_url,
        title=result.get("title") if isinstance(result.get("title"), str) else None,
        duration_seconds=(
            int(result["duration_seconds"])
            if isinstance(result.get("duration_seconds"), int | float)
            else None
        ),
        diagnostic=result.get("diagnostic"),
    )
