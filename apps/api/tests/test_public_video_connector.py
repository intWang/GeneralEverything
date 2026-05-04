import asyncio
import subprocess
from types import SimpleNamespace
from uuid import UUID

from app.models.job import AnalysisJob, InputMode, JobStatus
from app.schemas.video_metadata import VideoMetadata
from app.tasks import process_analysis_job
from app.services.connectors.public_video import (
    PublicVideoProbeError,
    normalize_yt_dlp_metadata,
    probe_public_video_metadata,
)
from app.services.downloads.public_video import PublicVideoDownloadError


def test_normalizes_public_video_metadata() -> None:
    metadata = normalize_yt_dlp_metadata(
        {
            "title": "Sample Video",
            "duration": 120,
            "thumbnail": "https://example.com/thumb.jpg",
            "uploader": "Example Channel",
            "description": "A short description",
        }
    )

    assert metadata.title == "Sample Video"
    assert metadata.duration_seconds == 120
    assert metadata.thumbnail_url == "https://example.com/thumb.jpg"
    assert metadata.source_name == "Example Channel"


def test_probe_public_video_metadata_returns_normalized_metadata() -> None:
    def run_probe(command: list[str], **_: object) -> subprocess.CompletedProcess[str]:
        assert command == [
            "yt-dlp",
            "--dump-single-json",
            "--skip-download",
            "https://example.com/video",
        ]
        return subprocess.CompletedProcess(
            args=command,
            returncode=0,
            stdout=(
                '{"title":"Sample Video","duration":120,'
                '"thumbnail":"https://example.com/thumb.jpg",'
                '"uploader":"Example Channel","description":"A short description"}'
            ),
            stderr="",
        )

    metadata = probe_public_video_metadata(
        "https://example.com/video",
        run_probe=run_probe,
    )

    assert metadata == VideoMetadata(
        title="Sample Video",
        duration_seconds=120,
        thumbnail_url="https://example.com/thumb.jpg",
        source_name="Example Channel",
        description="A short description",
    )


def test_probe_public_video_metadata_raises_normalized_error() -> None:
    def run_probe(command: list[str], **_: object) -> subprocess.CompletedProcess[str]:
        return subprocess.CompletedProcess(
            args=command,
            returncode=1,
            stdout="",
            stderr="ERROR: Unsupported URL",
        )

    try:
        probe_public_video_metadata(
            "https://example.com/video",
            run_probe=run_probe,
        )
    except PublicVideoProbeError as exc:
        assert exc.reason == "unsupported_url"
        assert "Unsupported URL" in exc.message
    else:
        raise AssertionError("Expected PublicVideoProbeError")


def test_probe_public_video_metadata_raises_tool_missing_error() -> None:
    def run_probe(command: list[str], **_: object) -> subprocess.CompletedProcess[str]:
        raise FileNotFoundError(command[0])

    try:
        probe_public_video_metadata(
            "https://example.com/video",
            run_probe=run_probe,
        )
    except PublicVideoProbeError as exc:
        assert exc.reason == "tool_missing"
        assert "yt-dlp" in exc.message
    else:
        raise AssertionError("Expected PublicVideoProbeError")


def test_probe_public_video_metadata_raises_invalid_output_error() -> None:
    def run_probe(command: list[str], **_: object) -> subprocess.CompletedProcess[str]:
        return subprocess.CompletedProcess(
            args=command,
            returncode=0,
            stdout="{not-json",
            stderr="",
        )

    try:
        probe_public_video_metadata(
            "https://example.com/video",
            run_probe=run_probe,
        )
    except PublicVideoProbeError as exc:
        assert exc.reason == "invalid_output"
        assert "malformed" in exc.message
    else:
        raise AssertionError("Expected PublicVideoProbeError")


def test_process_analysis_job_publishes_probed_metadata_event() -> None:
    calls = []
    persisted_jobs = []
    job = AnalysisJob(
        id=UUID("12345678-1234-5678-1234-567812345678"),
        input_mode=InputMode.PUBLIC_VIDEO,
        source_url="https://example.com/video",
        status=JobStatus.QUEUED,
        stage="queued",
    )

    def publish(event_name: str, payload: dict) -> None:
        calls.append((event_name, payload))

    def load_job(requested_job_id: UUID) -> AnalysisJob:
        assert requested_job_id == job.id
        return job

    def probe_metadata(source_url: str) -> VideoMetadata:
        assert source_url == "https://example.com/video"
        return VideoMetadata(
            title="Sample Video",
            duration_seconds=120,
            thumbnail_url="https://example.com/thumb.jpg",
            source_name="Example Channel",
            description="A short description",
        )

    def persist_job(updated_job: AnalysisJob) -> None:
        persisted_jobs.append((updated_job.status.value, updated_job.stage))

    planned_download = SimpleNamespace(
        status="queued",
        stage="queued_download",
        executor="yt-dlp",
        format_id="best",
        format_label="Best available",
        artifact_path="var/downloads/public-video/12345678-1234-5678-1234-567812345678.%(ext)s",
    )

    def execute_download(_job: AnalysisJob, planned=None) -> SimpleNamespace:
        assert planned is planned_download
        return SimpleNamespace(
            status="ready",
            stage="download_ready",
            executor="yt-dlp",
            format_id="best",
            format_label="Best available",
            artifact_path="var/downloads/public-video/12345678-1234-5678-1234-567812345678.mp4",
            model_dump=lambda: {
                "status": "ready",
                "stage": "download_ready",
                "executor": "yt-dlp",
                "format_id": "best",
                "format_label": "Best available",
                "artifact_path": "var/downloads/public-video/12345678-1234-5678-1234-567812345678.mp4",
            },
        )

    def prepare_transcript(_job: AnalysisJob) -> SimpleNamespace:
        return SimpleNamespace(
            status="ready",
            stage="transcript_ready",
            extractor="ffmpeg",
            audio_artifact_path="var/transcripts/public-video/12345678-1234-5678-1234-567812345678.wav",
            model_dump=lambda: {
                "status": "ready",
                "stage": "transcript_ready",
                "extractor": "ffmpeg",
                "audio_artifact_path": "var/transcripts/public-video/12345678-1234-5678-1234-567812345678.wav",
            },
        )

    def execute_transcript(_job: AnalysisJob) -> SimpleNamespace:
        return SimpleNamespace(
            status="ready",
            stage="transcript_generated",
            preview_text="Transcript shell generated for 12345678-1234-5678-1234-567812345678.wav.",
            segment_count=1,
            model_dump=lambda: {
                "status": "ready",
                "stage": "transcript_generated",
                "preview_text": "Transcript shell generated for 12345678-1234-5678-1234-567812345678.wav.",
                "segment_count": 1,
            },
        )

    def generate_summary(_job: AnalysisJob) -> SimpleNamespace:
        return SimpleNamespace(
            status="ready",
            stage="summary_generated",
            preview_text="Summary shell generated from transcript preview.",
            key_points_count=1,
            model_dump=lambda: {
                "status": "ready",
                "stage": "summary_generated",
                "preview_text": "Summary shell generated from transcript preview.",
                "key_points_count": 1,
            },
        )

    def generate_mindmap(_job: AnalysisJob) -> SimpleNamespace:
        return SimpleNamespace(
            status="ready",
            stage="mindmap_generated",
            preview_text="Mind map shell generated from summary preview.",
            node_count=1,
            model_dump=lambda: {
                "status": "ready",
                "stage": "mindmap_generated",
                "preview_text": "Mind map shell generated from summary preview.",
                "node_count": 1,
            },
        )

    asyncio.run(
        process_analysis_job(
            {
                "publish": publish,
                "load_job": load_job,
                "persist_job": persist_job,
                "probe_public_video_metadata": probe_metadata,
                "plan_public_video_download_shell": lambda current_job: planned_download,
                "execute_public_video_download_shell": execute_download,
                "prepare_public_video_transcript_shell": prepare_transcript,
                "execute_public_video_transcript_shell": execute_transcript,
                "generate_public_video_summary_shell": generate_summary,
                "generate_public_video_mindmap_shell": generate_mindmap,
            },
            UUID("12345678-1234-5678-1234-567812345678"),
        )
    )

    assert calls == [
        (
            "video.metadata",
            {
                "job_id": "12345678-1234-5678-1234-567812345678",
                "metadata": {
                    "title": "Sample Video",
                    "duration_seconds": 120,
                    "thumbnail_url": "https://example.com/thumb.jpg",
                    "source_name": "Example Channel",
                    "description": "A short description",
                },
            },
        ),
        (
            "video.download",
            {
                "job_id": "12345678-1234-5678-1234-567812345678",
                "download": {
                    "status": "ready",
                    "stage": "download_ready",
                    "executor": "yt-dlp",
                    "format_id": "best",
                    "format_label": "Best available",
                    "artifact_path": "var/downloads/public-video/12345678-1234-5678-1234-567812345678.mp4",
                },
            },
        ),
        (
            "transcript.shell",
            {
                "job_id": "12345678-1234-5678-1234-567812345678",
                "transcript": {
                    "status": "ready",
                    "stage": "transcript_ready",
                    "extractor": "ffmpeg",
                    "audio_artifact_path": "var/transcripts/public-video/12345678-1234-5678-1234-567812345678.wav",
                },
            },
        ),
        (
            "job.status",
            {
                "job_id": "12345678-1234-5678-1234-567812345678",
                "status": "running",
                "stage": "download_ready",
            },
        ),
        (
            "job.status",
            {
                "job_id": "12345678-1234-5678-1234-567812345678",
                "status": "running",
                "stage": "transcript_ready",
            },
        ),
        (
            "transcript.result",
            {
                "job_id": "12345678-1234-5678-1234-567812345678",
                "transcript": {
                    "status": "ready",
                    "stage": "transcript_generated",
                    "preview_text": "Transcript shell generated for 12345678-1234-5678-1234-567812345678.wav.",
                    "segment_count": 1,
                },
            },
        ),
        (
            "job.status",
            {
                "job_id": "12345678-1234-5678-1234-567812345678",
                "status": "running",
                "stage": "transcript_generated",
            },
        ),
        (
            "summary.shell",
            {
                "job_id": "12345678-1234-5678-1234-567812345678",
                "summary": {
                    "status": "ready",
                    "stage": "summary_generated",
                    "preview_text": "Summary shell generated from transcript preview.",
                    "key_points_count": 1,
                },
            },
        ),
        (
            "job.status",
            {
                "job_id": "12345678-1234-5678-1234-567812345678",
                "status": "running",
                "stage": "summary_generated",
            },
        ),
        (
            "mindmap.shell",
            {
                "job_id": "12345678-1234-5678-1234-567812345678",
                "mindmap": {
                    "status": "ready",
                    "stage": "mindmap_generated",
                    "preview_text": "Mind map shell generated from summary preview.",
                    "node_count": 1,
                },
            },
        ),
        (
            "job.status",
            {
                "job_id": "12345678-1234-5678-1234-567812345678",
                "status": "running",
                "stage": "mindmap_generated",
            },
        ),
        (
            "job.status",
            {
                "job_id": "12345678-1234-5678-1234-567812345678",
                "status": "completed",
                "stage": "mindmap_generated",
            },
        ),
    ]
    assert persisted_jobs == [
        ("running", "metadata_ready"),
        ("running", "download_ready"),
        ("running", "transcript_ready"),
        ("running", "transcript_generated"),
        ("running", "summary_generated"),
        ("running", "mindmap_generated"),
        ("completed", "mindmap_generated"),
    ]
    assert job.title == "Sample Video"
    assert job.duration_seconds == 120
    assert job.thumbnail_url == "https://example.com/thumb.jpg"
    assert job.source_name == "Example Channel"
    assert job.description == "A short description"
    assert job.download_status == "ready"
    assert job.download_executor == "yt-dlp"
    assert job.download_format_id == "best"
    assert job.download_format_label == "Best available"
    assert job.download_artifact_path.endswith(".mp4")
    assert job.transcript_status == "ready"
    assert job.transcript_extractor == "ffmpeg"
    assert job.transcript_audio_artifact_path.endswith(".wav")
    assert job.transcript_preview_text == "Transcript shell generated for 12345678-1234-5678-1234-567812345678.wav."
    assert job.transcript_segment_count == 1
    assert job.summary_status == "ready"
    assert job.summary_preview_text == "Summary shell generated from transcript preview."
    assert job.summary_key_points_count == 1
    assert job.mindmap_status == "ready"
    assert job.mindmap_preview_text == "Mind map shell generated from summary preview."
    assert job.mindmap_node_count == 1
    assert job.status == JobStatus.COMPLETED
    assert job.stage == "mindmap_generated"


def test_process_analysis_job_publishes_normalized_probe_error() -> None:
    calls = []
    persisted_jobs = []
    job = AnalysisJob(
        id=UUID("12345678-1234-5678-1234-567812345678"),
        input_mode=InputMode.PUBLIC_VIDEO,
        source_url="https://example.com/video",
        status=JobStatus.QUEUED,
        stage="queued",
    )

    def publish(event_name: str, payload: dict) -> None:
        calls.append((event_name, payload))

    def load_job(requested_job_id: UUID) -> AnalysisJob:
        assert requested_job_id == job.id
        return job

    def probe_metadata(_source_url: str) -> VideoMetadata:
        raise PublicVideoProbeError(
            reason="unsupported_url",
            message="ERROR: Unsupported URL",
        )

    def persist_job(updated_job: AnalysisJob) -> None:
        persisted_jobs.append(updated_job)

    asyncio.run(
        process_analysis_job(
            {
                "publish": publish,
                "load_job": load_job,
                "persist_job": persist_job,
                "probe_public_video_metadata": probe_metadata,
            },
            UUID("12345678-1234-5678-1234-567812345678"),
        )
    )

    assert calls == [
        (
            "error",
            {
                "job_id": "12345678-1234-5678-1234-567812345678",
                "reason": "unsupported_url",
                "message": "ERROR: Unsupported URL",
            },
        )
    ]
    assert persisted_jobs == [job]
    assert job.status == JobStatus.FAILED
    assert job.stage == "unsupported_url"


def test_process_analysis_job_publishes_qa_ready_event_when_grounding_is_ready() -> None:
    calls = []
    persisted_jobs = []
    job = AnalysisJob(
        id=UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
        input_mode=InputMode.PUBLIC_VIDEO,
        source_url="https://example.com/video",
        status=JobStatus.QUEUED,
        stage="queued",
    )

    def publish(event_name: str, payload: dict) -> None:
        calls.append((event_name, payload))

    def load_job(requested_job_id: UUID) -> AnalysisJob:
        assert requested_job_id == job.id
        return job

    def probe_metadata(_source_url: str) -> VideoMetadata:
        return VideoMetadata(
            title="Sample Video",
            duration_seconds=120,
            thumbnail_url="https://example.com/thumb.jpg",
            source_name="Example Channel",
            description="A short description",
        )

    def persist_job(updated_job: AnalysisJob) -> None:
        persisted_jobs.append((updated_job.status.value, updated_job.stage))

    planned_download = SimpleNamespace(
        status="queued",
        stage="queued_download",
        executor="yt-dlp",
        format_id="best",
        format_label="Best available",
        artifact_path="var/downloads/public-video/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.%(ext)s",
    )

    def execute_download(_job: AnalysisJob, planned=None) -> SimpleNamespace:
        assert planned is planned_download
        return SimpleNamespace(
            status="ready",
            stage="download_ready",
            executor="yt-dlp",
            format_id="best",
            format_label="Best available",
            artifact_path="var/downloads/public-video/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.mp4",
            model_dump=lambda: {
                "status": "ready",
                "stage": "download_ready",
                "executor": "yt-dlp",
                "format_id": "best",
                "format_label": "Best available",
                "artifact_path": "var/downloads/public-video/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.mp4",
            },
        )

    def prepare_transcript(_job: AnalysisJob) -> SimpleNamespace:
        return SimpleNamespace(
            status="ready",
            stage="transcript_ready",
            extractor="ffmpeg",
            audio_artifact_path="var/transcripts/public-video/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.wav",
            model_dump=lambda: {
                "status": "ready",
                "stage": "transcript_ready",
                "extractor": "ffmpeg",
                "audio_artifact_path": "var/transcripts/public-video/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.wav",
            },
        )

    def execute_transcript(_job: AnalysisJob) -> SimpleNamespace:
        return SimpleNamespace(
            status="ready",
            stage="transcript_generated",
            preview_text="Transcript shell generated for aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.wav.",
            segment_count=3,
            model_dump=lambda: {
                "status": "ready",
                "stage": "transcript_generated",
                "preview_text": "Transcript shell generated for aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.wav.",
                "segment_count": 3,
            },
        )

    def generate_summary(_job: AnalysisJob) -> SimpleNamespace:
        return SimpleNamespace(
            status="ready",
            stage="summary_generated",
            preview_text="Summary shell generated from transcript preview.",
            key_points_count=2,
            model_dump=lambda: {
                "status": "ready",
                "stage": "summary_generated",
                "preview_text": "Summary shell generated from transcript preview.",
                "key_points_count": 2,
            },
        )

    def generate_mindmap(_job: AnalysisJob) -> SimpleNamespace:
        return SimpleNamespace(
            status="ready",
            stage="mindmap_generated",
            preview_text="Mind map shell generated from summary preview.",
            node_count=2,
            model_dump=lambda: {
                "status": "ready",
                "stage": "mindmap_generated",
                "preview_text": "Mind map shell generated from summary preview.",
                "node_count": 2,
            },
        )

    asyncio.run(
        process_analysis_job(
            {
                "publish": publish,
                "load_job": load_job,
                "persist_job": persist_job,
                "probe_public_video_metadata": probe_metadata,
                "plan_public_video_download_shell": lambda current_job: planned_download,
                "execute_public_video_download_shell": execute_download,
                "prepare_public_video_transcript_shell": prepare_transcript,
                "execute_public_video_transcript_shell": execute_transcript,
                "generate_public_video_summary_shell": generate_summary,
                "generate_public_video_mindmap_shell": generate_mindmap,
            },
            UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
        )
    )

    assert (
        "qa.ready",
        {
            "job_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            "can_submit": True,
            "mindmap_status": "ready",
            "summary_status": "ready",
            "transcript_segment_count": 3,
        },
    ) in calls
    assert persisted_jobs[-1] == ("completed", "mindmap_generated")


def test_process_analysis_job_skips_completed_public_video_jobs() -> None:
    calls = []
    persisted_jobs = []
    job = AnalysisJob(
        id=UUID("99999999-9999-9999-9999-999999999999"),
        input_mode=InputMode.PUBLIC_VIDEO,
        source_url="https://example.com/video",
        status=JobStatus.COMPLETED,
        stage="mindmap_generated",
    )

    def publish(event_name: str, payload: dict) -> None:
        calls.append((event_name, payload))

    def load_job(requested_job_id: UUID) -> AnalysisJob:
        assert requested_job_id == job.id
        return job

    def persist_job(updated_job: AnalysisJob) -> None:
        persisted_jobs.append(updated_job)

    asyncio.run(
        process_analysis_job(
            {
                "publish": publish,
                "load_job": load_job,
                "persist_job": persist_job,
            },
            UUID("99999999-9999-9999-9999-999999999999"),
        )
    )

    assert calls == []
    assert persisted_jobs == []


def test_process_analysis_job_skips_reprobe_when_metadata_ready() -> None:
    calls = []
    persisted_jobs = []
    job = AnalysisJob(
        id=UUID("12345678-1234-5678-1234-567812345678"),
        input_mode=InputMode.PUBLIC_VIDEO,
        source_url="https://example.com/video",
        status=JobStatus.RUNNING,
        stage="metadata_ready",
        title="Already Probed",
    )

    def publish(event_name: str, payload: dict) -> None:
        calls.append((event_name, payload))

    def load_job(requested_job_id: UUID) -> AnalysisJob:
        assert requested_job_id == job.id
        return job

    def probe_metadata(_source_url: str) -> VideoMetadata:
        raise AssertionError("probe should not run when metadata is already ready")

    def persist_job(updated_job: AnalysisJob) -> None:
        persisted_jobs.append((updated_job.status.value, updated_job.stage))

    planned_download = SimpleNamespace(
        status="queued",
        stage="queued_download",
        executor="yt-dlp",
        format_id="best",
        format_label="Best available",
        artifact_path="var/downloads/public-video/12345678-1234-5678-1234-567812345678.%(ext)s",
    )

    def execute_download(_job: AnalysisJob, planned=None) -> SimpleNamespace:
        assert planned is planned_download
        return SimpleNamespace(
            status="ready",
            stage="download_ready",
            executor="yt-dlp",
            format_id="best",
            format_label="Best available",
            artifact_path="var/downloads/public-video/12345678-1234-5678-1234-567812345678.mp4",
            model_dump=lambda: {
                "status": "ready",
                "stage": "download_ready",
                "executor": "yt-dlp",
                "format_id": "best",
                "format_label": "Best available",
                "artifact_path": "var/downloads/public-video/12345678-1234-5678-1234-567812345678.mp4",
            },
        )

    def prepare_transcript(_job: AnalysisJob) -> SimpleNamespace:
        return SimpleNamespace(
            status="ready",
            stage="transcript_ready",
            extractor="ffmpeg",
            audio_artifact_path="var/transcripts/public-video/12345678-1234-5678-1234-567812345678.wav",
            model_dump=lambda: {
                "status": "ready",
                "stage": "transcript_ready",
                "extractor": "ffmpeg",
                "audio_artifact_path": "var/transcripts/public-video/12345678-1234-5678-1234-567812345678.wav",
            },
        )

    def execute_transcript(_job: AnalysisJob) -> SimpleNamespace:
        return SimpleNamespace(
            status="ready",
            stage="transcript_generated",
            preview_text="Transcript shell generated for 12345678-1234-5678-1234-567812345678.wav.",
            segment_count=1,
            model_dump=lambda: {
                "status": "ready",
                "stage": "transcript_generated",
                "preview_text": "Transcript shell generated for 12345678-1234-5678-1234-567812345678.wav.",
                "segment_count": 1,
            },
        )

    def generate_summary(_job: AnalysisJob) -> SimpleNamespace:
        return SimpleNamespace(
            status="ready",
            stage="summary_generated",
            preview_text="Summary shell generated from transcript preview.",
            key_points_count=1,
            model_dump=lambda: {
                "status": "ready",
                "stage": "summary_generated",
                "preview_text": "Summary shell generated from transcript preview.",
                "key_points_count": 1,
            },
        )

    asyncio.run(
        process_analysis_job(
            {
                "publish": publish,
                "load_job": load_job,
                "persist_job": persist_job,
                "probe_public_video_metadata": probe_metadata,
                "plan_public_video_download_shell": lambda current_job: planned_download,
                "execute_public_video_download_shell": execute_download,
                "prepare_public_video_transcript_shell": prepare_transcript,
                "execute_public_video_transcript_shell": execute_transcript,
                "generate_public_video_summary_shell": generate_summary,
            },
            UUID("12345678-1234-5678-1234-567812345678"),
        )
    )

    assert calls == [
        (
            "video.download",
            {
                "job_id": "12345678-1234-5678-1234-567812345678",
                "download": {
                    "status": "ready",
                    "stage": "download_ready",
                    "executor": "yt-dlp",
                    "format_id": "best",
                    "format_label": "Best available",
                    "artifact_path": "var/downloads/public-video/12345678-1234-5678-1234-567812345678.mp4",
                },
            },
        ),
        (
            "job.status",
            {
                "job_id": "12345678-1234-5678-1234-567812345678",
                "status": "running",
                "stage": "download_ready",
            },
        ),
        (
            "transcript.shell",
            {
                "job_id": "12345678-1234-5678-1234-567812345678",
                "transcript": {
                    "status": "ready",
                    "stage": "transcript_ready",
                    "extractor": "ffmpeg",
                    "audio_artifact_path": "var/transcripts/public-video/12345678-1234-5678-1234-567812345678.wav",
                },
            },
        ),
        (
            "job.status",
            {
                "job_id": "12345678-1234-5678-1234-567812345678",
                "status": "running",
                "stage": "transcript_ready",
            },
        ),
        (
            "transcript.result",
            {
                "job_id": "12345678-1234-5678-1234-567812345678",
                "transcript": {
                    "status": "ready",
                    "stage": "transcript_generated",
                    "preview_text": "Transcript shell generated for 12345678-1234-5678-1234-567812345678.wav.",
                    "segment_count": 1,
                },
            },
        ),
        (
            "job.status",
            {
                "job_id": "12345678-1234-5678-1234-567812345678",
                "status": "running",
                "stage": "transcript_generated",
            },
        ),
        (
            "summary.shell",
            {
                "job_id": "12345678-1234-5678-1234-567812345678",
                "summary": {
                    "status": "ready",
                    "stage": "summary_generated",
                    "preview_text": "Summary shell generated from transcript preview.",
                    "key_points_count": 1,
                },
            },
        ),
        (
            "job.status",
            {
                "job_id": "12345678-1234-5678-1234-567812345678",
                "status": "running",
                "stage": "summary_generated",
            },
        ),
    ]
    assert persisted_jobs == [("running", "download_ready"), ("running", "transcript_ready"), ("running", "transcript_generated"), ("running", "summary_generated")]
    assert job.stage == "summary_generated"
    assert job.download_status == "ready"
    assert job.download_executor == "yt-dlp"


def test_process_analysis_job_skips_reprobe_when_job_failed() -> None:
    calls = []
    job = AnalysisJob(
        id=UUID("12345678-1234-5678-1234-567812345678"),
        input_mode=InputMode.PUBLIC_VIDEO,
        source_url="https://example.com/video",
        status=JobStatus.FAILED,
        stage="unsupported_url",
    )

    def publish(event_name: str, payload: dict) -> None:
        calls.append((event_name, payload))

    def load_job(requested_job_id: UUID) -> AnalysisJob:
        assert requested_job_id == job.id
        return job

    def probe_metadata(_source_url: str) -> VideoMetadata:
        raise AssertionError("probe should not run when job is already failed")

    asyncio.run(
        process_analysis_job(
            {
                "publish": publish,
                "load_job": load_job,
                "probe_public_video_metadata": probe_metadata,
            },
            UUID("12345678-1234-5678-1234-567812345678"),
        )
    )

    assert calls == []


def test_process_analysis_job_does_not_advance_transcript_when_download_artifact_missing() -> None:
    calls = []
    persisted_jobs = []
    job = AnalysisJob(
        id=UUID("12345678-1234-5678-1234-567812345678"),
        input_mode=InputMode.PUBLIC_VIDEO,
        source_url="https://example.com/video",
        status=JobStatus.RUNNING,
        stage="metadata_ready",
        title="Already Probed",
    )

    def publish(event_name: str, payload: dict) -> None:
        calls.append((event_name, payload))

    def load_job(requested_job_id: UUID) -> AnalysisJob:
        assert requested_job_id == job.id
        return job

    def probe_metadata(_source_url: str) -> VideoMetadata:
        raise AssertionError("probe should not run when metadata is already ready")

    def persist_job(updated_job: AnalysisJob) -> None:
        persisted_jobs.append((updated_job.status.value, updated_job.stage))

    planned_download = SimpleNamespace(
        status="queued",
        stage="queued_download",
        executor="yt-dlp",
        format_id="best",
        format_label="Best available",
        artifact_path="var/downloads/public-video/12345678-1234-5678-1234-567812345678.%(ext)s",
    )

    def execute_download(_job: AnalysisJob, planned=None) -> SimpleNamespace:
        assert planned is planned_download
        return SimpleNamespace(
            status="ready",
            stage="download_ready",
            executor="yt-dlp",
            format_id="best",
            format_label="Best available",
            artifact_path=None,
            model_dump=lambda: {
                "status": "ready",
                "stage": "download_ready",
                "executor": "yt-dlp",
                "format_id": "best",
                "format_label": "Best available",
                "artifact_path": None,
            },
        )

    asyncio.run(
        process_analysis_job(
            {
                "publish": publish,
                "load_job": load_job,
                "persist_job": persist_job,
                "probe_public_video_metadata": probe_metadata,
                "plan_public_video_download_shell": lambda current_job: planned_download,
                "execute_public_video_download_shell": execute_download,
            },
            UUID("12345678-1234-5678-1234-567812345678"),
        )
    )

    assert ("transcript.shell",) not in [(event_name,) for event_name, _ in calls]
    assert (
        "job.status",
        {
            "job_id": "12345678-1234-5678-1234-567812345678",
            "status": "running",
            "stage": "transcript_ready",
        },
    ) not in calls
    assert calls[-1] == (
        "error",
        {
            "job_id": "12345678-1234-5678-1234-567812345678",
            "reason": "missing_download_artifact",
            "message": "Downloaded artifact path is required before transcript preparation.",
        },
    )
    assert persisted_jobs == [("running", "download_ready"), ("failed", "transcript_unavailable")]
    assert job.stage == "transcript_unavailable"
    assert job.status == JobStatus.FAILED


def test_process_analysis_job_does_not_advance_transcript_when_download_fails() -> None:
    calls = []
    persisted_jobs = []
    job = AnalysisJob(
        id=UUID("12345678-1234-5678-1234-567812345678"),
        input_mode=InputMode.PUBLIC_VIDEO,
        source_url="https://example.com/video",
        status=JobStatus.RUNNING,
        stage="metadata_ready",
        title="Already Probed",
    )

    def publish(event_name: str, payload: dict) -> None:
        calls.append((event_name, payload))

    def load_job(requested_job_id: UUID) -> AnalysisJob:
        assert requested_job_id == job.id
        return job

    def probe_metadata(_source_url: str) -> VideoMetadata:
        raise AssertionError("probe should not run when metadata is already ready")

    def persist_job(updated_job: AnalysisJob) -> None:
        persisted_jobs.append((updated_job.status.value, updated_job.stage))

    planned_download = SimpleNamespace(
        status="queued",
        stage="queued_download",
        executor="yt-dlp",
        format_id="best",
        format_label="Best available",
        artifact_path="var/downloads/public-video/12345678-1234-5678-1234-567812345678.%(ext)s",
    )

    def execute_download(_job: AnalysisJob, planned=None) -> SimpleNamespace:
        assert planned is planned_download
        raise PublicVideoDownloadError(
            reason="download_failed",
            message="yt-dlp exited with status 1.",
        )

    asyncio.run(
        process_analysis_job(
            {
                "publish": publish,
                "load_job": load_job,
                "persist_job": persist_job,
                "probe_public_video_metadata": probe_metadata,
                "plan_public_video_download_shell": lambda current_job: planned_download,
                "execute_public_video_download_shell": execute_download,
            },
            UUID("12345678-1234-5678-1234-567812345678"),
        )
    )

    assert ("transcript.shell",) not in [(event_name,) for event_name, _ in calls]
    assert all(payload.get("stage") != "transcript_ready" for event_name, payload in calls if event_name == "job.status")
    assert calls == [
        (
            "error",
            {
                "job_id": "12345678-1234-5678-1234-567812345678",
                "reason": "download_failed",
                "message": "yt-dlp exited with status 1.",
            },
        )
    ]
    assert persisted_jobs == [("failed", "download_failed")]
    assert job.stage == "download_failed"
    assert job.status == JobStatus.FAILED
