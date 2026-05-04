import uuid

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.db import get_session
from app.models.job import AnalysisJob
from app.services.events import format_sse_message, job_event_broker

router = APIRouter(prefix="/api/jobs", tags=["events"])


@router.get("/{job_id}/events")
async def stream_job_events(
    job_id: uuid.UUID,
    session: Session = Depends(get_session),
) -> StreamingResponse:
    async def event_iterator():
        job = session.get(AnalysisJob, job_id)
        if job is not None:
            yield format_sse_message(
                "job.status",
                {
                    "job_id": str(job_id),
                    "status": job.status.value,
                    "stage": job.stage,
                },
            )
        async for message in job_event_broker.subscribe(str(job_id)):
            yield message

    return StreamingResponse(event_iterator(), media_type="text/event-stream")
