import uuid
import asyncio
import json

from fastapi import APIRouter, BackgroundTasks, Depends, status
from fastapi import HTTPException, Query
from sqlalchemy import desc, select
from sqlalchemy.orm import Session, sessionmaker

from app.db import get_session
from app.models.job import AnalysisJob, InputMode, JobStatus
from app.schemas.jobs import (
    AskJobQuestionRequest,
    AskJobQuestionResponse,
    CreateJobRequest,
    JobResponse,
    TranslateJobContentRequest,
    TranslateJobContentResponse,
)
from app.services.connectors.public_video import (
    PublicVideoProbeError,
    probe_public_video_metadata,
)
from app.services.connectors.ringcentral import sanitize_ringcentral_url
from app.services.events import job_event_broker
from app.services.ingestion import detect_source_type
from app.services.qa_pipeline import QAAnswerNotReadyError, answer_job_question
from app.tasks import process_analysis_job
from app.services.translations.service import (
    TranslationUnavailableError,
    translate_job_content,
)

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


def run_analysis_job_in_background(job_id: uuid.UUID, bind) -> None:
    background_session_factory = sessionmaker(
        bind=bind,
        autoflush=False,
        autocommit=False,
        future=True,
    )

    def load_job(requested_job_id: uuid.UUID):
        with background_session_factory() as background_session:
            return background_session.get(AnalysisJob, requested_job_id)

    def persist_job(updated_job: AnalysisJob) -> None:
        with background_session_factory() as background_session:
            merged_job = background_session.merge(updated_job)
            background_session.add(merged_job)
            background_session.commit()

    asyncio.run(
        process_analysis_job(
            {
                "publish": lambda event_name, payload: job_event_broker.publish_nowait(
                    str(job_id),
                    event_name,
                    payload,
                ),
                "load_job": load_job,
                "persist_job": persist_job,
            },
            job_id,
        )
    )


def run_public_video_job_in_background(job_id: uuid.UUID, bind) -> None:
    run_analysis_job_in_background(job_id, bind)


@router.post("", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
def create_job(
    payload: CreateJobRequest,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
) -> JobResponse:
    resolved_input_mode = detect_source_type(str(payload.source_url))
    source_url = str(payload.source_url)
    if resolved_input_mode == InputMode.RINGCENTRAL_RECORDING:
        source_url = sanitize_ringcentral_url(source_url)

    job = AnalysisJob(
        input_mode=resolved_input_mode,
        source_url=source_url,
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

        if job.status != JobStatus.FAILED:
            background_tasks.add_task(
                run_public_video_job_in_background,
                job.id,
                session.get_bind(),
            )
    elif job.input_mode == InputMode.RINGCENTRAL_RECORDING:
        background_tasks.add_task(
            run_analysis_job_in_background,
            job.id,
            session.get_bind(),
        )

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


@router.post("/{job_id}/translations", response_model=TranslateJobContentResponse)
def submit_job_translation(
    job_id: uuid.UUID,
    payload: TranslateJobContentRequest,
    session: Session = Depends(get_session),
) -> TranslateJobContentResponse:
    job = session.get(AnalysisJob, job_id)

    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    if payload.content_type not in {"summary", "transcript"}:
        raise HTTPException(status_code=400, detail="Unsupported translation content type")

    source_language_code = job.detected_language_code or "und"
    if payload.content_type == "summary":
        source_text = job.summary_source_text
        translations_json = job.summary_translations_json
    else:
        source_text = job.transcript_source_text
        translations_json = job.transcript_translations_json

    if not source_text:
        raise HTTPException(status_code=409, detail="Source text is not ready for translation yet")

    translations = json.loads(translations_json) if translations_json else {}
    cached_translation = translations.get(payload.target_language_code)
    if cached_translation:
        return TranslateJobContentResponse(
            content_type=payload.content_type,
            job_id=job.id,
            source_language_code=source_language_code,
            target_language_code=payload.target_language_code,
            translated_text=cached_translation,
        )

    try:
        translated_text = translate_job_content(
            source_language_code=source_language_code,
            target_language_code=payload.target_language_code,
            text=source_text,
        )
    except TranslationUnavailableError as exc:
        raise HTTPException(status_code=409, detail=exc.message) from exc

    translations[payload.target_language_code] = translated_text
    if payload.content_type == "summary":
        job.summary_translations_json = json.dumps(translations, ensure_ascii=False)
    else:
        job.transcript_translations_json = json.dumps(translations, ensure_ascii=False)

    session.add(job)
    session.commit()
    session.refresh(job)

    return TranslateJobContentResponse(
        content_type=payload.content_type,
        job_id=job.id,
        source_language_code=source_language_code,
        target_language_code=payload.target_language_code,
        translated_text=translated_text,
    )
