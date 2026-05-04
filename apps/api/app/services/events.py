import json
from collections import defaultdict
from collections.abc import AsyncIterator
import asyncio


def format_sse_message(event_name: str, payload: dict) -> str:
    return f"event: {event_name}\ndata: {json.dumps(payload, separators=(',', ':'))}\n\n"


class JobEventBroker:
    def __init__(self) -> None:
        self._subscribers: dict[str, set[asyncio.Queue[str]]] = defaultdict(set)

    async def publish(self, job_id: str, event_name: str, payload: dict) -> None:
        message = format_sse_message(event_name, payload)
        for queue in list(self._subscribers[job_id]):
            await queue.put(message)

    def publish_nowait(self, job_id: str, event_name: str, payload: dict) -> None:
        message = format_sse_message(event_name, payload)
        for queue in list(self._subscribers[job_id]):
            queue.put_nowait(message)

    async def subscribe(self, job_id: str) -> AsyncIterator[str]:
        queue: asyncio.Queue[str] = asyncio.Queue()
        self._subscribers[job_id].add(queue)
        try:
            while True:
                yield await queue.get()
        finally:
            self._subscribers[job_id].discard(queue)
            if not self._subscribers[job_id]:
                self._subscribers.pop(job_id, None)


job_event_broker = JobEventBroker()
