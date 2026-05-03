# GET Video Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Phase 1 of GET as a two-entry video summarization web app that supports public video URLs and authorized RingCentral recording URLs with progressive transcript, summary, mind map, and Q&A output.

**Architecture:** Use a monorepo with a Next.js frontend and a FastAPI backend. The backend owns ingestion, media orchestration, transcription, summarization, Q&A preparation, and SSE event streaming. Redis backs background jobs and event buffering, while PostgreSQL persists job state and generated artifacts.

**Tech Stack:** Next.js, TypeScript, Tailwind CSS, FastAPI, Python 3.12, Redis, Arq, PostgreSQL, SQLAlchemy 2.x, Alembic, yt-dlp, ffmpeg, ffprobe, N_m3u8DL-RE, faster-whisper, pytest, Vitest, Playwright

---

## File Structure

Planned repo layout:

- `apps/web/` - Next.js frontend
- `apps/api/` - FastAPI backend
- `infra/docker-compose.yml` - local services for PostgreSQL and Redis
- `docs/superpowers/specs/2026-05-03-get-video-summary-design.md` - approved design spec
- `docs/superpowers/plans/2026-05-03-get-video-summary-implementation.md` - this implementation plan

Backend structure:

- `apps/api/app/main.py` - FastAPI app entrypoint
- `apps/api/app/config.py` - environment-driven settings
- `apps/api/app/db.py` - database engine and session setup
- `apps/api/app/models/` - SQLAlchemy models
- `apps/api/app/schemas/` - Pydantic request/response schemas
- `apps/api/app/api/routes/` - HTTP and SSE routes
- `apps/api/app/services/ingestion.py` - source detection and routing
- `apps/api/app/services/connectors/public_video.py` - public video integration
- `apps/api/app/services/connectors/ringcentral.py` - RingCentral OAuth and recording access
- `apps/api/app/services/media_pipeline.py` - media download and chunk orchestration
- `apps/api/app/services/transcript_pipeline.py` - incremental transcription
- `apps/api/app/services/summary_pipeline.py` - rolling summary and mind map
- `apps/api/app/services/qa_pipeline.py` - retrieval prep and question answering
- `apps/api/app/services/events.py` - SSE event publishing helpers
- `apps/api/app/tasks.py` - Arq worker registration and task entrypoints
- `apps/api/tests/` - backend tests

Frontend structure:

- `apps/web/app/` - Next.js app router pages
- `apps/web/components/` - UI components
- `apps/web/lib/api.ts` - backend API client
- `apps/web/lib/sse.ts` - EventSource helpers
- `apps/web/lib/types.ts` - frontend shared types
- `apps/web/tests/` - frontend tests

## Task 1: Scaffold the Monorepo and Local Development Environment

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `README.md`
- Create: `.gitignore`
- Create: `infra/docker-compose.yml`
- Create: `apps/web/package.json`
- Create: `apps/api/pyproject.toml`
- Test: `README.md`

- [ ] **Step 1: Write the repository workspace files**

```json
{
  "name": "general-every-thing",
  "private": true,
  "packageManager": "pnpm@10.0.0",
  "scripts": {
    "dev:web": "pnpm --filter web dev",
    "dev:api": "cd apps/api && uvicorn app.main:app --reload",
    "lint:web": "pnpm --filter web lint",
    "test:web": "pnpm --filter web test",
    "test:e2e:web": "pnpm --filter web test:e2e"
  }
}
```

```yaml
packages:
  - "apps/*"
```

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: get
      POSTGRES_USER: get
      POSTGRES_PASSWORD: get
    ports:
      - "5432:5432"
  redis:
    image: redis:7
    ports:
      - "6379:6379"
```

- [ ] **Step 2: Write the backend Python project file**

```toml
[project]
name = "get-api"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
  "fastapi>=0.115.0",
  "uvicorn[standard]>=0.30.0",
  "sqlalchemy>=2.0.0",
  "psycopg[binary]>=3.2.0",
  "alembic>=1.13.0",
  "redis>=5.0.0",
  "arq>=0.26.0",
  "pydantic-settings>=2.3.0",
  "httpx>=0.27.0",
  "yt-dlp>=2025.11.12",
  "faster-whisper>=1.1.0"
]

[tool.pytest.ini_options]
testpaths = ["tests"]
```

- [ ] **Step 3: Verify the workspace boots**

Run: `docker compose -f infra/docker-compose.yml up -d`

Expected: PostgreSQL and Redis containers start successfully.

- [ ] **Step 4: Write the root README with exact local commands**

```md
# GeneralEveryThing

## Local setup

1. `docker compose -f infra/docker-compose.yml up -d`
2. `cd apps/api && python -m venv .venv && source .venv/bin/activate && pip install -e .`
3. `cd apps/web && pnpm install`
4. `pnpm dev:web`
5. `pnpm dev:api`
```

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-workspace.yaml README.md .gitignore infra/docker-compose.yml apps/web/package.json apps/api/pyproject.toml
git commit -m "chore: scaffold monorepo and local infrastructure"
```

## Task 2: Create the Backend App Shell, Config, and Health Endpoint

**Files:**
- Create: `apps/api/app/__init__.py`
- Create: `apps/api/app/main.py`
- Create: `apps/api/app/config.py`
- Create: `apps/api/app/db.py`
- Create: `apps/api/app/api/routes/health.py`
- Create: `apps/api/tests/test_health.py`

- [ ] **Step 1: Write the failing health test**

```python
from fastapi.testclient import TestClient

from app.main import app


def test_healthcheck_returns_ok() -> None:
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && pytest tests/test_health.py -v`

Expected: FAIL because `app.main` or `/health` does not exist yet.

- [ ] **Step 3: Write the minimal FastAPI app and health route**

```python
# apps/api/app/config.py
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "GET API"
    database_url: str = "postgresql+psycopg://get:get@localhost:5432/get"
    redis_url: str = "redis://localhost:6379/0"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
```

```python
# apps/api/app/api/routes/health.py
from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}
```

```python
# apps/api/app/main.py
from fastapi import FastAPI

from app.api.routes.health import router as health_router
from app.config import settings

app = FastAPI(title=settings.app_name)
app.include_router(health_router)
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/api && pytest tests/test_health.py -v`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/app apps/api/tests/test_health.py
git commit -m "feat: bootstrap fastapi app shell"
```

## Task 3: Add Persistence Models and Job Creation API

**Files:**
- Create: `apps/api/app/models/base.py`
- Create: `apps/api/app/models/job.py`
- Create: `apps/api/app/schemas/jobs.py`
- Create: `apps/api/app/api/routes/jobs.py`
- Create: `apps/api/alembic.ini`
- Create: `apps/api/alembic/env.py`
- Create: `apps/api/alembic/versions/20260503_01_create_analysis_jobs.py`
- Create: `apps/api/tests/test_create_job.py`
- Modify: `apps/api/app/main.py`
- Modify: `apps/api/app/db.py`

- [ ] **Step 1: Write the failing job-creation test**

```python
from fastapi.testclient import TestClient

from app.main import app


def test_create_job_returns_pending_job() -> None:
    client = TestClient(app)
    response = client.post(
        "/api/jobs",
        json={
            "input_mode": "public_video",
            "source_url": "https://example.com/video"
        },
    )
    body = response.json()
    assert response.status_code == 201
    assert body["input_mode"] == "public_video"
    assert body["status"] == "queued"
    assert body["source_url"] == "https://example.com/video"
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/api && pytest tests/test_create_job.py -v`

Expected: FAIL because `/api/jobs` is not implemented.

- [ ] **Step 3: Create the analysis job model and API schema**

```python
# apps/api/app/models/job.py
import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, Enum, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class InputMode(StrEnum):
    PUBLIC_VIDEO = "public_video"
    RINGCENTRAL_RECORDING = "ringcentral_recording"


class JobStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    FAILED = "failed"
    COMPLETED = "completed"


class AnalysisJob(Base):
    __tablename__ = "analysis_jobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    input_mode: Mapped[InputMode] = mapped_column(Enum(InputMode, name="input_mode"), nullable=False)
    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[JobStatus] = mapped_column(Enum(JobStatus, name="job_status"), default=JobStatus.QUEUED, nullable=False)
    stage: Mapped[str] = mapped_column(String(64), default="queued", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
```

```python
# apps/api/app/schemas/jobs.py
from pydantic import BaseModel, HttpUrl


class CreateJobRequest(BaseModel):
    input_mode: str
    source_url: HttpUrl


class JobResponse(BaseModel):
    id: str
    input_mode: str
    source_url: str
    status: str
    stage: str
```

- [ ] **Step 4: Implement the job creation route**

```python
# apps/api/app/api/routes/jobs.py
from fastapi import APIRouter, status

from app.schemas.jobs import CreateJobRequest, JobResponse

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


@router.post("", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
def create_job(payload: CreateJobRequest) -> JobResponse:
    return JobResponse(
        id="00000000-0000-0000-0000-000000000001",
        input_mode=payload.input_mode,
        source_url=str(payload.source_url),
        status="queued",
        stage="queued",
    )
```

```python
# apps/api/app/main.py
from app.api.routes.jobs import router as jobs_router

app.include_router(jobs_router)
```

- [ ] **Step 5: Run the test to verify it passes, then replace the stub with real persistence**

Run: `cd apps/api && pytest tests/test_create_job.py -v`

Expected: PASS with the stubbed route, followed by a second edit that swaps in a real SQLAlchemy session-backed insert before merging the task.

- [ ] **Step 6: Commit**

```bash
git add apps/api/app apps/api/alembic apps/api/tests/test_create_job.py
git commit -m "feat: add job model and create-job api"
```

## Task 4: Add Ingestion Service, Source Detection, and Worker Dispatch

**Files:**
- Create: `apps/api/app/services/ingestion.py`
- Create: `apps/api/app/tasks.py`
- Create: `apps/api/tests/test_ingestion.py`
- Modify: `apps/api/app/api/routes/jobs.py`

- [ ] **Step 1: Write the failing ingestion tests**

```python
from app.services.ingestion import detect_source_type


def test_detects_ringcentral_recording_url() -> None:
    source = detect_source_type(
        "https://xmrupxmn-rxe-1-v.int.rclabenv.com/recordings/abc?isMeetingId=true"
    )
    assert source == "ringcentral_recording"


def test_detects_public_video_url() -> None:
    source = detect_source_type("https://www.youtube.com/watch?v=abc123")
    assert source == "public_video"
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/api && pytest tests/test_ingestion.py -v`

Expected: FAIL because `detect_source_type` does not exist yet.

- [ ] **Step 3: Implement source detection and worker dispatch**

```python
# apps/api/app/services/ingestion.py
from urllib.parse import urlparse


def detect_source_type(url: str) -> str:
    host = urlparse(url).hostname or ""
    if host.endswith("rclabenv.com") or "ringcentral" in host:
        return "ringcentral_recording"
    return "public_video"
```

```python
# apps/api/app/tasks.py
async def process_analysis_job(ctx: dict, job_id: str) -> None:
    # The initial task body only updates the stage in storage.
    # Later tasks add media, transcript, and summary work here.
    return None
```

```python
# apps/api/app/api/routes/jobs.py
from app.services.ingestion import detect_source_type

resolved_input_mode = detect_source_type(str(payload.source_url))
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/api && pytest tests/test_ingestion.py tests/test_create_job.py -v`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/services/ingestion.py apps/api/app/tasks.py apps/api/app/api/routes/jobs.py apps/api/tests/test_ingestion.py
git commit -m "feat: add ingestion routing and worker dispatch"
```

## Task 5: Implement Public Video Connector and Metadata Probe

**Files:**
- Create: `apps/api/app/services/connectors/public_video.py`
- Create: `apps/api/app/schemas/video_metadata.py`
- Create: `apps/api/tests/test_public_video_connector.py`
- Modify: `apps/api/app/tasks.py`

- [ ] **Step 1: Write the failing metadata normalization test**

```python
from app.services.connectors.public_video import normalize_yt_dlp_metadata


def test_normalizes_public_video_metadata() -> None:
    metadata = normalize_yt_dlp_metadata(
        {
            "title": "Sample Video",
            "duration": 120,
            "thumbnail": "https://example.com/thumb.jpg",
            "uploader": "Example Channel",
            "description": "A short description",
        }
    )
    assert metadata.title == "Sample Video"
    assert metadata.duration_seconds == 120
    assert metadata.thumbnail_url == "https://example.com/thumb.jpg"
    assert metadata.source_name == "Example Channel"
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/api && pytest tests/test_public_video_connector.py -v`

Expected: FAIL because the connector module is missing.

- [ ] **Step 3: Implement the connector normalization layer**

```python
# apps/api/app/schemas/video_metadata.py
from pydantic import BaseModel


class VideoMetadata(BaseModel):
    title: str
    duration_seconds: int | None
    thumbnail_url: str | None
    source_name: str | None
    description: str | None
```

```python
# apps/api/app/services/connectors/public_video.py
from app.schemas.video_metadata import VideoMetadata


def normalize_yt_dlp_metadata(payload: dict) -> VideoMetadata:
    return VideoMetadata(
        title=payload.get("title", "Untitled"),
        duration_seconds=payload.get("duration"),
        thumbnail_url=payload.get("thumbnail"),
        source_name=payload.get("uploader"),
        description=payload.get("description"),
    )
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/api && pytest tests/test_public_video_connector.py -v`

Expected: PASS

- [ ] **Step 5: Extend the worker task to publish a stub metadata event**

```python
async def process_analysis_job(ctx: dict, job_id: str) -> None:
    # Publish a `video.metadata` event after metadata probe is wired in.
    return None
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/app/services/connectors/public_video.py apps/api/app/schemas/video_metadata.py apps/api/tests/test_public_video_connector.py apps/api/app/tasks.py
git commit -m "feat: add public video metadata connector"
```

## Task 6: Implement RingCentral OAuth Shell and Recording Connector

**Files:**
- Create: `apps/api/app/services/connectors/ringcentral.py`
- Create: `apps/api/app/api/routes/oauth.py`
- Create: `apps/api/tests/test_ringcentral_connector.py`
- Modify: `apps/api/app/main.py`

- [ ] **Step 1: Write the failing RingCentral URL support test**

```python
from app.services.connectors.ringcentral import is_ringcentral_recording_url


def test_ringcentral_recording_urls_are_supported() -> None:
    assert is_ringcentral_recording_url(
        "https://xmrupxmn-rxe-1-v.int.rclabenv.com/recordings/abc?isMeetingId=true"
    )
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/api && pytest tests/test_ringcentral_connector.py -v`

Expected: FAIL because the RingCentral connector does not exist.

- [ ] **Step 3: Implement the minimal connector and OAuth route shell**

```python
# apps/api/app/services/connectors/ringcentral.py
from urllib.parse import urlparse


def is_ringcentral_recording_url(url: str) -> bool:
    host = urlparse(url).hostname or ""
    return host.endswith("rclabenv.com") or "ringcentral" in host
```

```python
# apps/api/app/api/routes/oauth.py
from fastapi import APIRouter

router = APIRouter(prefix="/api/oauth", tags=["oauth"])


@router.get("/ringcentral/start")
def start_ringcentral_oauth() -> dict[str, str]:
    return {"provider": "ringcentral", "status": "not_implemented"}
```

```python
# apps/api/app/main.py
from app.api.routes.oauth import router as oauth_router

app.include_router(oauth_router)
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/api && pytest tests/test_ringcentral_connector.py -v`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/services/connectors/ringcentral.py apps/api/app/api/routes/oauth.py apps/api/tests/test_ringcentral_connector.py apps/api/app/main.py
git commit -m "feat: add ringcentral connector shell"
```

## Task 7: Add SSE Event Streaming and Background Progress Updates

**Files:**
- Create: `apps/api/app/services/events.py`
- Create: `apps/api/app/api/routes/events.py`
- Create: `apps/api/tests/test_sse_stream.py`
- Modify: `apps/api/app/main.py`

- [ ] **Step 1: Write the failing SSE format test**

```python
from app.services.events import format_sse_message


def test_formats_sse_message() -> None:
    payload = format_sse_message("job.status", {"status": "queued"})
    assert payload == 'event: job.status\ndata: {"status":"queued"}\n\n'
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/api && pytest tests/test_sse_stream.py -v`

Expected: FAIL because the events helper does not exist.

- [ ] **Step 3: Implement the event formatter and stream route**

```python
# apps/api/app/services/events.py
import json


def format_sse_message(event_name: str, payload: dict) -> str:
    return f"event: {event_name}\ndata: {json.dumps(payload, separators=(',', ':'))}\n\n"
```

```python
# apps/api/app/api/routes/events.py
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.services.events import format_sse_message

router = APIRouter(prefix="/api/jobs", tags=["events"])


@router.get("/{job_id}/events")
def stream_job_events(job_id: str) -> StreamingResponse:
    def event_iterator():
        yield format_sse_message("job.status", {"job_id": job_id, "status": "queued"})

    return StreamingResponse(event_iterator(), media_type="text/event-stream")
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/api && pytest tests/test_sse_stream.py -v`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/services/events.py apps/api/app/api/routes/events.py apps/api/tests/test_sse_stream.py apps/api/app/main.py
git commit -m "feat: add job event streaming"
```

## Task 8: Scaffold the Next.js Frontend and Homepage Shell

**Files:**
- Create: `apps/web/app/layout.tsx`
- Create: `apps/web/app/page.tsx`
- Create: `apps/web/components/hero.tsx`
- Create: `apps/web/components/input-switcher.tsx`
- Create: `apps/web/components/result-workspace.tsx`
- Create: `apps/web/lib/types.ts`
- Create: `apps/web/tests/homepage.test.tsx`

- [ ] **Step 1: Write the failing homepage test**

```tsx
import { render, screen } from "@testing-library/react";

import HomePage from "../app/page";

test("renders both input modes", () => {
  render(<HomePage />);
  expect(screen.getByText("Public Video URL")).toBeInTheDocument();
  expect(screen.getByText("RingCentral Recording URL")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/web && pnpm test homepage.test.tsx`

Expected: FAIL because the page and components do not exist.

- [ ] **Step 3: Implement the homepage shell**

```tsx
// apps/web/app/page.tsx
import { Hero } from "../components/hero";
import { InputSwitcher } from "../components/input-switcher";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white text-slate-950">
      <Hero />
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <InputSwitcher />
      </section>
    </main>
  );
}
```

```tsx
// apps/web/components/input-switcher.tsx
"use client";

export function InputSwitcher() {
  return (
    <div>
      <button type="button">Public Video URL</button>
      <button type="button">RingCentral Recording URL</button>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/web && pnpm test homepage.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/app apps/web/components apps/web/lib apps/web/tests/homepage.test.tsx
git commit -m "feat: scaffold homepage and dual input shell"
```

## Task 9: Build the Analysis Workflow UI and SSE Client

**Files:**
- Create: `apps/web/components/analyze-form.tsx`
- Create: `apps/web/components/status-timeline.tsx`
- Create: `apps/web/components/video-info-panel.tsx`
- Create: `apps/web/components/ai-tabs.tsx`
- Create: `apps/web/lib/api.ts`
- Create: `apps/web/lib/sse.ts`
- Create: `apps/web/tests/analyze-flow.test.tsx`

- [ ] **Step 1: Write the failing interaction test**

```tsx
import { render, screen } from "@testing-library/react";

import { AnalyzeForm } from "../components/analyze-form";

test("renders analyze button", () => {
  render(<AnalyzeForm inputMode="public_video" />);
  expect(screen.getByRole("button", { name: "Analyze" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/web && pnpm test analyze-flow.test.tsx`

Expected: FAIL because the analyze form does not exist.

- [ ] **Step 3: Implement the analyze form and API client shell**

```tsx
// apps/web/components/analyze-form.tsx
"use client";

type AnalyzeFormProps = {
  inputMode: "public_video" | "ringcentral_recording";
};

export function AnalyzeForm({ inputMode }: AnalyzeFormProps) {
  return (
    <form className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <input
        className="w-full rounded-2xl border border-slate-300 px-4 py-3"
        name="sourceUrl"
        placeholder="Paste a video URL"
      />
      <input type="hidden" name="inputMode" value={inputMode} />
      <button className="mt-4 rounded-full bg-sky-600 px-5 py-3 text-white" type="submit">
        Analyze
      </button>
    </form>
  );
}
```

```ts
// apps/web/lib/api.ts
export async function createJob(inputMode: string, sourceUrl: string) {
  const response = await fetch("/api/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input_mode: inputMode, source_url: sourceUrl }),
  });

  if (!response.ok) {
    throw new Error("Failed to create job");
  }

  return response.json();
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/web && pnpm test analyze-flow.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/analyze-form.tsx apps/web/components/status-timeline.tsx apps/web/components/video-info-panel.tsx apps/web/components/ai-tabs.tsx apps/web/lib/api.ts apps/web/lib/sse.ts apps/web/tests/analyze-flow.test.tsx
git commit -m "feat: add analysis workflow ui shell"
```

## Task 10: Implement Transcript, Summary, Mind Map, and Ask AI Progressive States

**Files:**
- Create: `apps/web/components/transcript-tab.tsx`
- Create: `apps/web/components/summary-tab.tsx`
- Create: `apps/web/components/mindmap-tab.tsx`
- Create: `apps/web/components/ask-ai-tab.tsx`
- Create: `apps/web/tests/result-tabs.test.tsx`
- Modify: `apps/web/components/ai-tabs.tsx`

- [ ] **Step 1: Write the failing tab rendering test**

```tsx
import { render, screen } from "@testing-library/react";

import { AITabs } from "../components/ai-tabs";

test("renders the four AI tabs", () => {
  render(<AITabs />);
  expect(screen.getByText("Summary")).toBeInTheDocument();
  expect(screen.getByText("Transcript")).toBeInTheDocument();
  expect(screen.getByText("Mind Map")).toBeInTheDocument();
  expect(screen.getByText("Ask AI")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/web && pnpm test result-tabs.test.tsx`

Expected: FAIL because the AI tabs component is incomplete.

- [ ] **Step 3: Implement the tab shell with progressive-state messaging**

```tsx
// apps/web/components/ai-tabs.tsx
"use client";

export function AITabs() {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex gap-2">
        <button type="button">Summary</button>
        <button type="button">Transcript</button>
        <button type="button">Mind Map</button>
        <button type="button">Ask AI</button>
      </div>
      <div className="mt-6 text-sm text-slate-600">
        Transcript and summary will stream here as the job progresses.
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/web && pnpm test result-tabs.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/ai-tabs.tsx apps/web/components/transcript-tab.tsx apps/web/components/summary-tab.tsx apps/web/components/mindmap-tab.tsx apps/web/components/ask-ai-tab.tsx apps/web/tests/result-tabs.test.tsx
git commit -m "feat: add progressive ai result tabs"
```

## Task 11: Wire Media Pipeline, Transcription, and Summary Worker Stages

**Files:**
- Create: `apps/api/app/services/media_pipeline.py`
- Create: `apps/api/app/services/transcript_pipeline.py`
- Create: `apps/api/app/services/summary_pipeline.py`
- Create: `apps/api/tests/test_pipeline_stage_order.py`
- Modify: `apps/api/app/tasks.py`

- [ ] **Step 1: Write the failing pipeline stage-order test**

```python
from app.services.media_pipeline import build_initial_stage_sequence


def test_pipeline_stages_match_product_flow() -> None:
    assert build_initial_stage_sequence() == [
        "detecting_source",
        "fetching_metadata",
        "downloading_stream",
        "extracting_audio",
        "generating_transcript",
        "building_summary",
        "preparing_qa",
    ]
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/api && pytest tests/test_pipeline_stage_order.py -v`

Expected: FAIL because the media pipeline module does not exist.

- [ ] **Step 3: Implement the pipeline stage helpers**

```python
# apps/api/app/services/media_pipeline.py
def build_initial_stage_sequence() -> list[str]:
    return [
        "detecting_source",
        "fetching_metadata",
        "downloading_stream",
        "extracting_audio",
        "generating_transcript",
        "building_summary",
        "preparing_qa",
    ]
```

```python
# apps/api/app/services/transcript_pipeline.py
def should_finalize_segment(buffered_words: int) -> bool:
    return buffered_words >= 40
```

```python
# apps/api/app/services/summary_pipeline.py
def can_emit_summary(transcript_segments: int) -> bool:
    return transcript_segments >= 3
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/api && pytest tests/test_pipeline_stage_order.py -v`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/services/media_pipeline.py apps/api/app/services/transcript_pipeline.py apps/api/app/services/summary_pipeline.py apps/api/tests/test_pipeline_stage_order.py apps/api/app/tasks.py
git commit -m "feat: add pipeline stage orchestration"
```

## Task 12: Add Q&A Preparation and End-to-End Smoke Coverage

**Files:**
- Create: `apps/api/app/services/qa_pipeline.py`
- Create: `apps/api/tests/test_qa_pipeline.py`
- Create: `apps/web/tests/homepage.spec.ts`
- Modify: `apps/web/components/ask-ai-tab.tsx`

- [ ] **Step 1: Write the failing Q&A readiness test**

```python
from app.services.qa_pipeline import qa_is_ready


def test_qa_requires_three_or_more_chunks() -> None:
    assert qa_is_ready(2) is False
    assert qa_is_ready(3) is True
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/api && pytest tests/test_qa_pipeline.py -v`

Expected: FAIL because the Q&A pipeline module does not exist.

- [ ] **Step 3: Implement the minimal Q&A readiness rule and frontend messaging**

```python
# apps/api/app/services/qa_pipeline.py
def qa_is_ready(indexed_chunks: int) -> bool:
    return indexed_chunks >= 3
```

```tsx
// apps/web/components/ask-ai-tab.tsx
type AskAITabProps = {
  ready: boolean;
};

export function AskAITab({ ready }: AskAITabProps) {
  if (!ready) {
    return <p className="text-sm text-slate-500">Ask AI becomes available after enough transcript has been processed.</p>;
  }

  return <form><input name="question" placeholder="Ask about this video" /></form>;
}
```

- [ ] **Step 4: Run backend and frontend smoke tests**

Run: `cd apps/api && pytest tests/test_qa_pipeline.py -v`

Expected: PASS

Run: `cd apps/web && pnpm test`

Expected: PASS for the current frontend unit tests.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/services/qa_pipeline.py apps/api/tests/test_qa_pipeline.py apps/web/components/ask-ai-tab.tsx apps/web/tests/homepage.spec.ts
git commit -m "feat: add qa readiness and smoke coverage"
```

## Task 13: Final Integration Pass, Developer Scripts, and Manual Verification

**Files:**
- Modify: `README.md`
- Create: `apps/api/.env.example`
- Create: `apps/web/.env.example`
- Create: `apps/web/playwright.config.ts`

- [ ] **Step 1: Add environment examples**

```env
# apps/api/.env.example
DATABASE_URL=postgresql+psycopg://get:get@localhost:5432/get
REDIS_URL=redis://localhost:6379/0
OPENAI_API_KEY=replace-me
RINGCENTRAL_CLIENT_ID=replace-me
RINGCENTRAL_CLIENT_SECRET=replace-me
RINGCENTRAL_REDIRECT_URI=http://localhost:8000/api/oauth/ringcentral/callback
```

```env
# apps/web/.env.example
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

- [ ] **Step 2: Add the manual verification checklist to the README**

```md
## Manual verification

1. Start PostgreSQL and Redis with Docker Compose.
2. Start the FastAPI app.
3. Start the Next.js app.
4. Submit a public video URL and confirm:
   - job is created
   - metadata appears
   - SSE stream connects
   - transcript and summary placeholders update
5. Submit a RingCentral recording URL and confirm:
   - unauthorized users are prompted to connect RingCentral
   - authorized users can start analysis
```

- [ ] **Step 3: Run the full planned verification set**

Run: `cd apps/api && pytest -v`

Expected: PASS

Run: `cd apps/web && pnpm test`

Expected: PASS

Run: `cd apps/web && pnpm test:e2e`

Expected: PASS for the homepage and basic analyze flow smoke checks.

- [ ] **Step 4: Commit**

```bash
git add README.md apps/api/.env.example apps/web/.env.example apps/web/playwright.config.ts
git commit -m "chore: add developer docs and verification steps"
```
