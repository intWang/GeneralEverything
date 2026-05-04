from fastapi import APIRouter

router = APIRouter(prefix="/api/oauth", tags=["oauth"])


@router.get("/ringcentral/start")
def start_ringcentral_oauth() -> dict[str, str]:
    return {"provider": "ringcentral", "status": "not_implemented"}
