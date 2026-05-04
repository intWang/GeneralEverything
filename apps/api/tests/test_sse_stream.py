from app.services.events import format_sse_message


def test_formats_sse_message() -> None:
    payload = format_sse_message("job.status", {"status": "queued"})
    assert payload == 'event: job.status\ndata: {"status":"queued"}\n\n'
