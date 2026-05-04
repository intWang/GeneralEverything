import json


def format_sse_message(event_name: str, payload: dict) -> str:
    return f"event: {event_name}\ndata: {json.dumps(payload, separators=(',', ':'))}\n\n"
