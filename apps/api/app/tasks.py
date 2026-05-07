import asyncio
import inspect
import json
from types import SimpleNamespace
from uuid import UUID

from app.models.job import InputMode, JobStatus
from app.services.connectors.public_video import (
    PublicVideoProbeError,
    probe_public_video_metadata,
)
from app.services.connectors.ringcentral import RingCentralProbeError
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
    available_formats = getattr(download_shell, "available_formats", None)
    if available_formats is not None:
        job.download_formats_json = json.dumps(
            [
                format_choice.model_dump()
                if hasattr(format_choice, "model_dump")
                else dict(format_choice)
                for format_choice in available_formats
            ]
        )
    job.status = JobStatus.RUNNING
    job.stage = download_shell.stage


def _apply_public_video_download_progress(job, progress_payload: dict) -> None:
    job.download_progress_json = json.dumps(progress_payload)
    job.download_status = progress_payload.get("status") or "downloading"
    if progress_payload.get("status") == "downloading":
        job.status = JobStatus.RUNNING
        job.stage = "downloading"


def _mark_public_video_probe_failure(job, exc: PublicVideoProbeError) -> None:
    job.status = JobStatus.FAILED
    job.stage = exc.reason


def _mark_public_video_download_failure(job, exc: PublicVideoDownloadError) -> None:
    job.status = JobStatus.FAILED
    job.stage = exc.reason
    job.download_status = "failed"


def _mark_ringcentral_probe_failure(job, exc: RingCentralProbeError) -> None:
    job.status = JobStatus.FAILED
    job.stage = exc.reason
    job.diagnostics_json = json.dumps([exc.diagnostic().model_dump()])


def _apply_public_video_transcript_shell(
    job,
    transcript_shell: PublicVideoTranscriptShell,
) -> None:
    job.transcript_status = transcript_shell.status
    job.transcript_extractor = transcript_shell.extractor
    job.transcript_audio_artifact_path = transcript_shell.audio_artifact_path
    job.status = JobStatus.RUNNING
    job.stage = transcript_shell.stage


def _mark_public_video_transcript_execution_started(job) -> None:
    job.transcript_status = "processing"
    job.transcript_preview_text = (
        "Preparing the speech model. First transcript lines may take a moment."
    )
    job.transcript_segment_count = 0
    job.status = JobStatus.RUNNING
    job.stage = "generating_transcript"


def _mark_public_video_transcript_failure(job, exc: PublicVideoTranscriptShellError) -> None:
    job.status = JobStatus.FAILED
    job.stage = exc.reason
    job.transcript_status = "failed"


def _apply_public_video_transcript_result(
    job,
    transcript_result: PublicVideoTranscriptResult,
) -> None:
    job.transcript_status = transcript_result.status
    job.detected_language_code = getattr(transcript_result, "detected_language_code", None)
    job.detected_language_name = getattr(transcript_result, "detected_language_name", None)
    job.transcript_preview_text = getattr(transcript_result, "preview_text", None)
    job.transcript_source_text = getattr(transcript_result, "source_text", None)
    source_segments_json = getattr(transcript_result, "source_segments_json", None)
    job.transcript_source_segments_json = (
        source_segments_json()
        if callable(source_segments_json)
        else source_segments_json
        if isinstance(source_segments_json, str)
        else None
    )
    job.transcript_segment_count = getattr(transcript_result, "segment_count", None)
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
    job.summary_preview_text = getattr(summary_shell, "preview_text", None)
    job.summary_source_text = getattr(summary_shell, "source_text", None)
    source_bullets_json = getattr(summary_shell, "source_bullets_json", None)
    job.summary_source_bullets_json = (
        source_bullets_json() if callable(source_bullets_json) else None
    )
    structured_json = getattr(summary_shell, "summary_structured_json", None)
    job.summary_structured_json = (
        structured_json() if callable(structured_json) else None
    )
    job.summary_key_points_count = getattr(summary_shell, "key_points_count", None)
    job.status = JobStatus.RUNNING
    job.stage = summary_shell.stage


def _apply_public_video_partial_summary_shell(
    job,
    summary_shell: PublicVideoSummaryShell,
) -> None:
    job.summary_status = "processing"
    job.summary_preview_text = getattr(summary_shell, "preview_text", None)
    job.summary_source_text = getattr(summary_shell, "source_text", None)
    source_bullets_json = getattr(summary_shell, "source_bullets_json", None)
    job.summary_source_bullets_json = (
        source_bullets_json() if callable(source_bullets_json) else None
    )
    structured_json = getattr(summary_shell, "summary_structured_json", None)
    job.summary_structured_json = (
        structured_json() if callable(structured_json) else None
    )
    job.summary_key_points_count = getattr(summary_shell, "key_points_count", None)
    job.status = JobStatus.RUNNING


def _build_partial_summary_shell(
    summary_shell: PublicVideoSummaryShell,
) -> PublicVideoSummaryShell:
    source_bullets = list(summary_shell.source_bullets[:2]) if summary_shell.source_bullets else []

    return PublicVideoSummaryShell(
        status="processing",
        stage="generating_transcript",
        source_text=summary_shell.source_text,
        source_bullets=source_bullets,
        preview_text=summary_shell.preview_text,
        key_points_count=len(source_bullets),
        summary_structured=getattr(summary_shell, "summary_structured", None),
    )


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
    mindmap_nodes_json = getattr(mindmap_shell, "mindmap_nodes_json", None)
    job.mindmap_nodes_json = (
        mindmap_nodes_json() if callable(mindmap_nodes_json) else None
    )
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


async def _flush_download_progress_awaitables(progress_awaitables: list) -> None:
    if not progress_awaitables:
        return

    awaitables = list(progress_awaitables)
    progress_awaitables.clear()
    await asyncio.gather(*awaitables, return_exceptions=True)


def _accepts_keyword_argument(callable_value, argument_name: str) -> bool:
    try:
        signature = inspect.signature(callable_value)
    except (TypeError, ValueError):
        return False

    for parameter in signature.parameters.values():
        if parameter.kind == inspect.Parameter.VAR_KEYWORD:
            return True
        if parameter.name == argument_name:
            return True
    return False


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
    _apply_public_video_download_shell(job, planned_download)
    progress_awaitables = []

    def on_download_progress(progress_payload: dict) -> None:
        payload = (
            progress_payload.model_dump()
            if hasattr(progress_payload, "model_dump")
            else dict(progress_payload)
        )
        _apply_public_video_download_progress(job, payload)

        persist_result = persist_job(job)
        if inspect.isawaitable(persist_result):
            progress_awaitables.append(persist_result)

        publish_result = publisher(
            "video.download.progress",
            {"job_id": str(job_id), "progress": payload},
        )
        if inspect.isawaitable(publish_result):
            progress_awaitables.append(publish_result)

    download_kwargs = {"planned": planned_download}
    if _accepts_keyword_argument(execute_download_shell, "on_progress"):
        download_kwargs["on_progress"] = on_download_progress

    try:
        download_shell = await _resolve(execute_download_shell(job, **download_kwargs))
    except PublicVideoDownloadError as exc:
        await _flush_download_progress_awaitables(progress_awaitables)
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
    except Exception:
        await _flush_download_progress_awaitables(progress_awaitables)
        raise

    await _flush_download_progress_awaitables(progress_awaitables)

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
    generate_summary_shell = (
        ctx.get("generate_public_video_summary_shell")
        or generate_public_video_summary_shell
    )
    _mark_public_video_transcript_execution_started(job)
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
    segment_started = True
    last_partial_summary_segment_count = 0

    def on_transcript_segment(segment_payload: dict[str, object]) -> None:
        nonlocal last_partial_summary_segment_count, segment_started
        if segment_started:
            segment_started = False

        job.transcript_status = "processing"
        job.stage = "generating_transcript"
        job.detected_language_code = (
            segment_payload.get("detected_language_code")
            if isinstance(segment_payload.get("detected_language_code"), str)
            else job.detected_language_code
        )
        job.detected_language_name = (
            segment_payload.get("detected_language_name")
            if isinstance(segment_payload.get("detected_language_name"), str)
            else job.detected_language_name
        )
        job.transcript_preview_text = (
            segment_payload.get("preview_text")
            if isinstance(segment_payload.get("preview_text"), str)
            else job.transcript_preview_text
        )
        job.transcript_source_text = (
            segment_payload.get("source_text")
            if isinstance(segment_payload.get("source_text"), str)
            else job.transcript_source_text
        )
        if isinstance(segment_payload.get("segment_count"), int):
            job.transcript_segment_count = segment_payload["segment_count"]
        if isinstance(segment_payload.get("source_segments"), list):
            job.transcript_source_segments_json = json.dumps(
                segment_payload["source_segments"],
                ensure_ascii=False,
            )

        persist_job(job)
        publish_now = ctx.get("publish")
        if publish_now is not None:
            publish_now(
                "transcript.segment",
                {
                    "job_id": str(job_id),
                    "transcript": segment_payload,
                },
            )
            publish_now(
                "job.status",
                {
                    "job_id": str(job_id),
                    "status": job.status.value,
                    "stage": job.stage,
                },
            )

        if not isinstance(job.transcript_segment_count, int):
            return

        if job.transcript_segment_count < 3 or job.transcript_segment_count % 3 != 0:
            return

        if job.transcript_segment_count == last_partial_summary_segment_count:
            return

        try:
            partial_summary_source = SimpleNamespace(
                transcript_preview_text=job.transcript_preview_text,
                transcript_source_text=job.transcript_source_text,
                transcript_status="ready",
                summary_mode="partial",
            )
            summary_shell = generate_summary_shell(partial_summary_source)
        except PublicVideoSummaryShellError:
            return

        partial_summary_shell = _build_partial_summary_shell(summary_shell)
        _apply_public_video_partial_summary_shell(job, partial_summary_shell)
        last_partial_summary_segment_count = job.transcript_segment_count
        persist_job(job)
        if publish_now is not None:
            publish_now(
                "summary.partial",
                {
                    "job_id": str(job_id),
                    "summary": partial_summary_shell.model_dump(),
                },
            )
    try:
        execute_transcript_signature = inspect.signature(execute_transcript_shell)
        if "on_segment" in execute_transcript_signature.parameters:
            transcript_result = await _resolve(
                execute_transcript_shell(
                    job,
                    on_segment=on_transcript_segment,
                ),
            )
        else:
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
    if job is None:
        await _publish_event(publisher, "video.metadata", {"job_id": str(job_id)})
        return None

    persist_job = ctx.get("persist_job") or _persist_loaded_job

    if job.input_mode == InputMode.RINGCENTRAL_RECORDING:
        if job.status in {JobStatus.FAILED, JobStatus.COMPLETED}:
            return None

        exc = RingCentralProbeError(
            reason="ringcentral_auth_required",
            message="This RingCentral recording requires a signed-in session.",
        )
        _mark_ringcentral_probe_failure(job, exc)
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
        await _publish_event(
            publisher,
            "error",
            {
                "job_id": str(job_id),
                "reason": exc.reason,
                "message": exc.message,
                "diagnostic": exc.diagnostic().model_dump(),
            },
        )
        return None

    if job.input_mode != InputMode.PUBLIC_VIDEO:
        await _publish_event(publisher, "video.metadata", {"job_id": str(job_id)})
        return None

    if job.status in {JobStatus.FAILED, JobStatus.COMPLETED} or job.stage == "download_ready":
        return None

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
