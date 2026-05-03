from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db import get_session
from app.models.job import AnalysisJob, JobStatus
from app.schemas.jobs import CreateJobRequest, JobResponse

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


@router.post("", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
def create_job(
    payload: CreateJobRequest,
    session: Session = Depends(get_session),
) -> JobResponse:
    job = AnalysisJob(
        input_mode=payload.input_mode,
        source_url=str(payload.source_url),
        status=JobStatus.QUEUED,
        stage="queued",
    )
    session.add(job)
    session.commit()
    session.refresh(job)
    return JobResponse(
        id=str(job.id),
        input_mode=job.input_mode.value,
        source_url=job.source_url,
        status=job.status.value,
        stage=job.stage,
    )
