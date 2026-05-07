from collections.abc import Generator
from datetime import UTC, datetime, timedelta
from pathlib import Path

from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.api.routes import jobs as jobs_routes
from app.db import get_session
from app.main import app
from app.models.job import AnalysisJob
from app.schemas.video_metadata import VideoMetadata

API_ROOT = Path(__file__).resolve().parents[1]
ALEMBIC_INI_PATH = API_ROOT / "alembic.ini"
ALEMBIC_SCRIPT_PATH = API_ROOT / "alembic"


def migrate_database(database_path: Path) -> None:
    config = Config(str(ALEMBIC_INI_PATH))
    config.set_main_option("script_location", str(ALEMBIC_SCRIPT_PATH))
    config.set_main_option("sqlalchemy.url", f"sqlite:///{database_path}")
    command.upgrade(config, "head")


def make_test_client(tmp_path: Path) -> tuple[TestClient, sessionmaker[Session]]:
    database_path = tmp_path / "jobs.db"
    migrate_database(database_path)
    engine = create_engine(f"sqlite:///{database_path}", future=True)
    testing_session = sessionmaker(
        bind=engine,
        autoflush=False,
        autocommit=False,
        future=True,
    )

    def override_get_session() -> Generator[Session, None, None]:
        session = testing_session()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_session] = override_get_session
    return TestClient(app), testing_session


def test_create_job_returns_pending_job(tmp_path) -> None:
    client, testing_session = make_test_client(tmp_path)

    original_probe = jobs_routes.probe_public_video_metadata
    original_run_background = jobs_routes.run_public_video_job_in_background
    started_jobs: list[str] = []
    jobs_routes.probe_public_video_metadata = lambda _source_url: VideoMetadata(
        title="Sample Video",
        duration_seconds=120,
        thumbnail_url="https://example.com/thumb.jpg",
        source_name="Example Channel",
        description="A short description",
    )
    jobs_routes.run_public_video_job_in_background = (
        lambda job_id, _bind: started_jobs.append(str(job_id))
    )

    try:
        response = client.post(
            "/api/jobs",
            json={
                "source_url": "https://example.com/video",
            },
        )
    finally:
        jobs_routes.probe_public_video_metadata = original_probe
        jobs_routes.run_public_video_job_in_background = original_run_background
        app.dependency_overrides.clear()

    body = response.json()
    assert response.status_code == 201
    assert body["input_mode"] == "public_video"
    assert body["status"] == "running"
    assert body["stage"] == "metadata_ready"
    assert body["source_url"] == "https://example.com/video"
    assert body["title"] == "Sample Video"
    assert body["duration_seconds"] == 120
    assert body["thumbnail_url"] == "https://example.com/thumb.jpg"
    assert body["source_name"] == "Example Channel"
    assert body["description"] == "A short description"
    assert body["download_status"] is None
    assert body["download_executor"] is None
    assert body["download_format_id"] is None
    assert body["download_format_label"] is None
    assert body["download_artifact_path"] is None
    assert body["transcript_status"] is None
    assert body["transcript_extractor"] is None
    assert body["transcript_audio_artifact_path"] is None
    assert started_jobs == [body["id"]]

    with testing_session() as session:
        persisted_job = session.query(AnalysisJob).one()

    assert str(persisted_job.id) == body["id"]
    assert persisted_job.stage == "metadata_ready"
    assert persisted_job.title == "Sample Video"
    assert persisted_job.created_at is not None


def test_create_job_detects_ringcentral_recording_url(tmp_path) -> None:
    client, testing_session = make_test_client(tmp_path)

    source_url = (
        "https://xmrupxmn-rxe-1-v.int.rclabenv.com/recordings/abc?isMeetingId=true"
    )
    response = client.post(
        "/api/jobs",
        json={
            "source_url": source_url,
        },
    )

    app.dependency_overrides.clear()

    body = response.json()
    assert response.status_code == 201
    assert body["input_mode"] == "ringcentral_recording"
    assert body["source_url"] == source_url

    with testing_session() as session:
        persisted_job = session.query(AnalysisJob).one()

    assert str(persisted_job.id) == body["id"]
    assert persisted_job.input_mode.value == "ringcentral_recording"


def test_job_response_exposes_progress_formats_and_diagnostics(tmp_path) -> None:
    client, _testing_session = make_test_client(tmp_path)

    original_probe = jobs_routes.probe_public_video_metadata
    original_run_background = jobs_routes.run_public_video_job_in_background
    jobs_routes.probe_public_video_metadata = lambda _source_url: VideoMetadata(
        title="Sample Video",
        duration_seconds=120,
        thumbnail_url="https://example.com/thumb.jpg",
        source_name="Example Channel",
        description="A short description",
    )
    jobs_routes.run_public_video_job_in_background = lambda *_args, **_kwargs: None

    try:
        response = client.post(
            "/api/jobs",
            json={"source_url": "https://example.com/video.mp4"},
        )
    finally:
        jobs_routes.probe_public_video_metadata = original_probe
        jobs_routes.run_public_video_job_in_background = original_run_background
        app.dependency_overrides.clear()

    assert response.status_code == 201
    payload = response.json()
    assert "download_progress" in payload
    assert "download_formats" in payload
    assert "diagnostics" in payload


def test_create_job_returns_failed_shell_when_probe_fails(tmp_path) -> None:
    client, testing_session = make_test_client(tmp_path)

    original_probe = jobs_routes.probe_public_video_metadata
    original_run_background = jobs_routes.run_public_video_job_in_background
    started_jobs: list[str] = []

    def raise_probe_error(_source_url: str) -> VideoMetadata:
        raise jobs_routes.PublicVideoProbeError(
            reason="unsupported_url",
            message="ERROR: Unsupported URL",
        )

    jobs_routes.probe_public_video_metadata = raise_probe_error
    jobs_routes.run_public_video_job_in_background = (
        lambda job_id, _bind: started_jobs.append(str(job_id))
    )

    try:
        response = client.post(
            "/api/jobs",
            json={"source_url": "https://example.com/video"},
        )
    finally:
        jobs_routes.probe_public_video_metadata = original_probe
        jobs_routes.run_public_video_job_in_background = original_run_background
        app.dependency_overrides.clear()

    body = response.json()
    assert response.status_code == 201
    assert body["status"] == "failed"
    assert body["stage"] == "unsupported_url"
    assert body["title"] is None
    assert body["thumbnail_url"] is None

    with testing_session() as session:
        persisted_job = session.query(AnalysisJob).one()

    assert persisted_job.status.value == "failed"
    assert persisted_job.stage == "unsupported_url"
    assert persisted_job.title is None
    assert started_jobs == []


def test_get_job_returns_persisted_job_shell(tmp_path) -> None:
    client, testing_session = make_test_client(tmp_path)

    original_probe = jobs_routes.probe_public_video_metadata
    original_run_background = jobs_routes.run_public_video_job_in_background
    jobs_routes.probe_public_video_metadata = lambda _source_url: VideoMetadata(
        title="Sample Video",
        duration_seconds=120,
        thumbnail_url="https://example.com/thumb.jpg",
        source_name="Example Channel",
        description="A short description",
    )
    jobs_routes.run_public_video_job_in_background = lambda *_args, **_kwargs: None

    try:
        created = client.post(
            "/api/jobs",
            json={"source_url": "https://example.com/video"},
        )
        job_id = created.json()["id"]

        with testing_session() as session:
            persisted_job = session.query(AnalysisJob).one()
            persisted_job.download_status = "planned"
            persisted_job.download_executor = "yt-dlp"
            persisted_job.download_format_id = "best"
            persisted_job.download_format_label = "best-available"
            persisted_job.download_artifact_path = "artifacts/downloads/demo/sample-video.mp4"
            persisted_job.detected_language_code = "zh"
            persisted_job.detected_language_name = "Chinese"
            persisted_job.transcript_source_text = "大家好，欢迎来到今天的会议。"
            persisted_job.summary_source_text = "会议确定了发布时间。"
            persisted_job.summary_structured_json = (
                '{"abstract":"会议确定了发布时间。",'
                '"key_points":[{"text":"发布时间已确认","citation_ids":["citation-1"]}],'
                '"action_items":[],"decisions":[{"text":"发布时间已确认","citation_ids":["citation-1"]}],'
                '"risks":[],"citations":[{"id":"citation-1","segment_id":"segment-1",'
                '"start_seconds":3,"end_seconds":8,"label":"00:03"}]}'
            )
            session.commit()

        response = client.get(f"/api/jobs/{job_id}")
    finally:
        jobs_routes.probe_public_video_metadata = original_probe
        jobs_routes.run_public_video_job_in_background = original_run_background
        app.dependency_overrides.clear()

    body = response.json()
    assert response.status_code == 200
    assert body["id"] == job_id
    assert body["input_mode"] == "public_video"
    assert body["status"] == "running"
    assert body["stage"] == "metadata_ready"
    assert body["title"] == "Sample Video"
    assert body["thumbnail_url"] == "https://example.com/thumb.jpg"
    assert body["download_status"] == "planned"
    assert body["download_executor"] == "yt-dlp"
    assert body["download_format_id"] == "best"
    assert body["download_format_label"] == "best-available"
    assert body["download_artifact_path"] == "artifacts/downloads/demo/sample-video.mp4"
    assert body["detected_language_code"] == "zh"
    assert body["detected_language_name"] == "Chinese"
    assert body["transcript_source_text"] == "大家好，欢迎来到今天的会议。"
    assert body["summary_source_text"] == "会议确定了发布时间。"
    assert body["summary_structured"] == {
        "abstract": "会议确定了发布时间。",
        "key_points": [{"text": "发布时间已确认", "citation_ids": ["citation-1"]}],
        "action_items": [],
        "decisions": [{"text": "发布时间已确认", "citation_ids": ["citation-1"]}],
        "risks": [],
        "citations": [
            {
                "id": "citation-1",
                "segment_id": "segment-1",
                "start_seconds": 3.0,
                "end_seconds": 8.0,
                "label": "00:03",
            }
        ],
    }
    assert body["transcript_status"] is None
    assert body["transcript_extractor"] is None
    assert body["transcript_audio_artifact_path"] is None
    assert body["created_at"]


def test_get_job_returns_404_when_missing(tmp_path) -> None:
    client, _testing_session = make_test_client(tmp_path)

    response = client.get("/api/jobs/11111111-1111-1111-1111-111111111111")

    app.dependency_overrides.clear()

    assert response.status_code == 404
    assert response.json() == {"detail": "Job not found"}


def test_list_jobs_returns_recent_jobs_first(tmp_path) -> None:
    client, testing_session = make_test_client(tmp_path)

    original_probe = jobs_routes.probe_public_video_metadata
    original_run_background = jobs_routes.run_public_video_job_in_background
    jobs_routes.probe_public_video_metadata = lambda source_url: VideoMetadata(
        title=f"Title for {source_url.rsplit('/', 1)[-1]}",
        duration_seconds=90 if source_url.endswith("first") else 180,
        thumbnail_url="https://example.com/thumb.jpg",
        source_name="Example Channel",
        description=f"Description for {source_url.rsplit('/', 1)[-1]}",
    )
    jobs_routes.run_public_video_job_in_background = lambda *_args, **_kwargs: None

    try:
        first = client.post(
            "/api/jobs",
            json={"source_url": "https://example.com/first"},
        ).json()
        second = client.post(
            "/api/jobs",
            json={"source_url": "https://example.com/second"},
        ).json()
    finally:
        jobs_routes.probe_public_video_metadata = original_probe
        jobs_routes.run_public_video_job_in_background = original_run_background

    with testing_session() as session:
        jobs = session.query(AnalysisJob).order_by(AnalysisJob.source_url).all()
        jobs[0].created_at = datetime(2026, 5, 4, 9, 0, tzinfo=UTC)
        jobs[1].created_at = datetime(2026, 5, 4, 9, 1, tzinfo=UTC) + timedelta(seconds=1)
        session.commit()

    response = client.get("/api/jobs")

    app.dependency_overrides.clear()

    body = response.json()
    assert response.status_code == 200
    assert [item["id"] for item in body] == [second["id"], first["id"]]
    assert body[0]["source_url"] == "https://example.com/second"
    assert body[1]["source_url"] == "https://example.com/first"
    assert body[0]["title"] == "Title for second"
    assert body[0]["duration_seconds"] == 180
    assert body[0]["thumbnail_url"] == "https://example.com/thumb.jpg"
    assert body[0]["source_name"] == "Example Channel"
    assert body[0]["description"] == "Description for second"
    assert body[0]["download_status"] is None
    assert body[1]["title"] == "Title for first"


def test_submit_job_question_returns_grounded_answer_shell(tmp_path) -> None:
    client, testing_session = make_test_client(tmp_path)

    original_probe = jobs_routes.probe_public_video_metadata
    jobs_routes.probe_public_video_metadata = lambda _source_url: VideoMetadata(
        title="Sample Video",
        duration_seconds=120,
        thumbnail_url="https://example.com/thumb.jpg",
        source_name="Example Channel",
        description="A short description",
    )

    try:
        created = client.post(
            "/api/jobs",
            json={"source_url": "https://example.com/video"},
        )
        job_id = created.json()["id"]

        with testing_session() as session:
            persisted_job = session.query(AnalysisJob).one()
            persisted_job.stage = "mindmap_generated"
            persisted_job.status = jobs_routes.JobStatus.RUNNING
            persisted_job.transcript_segment_count = 3
            persisted_job.transcript_preview_text = (
                "Transcript shell generated for sample.wav. It captures a longer "
                "explanation so Ask AI references stay compact in the workspace."
            )
            persisted_job.transcript_source_segments_json = (
                '[{"id":"segment-1","start_seconds":3,"end_seconds":8,'
                '"text":"Opening segment explains the release decision."}]'
            )
            persisted_job.summary_status = "ready"
            persisted_job.summary_preview_text = (
                "Summary shell generated from transcript preview. It keeps enough "
                "detail to demonstrate trimming in the reference cards."
            )
            persisted_job.mindmap_status = "ready"
            persisted_job.mindmap_preview_text = (
                "Mind map shell generated from summary preview. It expands into "
                "more context than the reference list should render in full."
            )
            session.commit()

        response = client.post(
            f"/api/jobs/{job_id}/questions",
            json={"question": "What should I review next?"},
        )
    finally:
        jobs_routes.probe_public_video_metadata = original_probe
        app.dependency_overrides.clear()

    body = response.json()
    assert response.status_code == 200
    assert body == {
        "answer": (
            'Grounded answer shell for "What should I review next?" based on the '
            "transcript, summary, and mind map shells currently available."
        ),
        "grounded": True,
        "job_id": job_id,
        "question": "What should I review next?",
        "references": [
            "Transcript: Transcript shell generated for sample.wav. It captures a longer expla...",
            "Summary: Summary shell generated from transcript preview. It keeps enough deta...",
            "Mind map: Mind map shell generated from summary preview. It expands into more c...",
        ],
        "structured_references": [
            {
                "source_type": "transcript",
                "segment_id": "segment-1",
                "start_seconds": 3.0,
                "end_seconds": 8.0,
                "snippet": "Opening segment explains the release decision.",
            },
            {
                "source_type": "summary",
                "segment_id": None,
                "start_seconds": None,
                "end_seconds": None,
                "snippet": (
                    "Summary shell generated from transcript preview. It keeps enough deta..."
                ),
            },
            {
                "source_type": "mindmap",
                "segment_id": None,
                "start_seconds": None,
                "end_seconds": None,
                "snippet": (
                    "Mind map shell generated from summary preview. It expands into more c..."
                ),
            },
        ],
    }


def test_submit_job_question_rejects_jobs_without_grounded_context(tmp_path) -> None:
    client, testing_session = make_test_client(tmp_path)

    original_probe = jobs_routes.probe_public_video_metadata
    jobs_routes.probe_public_video_metadata = lambda _source_url: VideoMetadata(
        title="Sample Video",
        duration_seconds=120,
        thumbnail_url="https://example.com/thumb.jpg",
        source_name="Example Channel",
        description="A short description",
    )

    try:
        created = client.post(
            "/api/jobs",
            json={"source_url": "https://example.com/video"},
        )
        job_id = created.json()["id"]

        with testing_session() as session:
            persisted_job = session.query(AnalysisJob).one()
            persisted_job.stage = "summary_generated"
            persisted_job.status = jobs_routes.JobStatus.RUNNING
            persisted_job.transcript_segment_count = 2
            persisted_job.summary_status = "ready"
            persisted_job.mindmap_status = None
            session.commit()

        response = client.post(
            f"/api/jobs/{job_id}/questions",
            json={"question": "Can I ask yet?"},
        )
    finally:
        jobs_routes.probe_public_video_metadata = original_probe
        app.dependency_overrides.clear()

    assert response.status_code == 409
    assert response.json() == {
        "detail": "Ask AI is not ready for grounded questions yet"
    }


def test_translate_job_content_returns_cached_transcript_translation(tmp_path) -> None:
    client, testing_session = make_test_client(tmp_path)

    original_probe = jobs_routes.probe_public_video_metadata
    jobs_routes.probe_public_video_metadata = lambda _source_url: VideoMetadata(
        title="Sample Video",
        duration_seconds=120,
        thumbnail_url="https://example.com/thumb.jpg",
        source_name="Example Channel",
        description="A short description",
    )
    original_translate = getattr(jobs_routes, "translate_job_content")

    try:
        created = client.post(
            "/api/jobs",
            json={"source_url": "https://example.com/video"},
        )
        job_id = created.json()["id"]

        with testing_session() as session:
            persisted_job = session.query(AnalysisJob).one()
            persisted_job.detected_language_code = "zh"
            persisted_job.detected_language_name = "Chinese"
            persisted_job.transcript_source_text = "大家好，欢迎来到今天的会议。"
            persisted_job.transcript_translations_json = (
                "{\"en\": \"Hello everyone, welcome to today's meeting.\"}"
            )
            session.commit()

        def fail_translate(**_kwargs):
            raise AssertionError("cached translation should not invoke translator")

        jobs_routes.translate_job_content = fail_translate

        response = client.post(
            f"/api/jobs/{job_id}/translations",
            json={
                "content_type": "transcript",
                "target_language_code": "en",
            },
        )
    finally:
        jobs_routes.probe_public_video_metadata = original_probe
        jobs_routes.translate_job_content = original_translate
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {
        "content_type": "transcript",
        "job_id": job_id,
        "source_language_code": "zh",
        "target_language_code": "en",
        "translated_text": "Hello everyone, welcome to today's meeting.",
    }


def test_translate_job_content_persists_new_summary_translation(tmp_path) -> None:
    client, testing_session = make_test_client(tmp_path)

    original_probe = jobs_routes.probe_public_video_metadata
    jobs_routes.probe_public_video_metadata = lambda _source_url: VideoMetadata(
        title="Sample Video",
        duration_seconds=120,
        thumbnail_url="https://example.com/thumb.jpg",
        source_name="Example Channel",
        description="A short description",
    )
    original_translate = getattr(jobs_routes, "translate_job_content")

    try:
        created = client.post(
            "/api/jobs",
            json={"source_url": "https://example.com/video"},
        )
        job_id = created.json()["id"]

        with testing_session() as session:
            persisted_job = session.query(AnalysisJob).one()
            persisted_job.detected_language_code = "zh"
            persisted_job.detected_language_name = "Chinese"
            persisted_job.summary_source_text = "会议确定了发布时间。"
            session.commit()

        def fake_translate(*, source_language_code: str, target_language_code: str, text: str):
            assert source_language_code == "zh"
            assert target_language_code == "en"
            assert text == "会议确定了发布时间。"
            return "The meeting confirmed the release date."

        jobs_routes.translate_job_content = fake_translate

        response = client.post(
            f"/api/jobs/{job_id}/translations",
            json={
                "content_type": "summary",
                "target_language_code": "en",
            },
        )
    finally:
        jobs_routes.probe_public_video_metadata = original_probe
        jobs_routes.translate_job_content = original_translate
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {
        "content_type": "summary",
        "job_id": job_id,
        "source_language_code": "zh",
        "target_language_code": "en",
        "translated_text": "The meeting confirmed the release date.",
    }

    with testing_session() as session:
        persisted_job = session.query(AnalysisJob).one()

    assert persisted_job.summary_translations_json == (
        '{"en": "The meeting confirmed the release date."}'
    )
