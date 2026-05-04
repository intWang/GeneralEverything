from uuid import UUID
import inspect


async def process_analysis_job(ctx: dict, job_id: UUID) -> None:
    """Stub seam for future `video.metadata` publication."""

    publisher = ctx.get("publish") or ctx.get("publisher") or ctx.get("event_publisher")
    if publisher is None:
        return None

    result = publisher("video.metadata", {"job_id": str(job_id)})
    if inspect.isawaitable(result):
        await result

    return None
