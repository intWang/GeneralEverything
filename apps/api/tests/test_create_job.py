from collections.abc import Generator

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.db import Base, get_session
from app.main import app
from app.models.job import AnalysisJob


def test_create_job_returns_pending_job(tmp_path) -> None:
    database_path = tmp_path / "jobs.db"
    engine = create_engine(f"sqlite:///{database_path}", future=True)
    testing_session = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    Base.metadata.create_all(bind=engine)

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
