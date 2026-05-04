import inspect
from uuid import UUID

from app.models.job import InputMode
from app.services.connectors.public_video import (
    PublicVideoProbeError,
    probe_public_video_metadata,
)


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

    probe_metadata = ctx.get("probe_public_video_metadata") or probe_public_video_metadata
    try:
        metadata = await _resolve(probe_metadata(job.source_url))
    except PublicVideoProbeError as exc:
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

    result = publisher(
        "video.metadata",
        {"job_id": str(job_id), "metadata": metadata.model_dump()},
    )
    if inspect.isawaitable(result):
        await result

    return None
