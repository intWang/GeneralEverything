import json
import asyncio
from collections.abc import Generator
from pathlib import Path
import uuid

from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.api.routes.events import stream_job_events
from app.main import app
from app.db import get_session
from app.models.job import AnalysisJob, InputMode, JobStatus
from app.services.events import JobEventBroker, format_sse_message, job_event_broker

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


def test_formats_sse_message() -> None:
    payload = format_sse_message("job.status", {"status": "queued"})
    assert payload == 'event: job.status\ndata: {"status":"queued"}\n\n'


def test_job_event_broker_delivers_published_messages() -> None:
    async def exercise_broker() -> str:
        broker = JobEventBroker()
        iterator = broker.subscribe("job-123")
        next_message = asyncio.create_task(iterator.__anext__())
        await asyncio.sleep(0)
        broker.publish_nowait(
            "job-123",
            "transcript.segment",
            {"segment_count": 1},
        )
        try:
            return await asyncio.wait_for(next_message, timeout=1)
        finally:
            await iterator.aclose()

    payload = asyncio.run(exercise_broker())

    assert (
        payload
        == 'event: transcript.segment\ndata: {"segment_count":1}\n\n'
    )


def test_stream_job_events_returns_initial_job_status(tmp_path) -> None:
    _client, testing_session = make_test_client(tmp_path)
    job_id = "11111111-1111-1111-1111-111111111111"

    with testing_session() as session:
        session.add(
            AnalysisJob(
                id=uuid.UUID(job_id),
                input_mode=InputMode.PUBLIC_VIDEO,
                source_url="https://example.com/live-stream",
                stage="generating_transcript",
                status=JobStatus.RUNNING,
            ),
        )
        session.commit()

    with testing_session() as session:
        response = asyncio.run(stream_job_events(uuid.UUID(job_id), session))
        first_chunk = asyncio.run(response.body_iterator.__anext__())
        asyncio.run(response.body_iterator.aclose())

    assert response.media_type == "text/event-stream"
    lines = first_chunk.strip().splitlines()
    assert lines[0] == "event: job.status"
    initial_payload = json.loads(lines[1].removeprefix("data: "))
    assert initial_payload == {
        "job_id": job_id,
        "status": "running",
        "stage": "generating_transcript",
    }

    app.dependency_overrides.clear()
