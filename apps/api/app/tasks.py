from uuid import UUID


async def process_analysis_job(ctx: dict, job_id: UUID) -> None:
    # Queue adapters may serialize UUIDs at the boundary, but the worker body
    # uses the persisted identifier type directly.
    return None
