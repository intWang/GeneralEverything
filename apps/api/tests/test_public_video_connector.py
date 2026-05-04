import asyncio
import subprocess
from uuid import UUID

from app.models.job import AnalysisJob, InputMode, JobStatus
from app.schemas.video_metadata import VideoMetadata
from app.tasks import process_analysis_job
from app.services.connectors.public_video import (
    PublicVideoProbeError,
    normalize_yt_dlp_metadata,
    probe_public_video_metadata,
)


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


def test_process_analysis_job_publishes_probed_metadata_event() -> None:
    calls = []
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
        )
    ]


def test_process_analysis_job_publishes_normalized_probe_error() -> None:
    calls = []
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
