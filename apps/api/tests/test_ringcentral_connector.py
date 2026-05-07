import asyncio
import json
from collections.abc import Generator
from pathlib import Path

from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.api.routes import jobs as jobs_routes
from app.db import get_session
from app.main import app
from app.models.job import AnalysisJob, InputMode, JobStatus
from app.services.connectors.ringcentral import (
    RingCentralProbeError,
    is_ringcentral_recording_url,
    sanitize_ringcentral_url,
)
from app.tasks import process_analysis_job

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


def test_ringcentral_recording_urls_are_supported() -> None:
    assert is_ringcentral_recording_url(
        "https://xmrupxmn-rxe-1-v.int.rclabenv.com/recordings/abc?isMeetingId=true"
    )


def test_non_ringcentral_hosts_are_not_supported() -> None:
    assert not is_ringcentral_recording_url(
        "https://notringcentral.example.com/recordings/abc?isMeetingId=true"
    )


def test_sanitize_ringcentral_url_removes_sensitive_query_tokens() -> None:
    sanitized = sanitize_ringcentral_url(
        "https://xmrupxmn-rxe-1-v.int.rclabenv.com/recordings/abc?code=secret&headless=true"
    )

    assert sanitized == (
        "https://xmrupxmn-rxe-1-v.int.rclabenv.com/recordings/abc?headless=true"
    )
    assert "secret" not in sanitized


def test_ringcentral_probe_error_exposes_safe_diagnostic() -> None:
    error = RingCentralProbeError(
        reason="ringcentral_auth_required",
        message="This RingCentral recording requires a signed-in session.",
    )

    assert error.diagnostic().reason == "ringcentral_auth_required"
    assert error.diagnostic().stage == "metadata_probe"


def test_ringcentral_oauth_start_returns_not_implemented() -> None:
    client = TestClient(app)

    response = client.get("/api/oauth/ringcentral/start")

    assert response.status_code == 501
    assert response.json() == {
        "provider": "ringcentral",
        "status": "not_implemented",
    }


def test_create_ringcentral_job_queues_background_processing(
    tmp_path: Path,
    monkeypatch,
) -> None:
    client, testing_session = make_test_client(tmp_path)
    queued_jobs: list[str] = []
    source_url = (
        "https://xmrupxmn-rxe-1-v.int.rclabenv.com/recordings/abc"
        "?isMeetingId=true&headless=true&code=secret"
        "&token=hidden&access_token=also-secret"
    )

    monkeypatch.setattr(
        jobs_routes,
        "run_analysis_job_in_background",
        lambda job_id, _bind: queued_jobs.append(str(job_id)),
    )

    try:
        response = client.post("/api/jobs", json={"source_url": source_url})
    finally:
        app.dependency_overrides.clear()

    payload = response.json()
    assert response.status_code == 201
    assert payload["input_mode"] == "ringcentral_recording"
    assert payload["source_url"] == (
        "https://xmrupxmn-rxe-1-v.int.rclabenv.com/recordings/abc"
        "?isMeetingId=true&headless=true"
    )
    assert "code=secret" not in payload["source_url"]
    assert "token=hidden" not in payload["source_url"]
    assert "access_token=also-secret" not in payload["source_url"]
    assert queued_jobs == [payload["id"]]

    with testing_session() as session:
        persisted_job = session.query(AnalysisJob).one()

    assert persisted_job.source_url == payload["source_url"]
    assert "isMeetingId=true" in persisted_job.source_url
    assert "headless=true" in persisted_job.source_url
    assert "code=secret" not in persisted_job.source_url
    assert "token=hidden" not in persisted_job.source_url
    assert "access_token=also-secret" not in persisted_job.source_url


def test_process_analysis_job_publishes_safe_ringcentral_diagnostic() -> None:
    source_url = (
        "https://xmrupxmn-rxe-1-v.int.rclabenv.com/recordings/abc"
        "?isMeetingId=true&code=secret&token=hidden&access_token=also-hidden"
    )
    job = AnalysisJob(
        input_mode=InputMode.RINGCENTRAL_RECORDING,
        source_url=source_url,
    )
    events: list[tuple[str, dict]] = []
    persisted_jobs: list[AnalysisJob] = []

    asyncio.run(
        process_analysis_job(
            {
                "publish": lambda event_name, payload: events.append(
                    (event_name, payload)
                ),
                "load_job": lambda _job_id: job,
                "persist_job": lambda updated_job: persisted_jobs.append(updated_job),
            },
            job.id,
        )
    )

    serialized_events = json.dumps(events)
    serialized_diagnostics = job.diagnostics_json or ""
    assert persisted_jobs == [job]
    assert job.status == JobStatus.FAILED
    assert job.stage == "ringcentral_auth_required"
    assert events[-1][0] == "error"
    assert "ringcentral_auth_required" in serialized_events
    assert "code=secret" not in serialized_events
    assert "token=hidden" not in serialized_events
    assert "access_token=also-hidden" not in serialized_events
    assert "code=secret" not in serialized_diagnostics
    assert "token=hidden" not in serialized_diagnostics
    assert "access_token=also-hidden" not in serialized_diagnostics
