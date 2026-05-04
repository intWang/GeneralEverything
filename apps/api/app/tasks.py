import inspect
from uuid import UUID

from app.models.job import InputMode, JobStatus
from app.services.connectors.public_video import (
    PublicVideoProbeError,
    probe_public_video_metadata,
)
from app.services.downloads.public_video import (
    PublicVideoDownloadError,
    PublicVideoDownloadShell,
    execute_public_video_download_shell,
    plan_public_video_download_shell,
)
from app.services.transcripts.public_video import (
    PublicVideoTranscriptExecutionError,
    PublicVideoTranscriptResult,
    PublicVideoTranscriptShell,
    PublicVideoTranscriptShellError,
    execute_public_video_transcript_shell,
    prepare_public_video_transcript_shell,
)
from app.services.summaries.public_video import (
    PublicVideoSummaryShell,
    PublicVideoSummaryShellError,
    generate_public_video_summary_shell,
)
from app.services.mindmaps.public_video import (
    PublicVideoMindMapShell,
    PublicVideoMindMapShellError,
    generate_public_video_mindmap_shell,
)
from app.services.qa_pipeline import qa_is_ready
from sqlalchemy.orm import object_session


def _apply_public_video_metadata(job, metadata) -> None:
    job.title = metadata.title
    job.duration_seconds = metadata.duration_seconds
    job.thumbnail_url = metadata.thumbnail_url
    job.source_name = metadata.source_name
    job.description = metadata.description
    job.status = JobStatus.RUNNING
    job.stage = "metadata_ready"


def _apply_public_video_download_shell(job, download_shell: PublicVideoDownloadShell) -> None:
    job.download_status = download_shell.status
    job.download_executor = download_shell.executor
    job.download_format_id = download_shell.format_id
    job.download_format_label = download_shell.format_label
    job.download_artifact_path = download_shell.artifact_path
    job.status = JobStatus.RUNNING
    job.stage = download_shell.stage


def _mark_public_video_probe_failure(job, exc: PublicVideoProbeError) -> None:
    job.status = JobStatus.FAILED
    job.stage = exc.reason


def _mark_public_video_download_failure(job, exc: PublicVideoDownloadError) -> None:
    job.status = JobStatus.FAILED
    job.stage = exc.reason
    job.download_status = "failed"


def _apply_public_video_transcript_shell(
    job,
    transcript_shell: PublicVideoTranscriptShell,
) -> None:
    job.transcript_status = transcript_shell.status
    job.transcript_extractor = transcript_shell.extractor
    job.transcript_audio_artifact_path = transcript_shell.audio_artifact_path
    job.status = JobStatus.RUNNING
    job.stage = transcript_shell.stage


def _mark_public_video_transcript_failure(job, exc: PublicVideoTranscriptShellError) -> None:
    job.status = JobStatus.FAILED
    job.stage = exc.reason
    job.transcript_status = "failed"


def _apply_public_video_transcript_result(
    job,
    transcript_result: PublicVideoTranscriptResult,
) -> None:
    job.transcript_status = transcript_result.status
    job.transcript_preview_text = transcript_result.preview_text
    job.transcript_segment_count = transcript_result.segment_count
    job.status = JobStatus.RUNNING
    job.stage = transcript_result.stage


def _mark_public_video_transcript_execution_failure(
    job,
    exc: PublicVideoTranscriptExecutionError,
) -> None:
    job.status = JobStatus.FAILED
    job.stage = exc.reason
    job.transcript_status = "failed"


def _apply_public_video_summary_shell(
    job,
    summary_shell: PublicVideoSummaryShell,
) -> None:
    job.summary_status = summary_shell.status
    job.summary_preview_text = summary_shell.preview_text
    job.summary_key_points_count = summary_shell.key_points_count
    job.status = JobStatus.RUNNING
    job.stage = summary_shell.stage


def _mark_public_video_summary_failure(job, exc: PublicVideoSummaryShellError) -> None:
    job.status = JobStatus.FAILED
    job.stage = exc.reason
    job.summary_status = "failed"


def _apply_public_video_mindmap_shell(
    job,
    mindmap_shell: PublicVideoMindMapShell,
) -> None:
    job.mindmap_status = mindmap_shell.status
    job.mindmap_preview_text = mindmap_shell.preview_text
    job.mindmap_node_count = mindmap_shell.node_count
    job.status = JobStatus.RUNNING
    job.stage = mindmap_shell.stage


def _mark_public_video_mindmap_failure(job, exc: PublicVideoMindMapShellError) -> None:
    job.status = JobStatus.FAILED
    job.stage = exc.reason
    job.mindmap_status = "failed"


def _complete_public_video_job(job) -> None:
    job.status = JobStatus.COMPLETED


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


async def _publish_event(publisher, event_name: str, payload: dict) -> None:
    result = publisher(event_name, payload)
    if inspect.isawaitable(result):
        await result


async def _publish_public_video_qa_ready(
    *,
    publisher,
    job,
    job_id: UUID,
) -> None:
    if not qa_is_ready(
        job.transcript_segment_count,
        job.summary_status,
        job.mindmap_status,
    ):
        return

    await _publish_event(
        publisher,
        "qa.ready",
        {
            "job_id": str(job_id),
            "can_submit": True,
            "transcript_segment_count": job.transcript_segment_count,
            "summary_status": job.summary_status,
            "mindmap_status": job.mindmap_status,
        },
    )


async def _execute_public_video_download(
    *,
    ctx: dict,
    publisher,
    persist_job,
    job,
    job_id: UUID,
) -> None:
    plan_download_shell = (
        ctx.get("plan_public_video_download_shell") or plan_public_video_download_shell
    )
    execute_download_shell = (
        ctx.get("execute_public_video_download_shell") or execute_public_video_download_shell
    )

    planned_download = await _resolve(plan_download_shell(job))
    try:
        download_shell = await _resolve(
            execute_download_shell(job, planned=planned_download)
        )
    except PublicVideoDownloadError as exc:
        _mark_public_video_download_failure(job, exc)
        await _resolve(persist_job(job))
        await _publish_event(
            publisher,
            "error",
            {
                "job_id": str(job_id),
                "reason": exc.reason,
                "message": exc.message,
            },
        )
        return

    _apply_public_video_download_shell(job, download_shell)
    await _resolve(persist_job(job))
    await _publish_event(
        publisher,
        "video.download",
        {"job_id": str(job_id), "download": download_shell.model_dump()},
    )
    await _publish_event(
        publisher,
        "job.status",
        {
            "job_id": str(job_id),
            "status": job.status.value,
            "stage": job.stage,
        },
    )

    prepare_transcript_shell = (
        ctx.get("prepare_public_video_transcript_shell")
        or prepare_public_video_transcript_shell
    )
    try:
        transcript_shell = await _resolve(prepare_transcript_shell(job))
    except PublicVideoTranscriptShellError as exc:
        _mark_public_video_transcript_failure(job, exc)
        await _resolve(persist_job(job))
        await _publish_event(
            publisher,
            "error",
            {
                "job_id": str(job_id),
                "reason": exc.reason,
                "message": exc.message,
            },
        )
        return

    _apply_public_video_transcript_shell(job, transcript_shell)
    await _resolve(persist_job(job))
    await _publish_event(
        publisher,
        "transcript.shell",
        {"job_id": str(job_id), "transcript": transcript_shell.model_dump()},
    )
    await _publish_event(
        publisher,
        "job.status",
        {
            "job_id": str(job_id),
            "status": job.status.value,
            "stage": job.stage,
        },
    )

    execute_transcript_shell = (
        ctx.get("execute_public_video_transcript_shell")
        or execute_public_video_transcript_shell
    )
    try:
        transcript_result = await _resolve(execute_transcript_shell(job))
    except PublicVideoTranscriptExecutionError as exc:
        _mark_public_video_transcript_execution_failure(job, exc)
        await _resolve(persist_job(job))
        await _publish_event(
            publisher,
            "error",
            {
                "job_id": str(job_id),
                "reason": exc.reason,
                "message": exc.message,
            },
        )
        return

    _apply_public_video_transcript_result(job, transcript_result)
    await _resolve(persist_job(job))
    await _publish_event(
        publisher,
        "transcript.result",
        {"job_id": str(job_id), "transcript": transcript_result.model_dump()},
    )
    await _publish_event(
        publisher,
        "job.status",
        {
            "job_id": str(job_id),
            "status": job.status.value,
            "stage": job.stage,
        },
    )

    generate_summary_shell = (
        ctx.get("generate_public_video_summary_shell")
        or generate_public_video_summary_shell
    )
    try:
        summary_shell = await _resolve(generate_summary_shell(job))
    except PublicVideoSummaryShellError as exc:
        _mark_public_video_summary_failure(job, exc)
        await _resolve(persist_job(job))
        await _publish_event(
            publisher,
            "error",
            {
                "job_id": str(job_id),
                "reason": exc.reason,
                "message": exc.message,
            },
        )
        return

    _apply_public_video_summary_shell(job, summary_shell)
    await _resolve(persist_job(job))
    await _publish_event(
        publisher,
        "summary.shell",
        {"job_id": str(job_id), "summary": summary_shell.model_dump()},
    )
    await _publish_event(
        publisher,
        "job.status",
        {
            "job_id": str(job_id),
            "status": job.status.value,
            "stage": job.stage,
        },
    )

    generate_mindmap_shell = (
        ctx.get("generate_public_video_mindmap_shell")
        or generate_public_video_mindmap_shell
    )
    try:
        mindmap_shell = await _resolve(generate_mindmap_shell(job))
    except PublicVideoMindMapShellError as exc:
        _mark_public_video_mindmap_failure(job, exc)
        await _resolve(persist_job(job))
        await _publish_event(
            publisher,
            "error",
            {
                "job_id": str(job_id),
                "reason": exc.reason,
                "message": exc.message,
            },
        )
        return

    _apply_public_video_mindmap_shell(job, mindmap_shell)
    await _resolve(persist_job(job))
    await _publish_event(
        publisher,
        "mindmap.shell",
        {"job_id": str(job_id), "mindmap": mindmap_shell.model_dump()},
    )
    await _publish_event(
        publisher,
        "job.status",
        {
            "job_id": str(job_id),
            "status": job.status.value,
            "stage": job.stage,
        },
    )

    await _publish_public_video_qa_ready(
        publisher=publisher,
        job=job,
        job_id=job_id,
    )

    _complete_public_video_job(job)
    await _resolve(persist_job(job))
    await _publish_event(
        publisher,
        "job.status",
        {
            "job_id": str(job_id),
            "status": job.status.value,
            "stage": job.stage,
        },
    )


async def process_analysis_job(ctx: dict, job_id: UUID) -> None:
    """Publish metadata for a queued analysis job when enough context is available."""

    publisher = ctx.get("publish") or ctx.get("publisher") or ctx.get("event_publisher")
    if publisher is None:
        return None

    load_job = ctx.get("load_job") or ctx.get("job_loader")
    if load_job is None:
        await _publish_event(publisher, "video.metadata", {"job_id": str(job_id)})
        return None

    job = await _resolve(load_job(job_id))
    if job is None or job.input_mode != InputMode.PUBLIC_VIDEO:
        await _publish_event(publisher, "video.metadata", {"job_id": str(job_id)})
        return None

    if job.status in {JobStatus.FAILED, JobStatus.COMPLETED} or job.stage == "download_ready":
        return None

    persist_job = ctx.get("persist_job") or _persist_loaded_job

    if job.stage == "metadata_ready":
        await _execute_public_video_download(
            ctx=ctx,
            publisher=publisher,
            persist_job=persist_job,
            job=job,
            job_id=job_id,
        )
        return None

    probe_metadata = ctx.get("probe_public_video_metadata") or probe_public_video_metadata
    try:
        metadata = await _resolve(probe_metadata(job.source_url))
    except PublicVideoProbeError as exc:
        _mark_public_video_probe_failure(job, exc)
        await _resolve(persist_job(job))
        await _publish_event(
            publisher,
            "error",
            {
                "job_id": str(job_id),
                "reason": exc.reason,
                "message": exc.message,
            },
        )
        return None

    _apply_public_video_metadata(job, metadata)
    await _resolve(persist_job(job))
    await _publish_event(
        publisher,
        "video.metadata",
        {"job_id": str(job_id), "metadata": metadata.model_dump()},
    )

    await _execute_public_video_download(
        ctx=ctx,
        publisher=publisher,
        persist_job=persist_job,
        job=job,
        job_id=job_id,
    )
    return None
