import json

from fastapi.testclient import TestClient

from app.main import app
from app.services.events import format_sse_message


def test_formats_sse_message() -> None:
    payload = format_sse_message("job.status", {"status": "queued"})
    assert payload == 'event: job.status\ndata: {"status":"queued"}\n\n'


def test_stream_job_events_returns_single_sse_message() -> None:
    client = TestClient(app)
    job_id = "job-123"

    response = client.get(f"/api/jobs/{job_id}/events")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")

    body = response.text
    assert body.count("event: job.status\n") == 1

    lines = body.strip().splitlines()
    assert lines[0] == "event: job.status"
    assert lines[1].startswith("data: ")

    payload = json.loads(lines[1].removeprefix("data: "))
    assert payload == {"job_id": job_id, "status": "queued"}
