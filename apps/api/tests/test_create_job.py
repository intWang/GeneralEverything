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
    jobs_routes.probe_public_video_metadata = lambda _source_url: VideoMetadata(
        title="Sample Video",
        duration_seconds=120,
        thumbnail_url="https://example.com/thumb.jpg",
        source_name="Example Channel",
        description="A short description",
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


def test_create_job_returns_failed_shell_when_probe_fails(tmp_path) -> None:
    client, testing_session = make_test_client(tmp_path)

    original_probe = jobs_routes.probe_public_video_metadata

    def raise_probe_error(_source_url: str) -> VideoMetadata:
        raise jobs_routes.PublicVideoProbeError(
            reason="unsupported_url",
            message="ERROR: Unsupported URL",
        )

    jobs_routes.probe_public_video_metadata = raise_probe_error

    try:
        response = client.post(
            "/api/jobs",
            json={"source_url": "https://example.com/video"},
        )
    finally:
        jobs_routes.probe_public_video_metadata = original_probe
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


def test_get_job_returns_persisted_job_shell(tmp_path) -> None:
    client, _testing_session = make_test_client(tmp_path)

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

        response = client.get(f"/api/jobs/{job_id}")
    finally:
        jobs_routes.probe_public_video_metadata = original_probe
        app.dependency_overrides.clear()

    body = response.json()
    assert response.status_code == 200
    assert body["id"] == job_id
    assert body["input_mode"] == "public_video"
    assert body["status"] == "running"
    assert body["stage"] == "metadata_ready"
    assert body["title"] == "Sample Video"
    assert body["thumbnail_url"] == "https://example.com/thumb.jpg"
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
    jobs_routes.probe_public_video_metadata = lambda source_url: VideoMetadata(
        title=f"Title for {source_url.rsplit('/', 1)[-1]}",
        duration_seconds=90 if source_url.endswith("first") else 180,
        thumbnail_url="https://example.com/thumb.jpg",
        source_name="Example Channel",
        description=f"Description for {source_url.rsplit('/', 1)[-1]}",
    )

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
    assert body[1]["title"] == "Title for first"
