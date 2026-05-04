import inspect
from uuid import UUID

from app.models.job import InputMode, JobStatus
from app.services.connectors.public_video import (
    PublicVideoProbeError,
    probe_public_video_metadata,
)
from sqlalchemy.orm import object_session


def _apply_public_video_metadata(job, metadata) -> None:
    job.title = metadata.title
    job.duration_seconds = metadata.duration_seconds
    job.thumbnail_url = metadata.thumbnail_url
    job.source_name = metadata.source_name
    job.description = metadata.description
    job.status = JobStatus.RUNNING
    job.stage = "metadata_ready"


def _mark_public_video_download_ready(job) -> None:
    job.status = JobStatus.RUNNING
    job.stage = "download_ready"


def _mark_public_video_probe_failure(job, exc: PublicVideoProbeError) -> None:
    job.status = JobStatus.FAILED
    job.stage = exc.reason


def _persist_loaded_job(job) -> None:
    session = object_session(job)
    if session is None:
        return

    session.add(job)
    session.commit()
    session.refresh(job)


async def _resolve(value):
    if inspect.isawaitable(value):
        return await value
    return value


async def process_analysis_job(ctx: dict, job_id: UUID) -> None:
    """Publish metadata for a queued analysis job when enough context is available."""

    publisher = ctx.get("publish") or ctx.get("publisher") or ctx.get("event_publisher")
    if publisher is None:
        return None

    load_job = ctx.get("load_job") or ctx.get("job_loader")
    if load_job is None:
        result = publisher("video.metadata", {"job_id": str(job_id)})
        if inspect.isawaitable(result):
            await result
        return None

    job = await _resolve(load_job(job_id))
    if job is None or job.input_mode != InputMode.PUBLIC_VIDEO:
        result = publisher("video.metadata", {"job_id": str(job_id)})
        if inspect.isawaitable(result):
            await result
        return None

    if job.status == JobStatus.FAILED or job.stage == "download_ready":
        return None

    persist_job = ctx.get("persist_job") or _persist_loaded_job

    if job.stage == "metadata_ready":
        _mark_public_video_download_ready(job)
        await _resolve(persist_job(job))
        result = publisher(
            "job.status",
            {
                "job_id": str(job_id),
                "status": job.status.value,
                "stage": job.stage,
            },
        )
        if inspect.isawaitable(result):
            await result
        return None

    probe_metadata = ctx.get("probe_public_video_metadata") or probe_public_video_metadata
    try:
        metadata = await _resolve(probe_metadata(job.source_url))
    except PublicVideoProbeError as exc:
        _mark_public_video_probe_failure(job, exc)
        await _resolve(persist_job(job))
        result = publisher(
            "error",
            {
                "job_id": str(job_id),
                "reason": exc.reason,
                "message": exc.message,
            },
        )
        if inspect.isawaitable(result):
            await result
        return None

    _apply_public_video_metadata(job, metadata)
    await _resolve(persist_job(job))
    result = publisher(
        "video.metadata",
        {"job_id": str(job_id), "metadata": metadata.model_dump()},
    )
    if inspect.isawaitable(result):
        await result

    _mark_public_video_download_ready(job)
    await _resolve(persist_job(job))
    result = publisher(
        "job.status",
        {
            "job_id": str(job_id),
            "status": job.status.value,
            "stage": job.stage,
        },
    )
    if inspect.isawaitable(result):
        await result

    return None
