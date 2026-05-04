from collections.abc import Generator
from datetime import UTC, datetime, timedelta
from pathlib import Path

from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.db import get_session
from app.main import app
from app.models.job import AnalysisJob

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

    response = client.post(
        "/api/jobs",
        json={
            "source_url": "https://example.com/video",
        },
    )

    app.dependency_overrides.clear()

    body = response.json()
    assert response.status_code == 201
    assert body["input_mode"] == "public_video"
    assert body["status"] == "queued"
    assert body["source_url"] == "https://example.com/video"

    with testing_session() as session:
        persisted_job = session.query(AnalysisJob).one()

    assert str(persisted_job.id) == body["id"]
    assert persisted_job.stage == "queued"
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


def test_get_job_returns_persisted_job_shell(tmp_path) -> None:
    client, _testing_session = make_test_client(tmp_path)

    created = client.post(
        "/api/jobs",
        json={"source_url": "https://example.com/video"},
    )
    job_id = created.json()["id"]

    response = client.get(f"/api/jobs/{job_id}")

    app.dependency_overrides.clear()

    body = response.json()
    assert response.status_code == 200
    assert body["id"] == job_id
    assert body["input_mode"] == "public_video"
    assert body["status"] == "queued"
    assert body["stage"] == "queued"
    assert body["created_at"]


def test_get_job_returns_404_when_missing(tmp_path) -> None:
    client, _testing_session = make_test_client(tmp_path)

    response = client.get("/api/jobs/11111111-1111-1111-1111-111111111111")

    app.dependency_overrides.clear()

    assert response.status_code == 404
    assert response.json() == {"detail": "Job not found"}


def test_list_jobs_returns_recent_jobs_first(tmp_path) -> None:
    client, testing_session = make_test_client(tmp_path)

    first = client.post(
        "/api/jobs",
        json={"source_url": "https://example.com/first"},
    ).json()
    second = client.post(
        "/api/jobs",
        json={"source_url": "https://example.com/second"},
    ).json()

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
