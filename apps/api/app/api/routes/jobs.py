from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db import get_session
from app.models.job import AnalysisJob
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
    )
    session.add(job)
    session.commit()
    session.refresh(job)
    return job
