from collections.abc import Generator
from pathlib import Path

from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.db import get_session
from app.main import app
from app.models.job import AnalysisJob


def migrate_database(database_path: Path) -> None:
    config = Config("/Users/ace.wang/Documents/GeneralEveryThing/apps/api/alembic.ini")
    config.set_main_option("script_location", "/Users/ace.wang/Documents/GeneralEveryThing/apps/api/alembic")
    config.set_main_option("sqlalchemy.url", f"sqlite:///{database_path}")
    command.upgrade(config, "head")


def test_create_job_returns_pending_job(tmp_path) -> None:
    database_path = tmp_path / "jobs.db"
    migrate_database(database_path)
    engine = create_engine(f"sqlite:///{database_path}", future=True)
    testing_session = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)

    def override_get_session() -> Generator[Session, None, None]:
        session = testing_session()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_session] = override_get_session
    client = TestClient(app)

    response = client.post(
        "/api/jobs",
        json={
            "input_mode": "public_video",
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
