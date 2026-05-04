import uuid

from fastapi import APIRouter, Depends, status
from fastapi import HTTPException, Query
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.db import get_session
from app.models.job import AnalysisJob
from app.schemas.jobs import CreateJobRequest, JobResponse
from app.services.ingestion import detect_source_type

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


@router.post("", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
def create_job(
    payload: CreateJobRequest,
    session: Session = Depends(get_session),
) -> JobResponse:
    resolved_input_mode = detect_source_type(str(payload.source_url))
    job = AnalysisJob(
        input_mode=resolved_input_mode,
        source_url=str(payload.source_url),
    )
    session.add(job)
    session.commit()
    session.refresh(job)
    return job


@router.get("", response_model=list[JobResponse])
def list_jobs(
    limit: int = Query(default=10, ge=1, le=25),
    session: Session = Depends(get_session),
) -> list[JobResponse]:
    statement = (
        select(AnalysisJob)
        .order_by(desc(AnalysisJob.created_at), desc(AnalysisJob.id))
        .limit(limit)
    )
    return list(session.execute(statement).scalars().all())


@router.get("/{job_id}", response_model=JobResponse)
def get_job(
    job_id: uuid.UUID,
    session: Session = Depends(get_session),
) -> JobResponse:
    job = session.get(AnalysisJob, job_id)

    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    return job
