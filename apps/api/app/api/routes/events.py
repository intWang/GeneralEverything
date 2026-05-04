from collections.abc import Iterator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.services.events import format_sse_message

router = APIRouter(prefix="/api/jobs", tags=["events"])


@router.get("/{job_id}/events")
def stream_job_events(job_id: str) -> StreamingResponse:
    def event_iterator() -> Iterator[str]:
        yield format_sse_message("job.status", {"job_id": job_id, "status": "queued"})

    return StreamingResponse(event_iterator(), media_type="text/event-stream")
