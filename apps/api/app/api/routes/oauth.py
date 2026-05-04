from fastapi import APIRouter, status

router = APIRouter(prefix="/api/oauth", tags=["oauth"])


@router.get("/ringcentral/start", status_code=status.HTTP_501_NOT_IMPLEMENTED)
def start_ringcentral_oauth() -> dict[str, str]:
    return {"provider": "ringcentral", "status": "not_implemented"}
