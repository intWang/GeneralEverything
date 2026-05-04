import uuid

from fastapi import APIRouter, Depends, status
from fastapi import HTTPException, Query
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.db import get_session
from app.models.job import AnalysisJob, InputMode, JobStatus
from app.schemas.jobs import (
    AskJobQuestionRequest,
    AskJobQuestionResponse,
    CreateJobRequest,
    JobResponse,
)
from app.services.connectors.public_video import (
    PublicVideoProbeError,
    probe_public_video_metadata,
)
from app.services.ingestion import detect_source_type
from app.services.qa_pipeline import QAAnswerNotReadyError, answer_job_question

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

    if job.input_mode == InputMode.PUBLIC_VIDEO:
        try:
            metadata = probe_public_video_metadata(job.source_url)
        except PublicVideoProbeError as exc:
            job.status = JobStatus.FAILED
            job.stage = exc.reason
        else:
            job.title = metadata.title
            job.duration_seconds = metadata.duration_seconds
            job.thumbnail_url = metadata.thumbnail_url
            job.source_name = metadata.source_name
            job.description = metadata.description
            job.status = JobStatus.RUNNING
            job.stage = "metadata_ready"

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


@router.post("/{job_id}/questions", response_model=AskJobQuestionResponse)
def submit_job_question(
    job_id: uuid.UUID,
    payload: AskJobQuestionRequest,
    session: Session = Depends(get_session),
) -> AskJobQuestionResponse:
    job = session.get(AnalysisJob, job_id)

    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    try:
        answer_shell = answer_job_question(job, payload.question)
    except QAAnswerNotReadyError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    return AskJobQuestionResponse(
        job_id=job.id,
        question=answer_shell.question,
        answer=answer_shell.answer,
        grounded=answer_shell.grounded,
        references=list(answer_shell.references),
    )
