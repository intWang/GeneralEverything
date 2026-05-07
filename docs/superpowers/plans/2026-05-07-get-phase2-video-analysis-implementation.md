# GET Phase 2 Video Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Phase 2 video-analysis roadmap so GET supports internal RingCentral recordings, visible progress and diagnostics, structured AI output, history controls, exports, and a screenshot-backed test report.

**Architecture:** Keep the existing FastAPI + Next.js architecture. Add backend fields and service contracts first, then stream those additive fields through SSE/API responses into focused frontend components. Ship in small TDD commits so each milestone remains reviewable and independently testable.

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic, pytest, Next.js, React, TypeScript, Vitest, React Testing Library, browser smoke screenshots.

---

## Scope Split

This plan covers all 10 requirements from `docs/superpowers/specs/2026-05-07-get-phase2-video-analysis-design.md`, but execution should be milestone-based:

- Milestone 1 implements RingCentral source foundation, download progress, diagnostics, and frontend progress display.
- Milestone 2 implements timestamped transcript, layered summary, structured mind map, and Ask AI references.
- Milestone 3 implements format choices, task history controls, retry, rename, and delete.
- Milestone 4 implements report export and screenshot-backed validation report.

Milestone 1 is expanded into exact TDD steps below. Milestones 2-4 are specified as file-bound tasks to execute after Milestone 1 lands and the API shape is stable.

## File Structure

### Backend Files

- Modify `apps/api/app/models/job.py`: add additive JSON/text columns for progress, formats, diagnostics, structured AI output, QA history, and exports.
- Modify `apps/api/app/schemas/jobs.py`: expose typed response fields for new columns.
- Modify `apps/api/app/api/routes/jobs.py`: support RingCentral background execution, history operations, export endpoints, and richer responses.
- Modify `apps/api/app/tasks.py`: route RingCentral jobs, publish progress/diagnostic events, persist structured outputs.
- Modify `apps/api/app/services/connectors/ringcentral.py`: normalize internal recording URLs and expose safe metadata/probe diagnostics.
- Modify `apps/api/app/services/downloads/public_video.py`: add progress callback support and normalized format choices.
- Create `apps/api/app/services/downloads/progress.py`: shared progress/format/diagnostic models and JSON helpers.
- Create `apps/api/app/services/reports/export.py`: shared analysis report model and Markdown renderer.
- Modify `apps/api/tests/*`: add focused pytest coverage per service and route.

### Frontend Files

- Modify `apps/web/lib/types.ts`: add `DownloadProgress`, `DownloadFormat`, `Diagnostic`, structured transcript/summary/mindmap/QA/export types.
- Modify `apps/web/lib/api.ts`: add history/export operations.
- Modify `apps/web/lib/sse.ts`: parse new event names.
- Modify `apps/web/app/page.tsx`: merge progress, diagnostics, structured output, and history events into job state.
- Modify `apps/web/components/video-info-panel.tsx`: render progress, diagnostics, and format choices.
- Modify `apps/web/components/status-timeline.tsx`: show progress-aware stages.
- Modify `apps/web/components/transcript-tab.tsx`: render timestamped segments and jump targets.
- Modify `apps/web/components/summary-tab.tsx`: render layered summary and citations.
- Modify `apps/web/components/mindmap-tab.tsx`: render structured tree.
- Modify `apps/web/components/ask-ai-tab.tsx`: render answer references.
- Create `apps/web/components/job-history-panel.tsx`: history, reopen, retry, rename, delete.
- Create `apps/web/components/report-export-panel.tsx`: export actions and generated asset state.
- Modify `apps/web/tests/*`: add RTL tests for each user-visible feature.

### Documentation and Reports

- Create `docs/reports/2026-05-07-get-phase2-test-report.md`.
- Store screenshots in `docs/reports/assets/`.

---

## Milestone 1: Internal Source and Progress Foundation

### Task 1: Add Shared Progress, Format, and Diagnostic Backend Models

**Files:**
- Create: `apps/api/app/services/downloads/progress.py`
- Test: `apps/api/tests/test_download_progress_models.py`

- [ ] **Step 1: Write the failing test**

```python
from app.services.downloads.progress import (
    DownloadDiagnostic,
    DownloadFormatChoice,
    DownloadProgress,
)


def test_download_progress_serializes_known_fields():
    progress = DownloadProgress(
        status="downloading",
        percent=42,
        downloaded_bytes=4_200,
        total_bytes=10_000,
        speed_bytes_per_second=512,
        eta_seconds=12,
    )

    assert progress.model_dump() == {
        "status": "downloading",
        "percent": 42,
        "downloaded_bytes": 4200,
        "total_bytes": 10000,
        "speed_bytes_per_second": 512,
        "eta_seconds": 12,
    }


def test_format_choice_and_diagnostic_are_safe_to_expose():
    format_choice = DownloadFormatChoice(
        format_id="rc-best",
        format_label="RingCentral recording stream",
        resolution="source",
        container="mp4",
        kind="video",
    )
    diagnostic = DownloadDiagnostic(
        reason="ringcentral_auth_required",
        stage="metadata_probe",
        message="This RingCentral recording requires a signed-in session.",
        suggestion="Open the recording in your browser, then retry with a fresh shared link.",
    )

    assert format_choice.model_dump()["format_id"] == "rc-best"
    assert "signed-in" in diagnostic.model_dump()["message"]
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd apps/api
source .venv-local/bin/activate || source .venv/bin/activate
pytest tests/test_download_progress_models.py -q
```

Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.downloads.progress'`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/api/app/services/downloads/progress.py`:

```python
from typing import Literal

from pydantic import BaseModel, Field


DownloadProgressStatus = Literal["queued", "probing", "downloading", "ready", "failed"]
DownloadAssetKind = Literal["video", "audio", "subtitle", "thumbnail", "report"]


class DownloadProgress(BaseModel):
    status: DownloadProgressStatus
    percent: int | None = Field(default=None, ge=0, le=100)
    downloaded_bytes: int | None = Field(default=None, ge=0)
    total_bytes: int | None = Field(default=None, ge=0)
    speed_bytes_per_second: int | None = Field(default=None, ge=0)
    eta_seconds: int | None = Field(default=None, ge=0)


class DownloadFormatChoice(BaseModel):
    format_id: str
    format_label: str
    resolution: str | None = None
    container: str | None = None
    kind: DownloadAssetKind


class DownloadDiagnostic(BaseModel):
    reason: str
    stage: str
    message: str
    suggestion: str
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd apps/api
source .venv-local/bin/activate || source .venv/bin/activate
pytest tests/test_download_progress_models.py -q
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/services/downloads/progress.py apps/api/tests/test_download_progress_models.py
git commit -m "feat: add download progress models"
```

### Task 2: Persist Progress, Formats, and Diagnostics on Jobs

**Files:**
- Modify: `apps/api/app/models/job.py`
- Modify: `apps/api/app/schemas/jobs.py`
- Test: `apps/api/tests/test_create_job.py`

- [ ] **Step 1: Write the failing test**

Append to `apps/api/tests/test_create_job.py`:

```python
def test_job_response_exposes_progress_formats_and_diagnostics(client):
    response = client.post(
        "/api/jobs",
        json={"source_url": "https://example.com/video.mp4"},
    )

    assert response.status_code == 201
    payload = response.json()
    assert "download_progress" in payload
    assert "download_formats" in payload
    assert "diagnostics" in payload
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd apps/api
source .venv-local/bin/activate || source .venv/bin/activate
pytest tests/test_create_job.py::test_job_response_exposes_progress_formats_and_diagnostics -q
```

Expected: FAIL because the response does not include the new fields.

- [ ] **Step 3: Write minimal implementation**

Add nullable columns to `AnalysisJob` in `apps/api/app/models/job.py`:

```python
    download_progress_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    download_formats_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    diagnostics_json: Mapped[str | None] = mapped_column(Text, nullable=True)
```

Add properties:

```python
    @property
    def download_progress(self) -> dict | None:
        if not self.download_progress_json:
            return None

        return json.loads(self.download_progress_json)

    @property
    def download_formats(self) -> list[dict] | None:
        if not self.download_formats_json:
            return None

        return json.loads(self.download_formats_json)

    @property
    def diagnostics(self) -> list[dict] | None:
        if not self.diagnostics_json:
            return None

        return json.loads(self.diagnostics_json)
```

Add fields to `JobResponse` in `apps/api/app/schemas/jobs.py`:

```python
    download_progress: dict | None = None
    download_formats: list[dict] | None = None
    diagnostics: list[dict] | None = None
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd apps/api
source .venv-local/bin/activate || source .venv/bin/activate
pytest tests/test_create_job.py::test_job_response_exposes_progress_formats_and_diagnostics -q
```

Expected: PASS.

- [ ] **Step 5: Run existing API tests**

Run:

```bash
cd apps/api
source .venv-local/bin/activate || source .venv/bin/activate
pytest -q
```

Expected: all API tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/api/app/models/job.py apps/api/app/schemas/jobs.py apps/api/tests/test_create_job.py
git commit -m "feat: expose job progress diagnostics"
```

### Task 3: Normalize RingCentral Recording Diagnostics

**Files:**
- Modify: `apps/api/app/services/connectors/ringcentral.py`
- Test: `apps/api/tests/test_ringcentral_connector.py`

- [ ] **Step 1: Write the failing test**

Append to `apps/api/tests/test_ringcentral_connector.py`:

```python
from app.services.connectors.ringcentral import (
    RingCentralProbeError,
    sanitize_ringcentral_url,
)


def test_sanitize_ringcentral_url_removes_sensitive_query_tokens():
    sanitized = sanitize_ringcentral_url(
        "https://xmrupxmn-rxe-1-v.int.rclabenv.com/recordings/abc?code=secret&headless=true"
    )

    assert sanitized == "https://xmrupxmn-rxe-1-v.int.rclabenv.com/recordings/abc?headless=true"
    assert "secret" not in sanitized


def test_ringcentral_probe_error_exposes_safe_diagnostic():
    error = RingCentralProbeError(
        reason="ringcentral_auth_required",
        message="This RingCentral recording requires a signed-in session.",
    )

    assert error.diagnostic().reason == "ringcentral_auth_required"
    assert error.diagnostic().stage == "metadata_probe"
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd apps/api
source .venv-local/bin/activate || source .venv/bin/activate
pytest tests/test_ringcentral_connector.py -q
```

Expected: FAIL because `sanitize_ringcentral_url` or `diagnostic()` is missing.

- [ ] **Step 3: Write minimal implementation**

In `apps/api/app/services/connectors/ringcentral.py`, add:

```python
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from app.services.downloads.progress import DownloadDiagnostic


SENSITIVE_RINGCENTRAL_QUERY_KEYS = {"code", "access_token", "token", "auth", "jwt"}


def sanitize_ringcentral_url(source_url: str) -> str:
    parsed = urlsplit(source_url)
    safe_query = urlencode(
        [
            (key, value)
            for key, value in parse_qsl(parsed.query, keep_blank_values=True)
            if key.lower() not in SENSITIVE_RINGCENTRAL_QUERY_KEYS
        ]
    )
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, safe_query, parsed.fragment))


class RingCentralProbeError(Exception):
    def __init__(self, reason: str, message: str):
        super().__init__(message)
        self.reason = reason
        self.message = message

    def diagnostic(self) -> DownloadDiagnostic:
        return DownloadDiagnostic(
            reason=self.reason,
            stage="metadata_probe",
            message=self.message,
            suggestion="Open the recording in your browser, confirm access, then retry with a fresh shared link.",
        )
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd apps/api
source .venv-local/bin/activate || source .venv/bin/activate
pytest tests/test_ringcentral_connector.py -q
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/services/connectors/ringcentral.py apps/api/tests/test_ringcentral_connector.py
git commit -m "feat: add safe ringcentral diagnostics"
```

### Task 4: Route RingCentral Jobs Through Background Processing

**Files:**
- Modify: `apps/api/app/api/routes/jobs.py`
- Modify: `apps/api/app/tasks.py`
- Test: `apps/api/tests/test_ringcentral_connector.py`
- Test: `apps/api/tests/test_sse_stream.py`

- [ ] **Step 1: Write the failing route test**

Add a test proving RingCentral jobs are not left inert:

```python
def test_create_ringcentral_job_queues_background_processing(client, monkeypatch):
    queued_job_ids = []

    def fake_add_task(self, func, *args, **kwargs):
        queued_job_ids.append(args[0])

    monkeypatch.setattr("fastapi.BackgroundTasks.add_task", fake_add_task)

    response = client.post(
        "/api/jobs",
        json={
            "source_url": "https://xmrupxmn-rxe-1-v.int.rclabenv.com/recordings/abc?isMeetingId=true"
        },
    )

    assert response.status_code == 201
    assert response.json()["input_mode"] == "ringcentral_recording"
    assert queued_job_ids
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd apps/api
source .venv-local/bin/activate || source .venv/bin/activate
pytest tests/test_ringcentral_connector.py::test_create_ringcentral_job_queues_background_processing -q
```

Expected: FAIL because only public video jobs are queued.

- [ ] **Step 3: Write minimal implementation**

In `apps/api/app/api/routes/jobs.py`, rename `run_public_video_job_in_background` to `run_analysis_job_in_background`, keep the body, and queue both public video and RingCentral jobs:

```python
if job.input_mode in {InputMode.PUBLIC_VIDEO, InputMode.RINGCENTRAL_RECORDING}:
    background_tasks.add_task(
        run_analysis_job_in_background,
        job.id,
        session.get_bind(),
    )
```

In `apps/api/app/tasks.py`, remove the early return that ignores non-public-video jobs and add a RingCentral branch that publishes safe metadata or diagnostics using `RingCentralProbeError`.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd apps/api
source .venv-local/bin/activate || source .venv/bin/activate
pytest tests/test_ringcentral_connector.py::test_create_ringcentral_job_queues_background_processing -q
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/api/routes/jobs.py apps/api/app/tasks.py apps/api/tests/test_ringcentral_connector.py
git commit -m "feat: queue ringcentral analysis jobs"
```

### Task 5: Publish and Persist Download Progress Events

**Files:**
- Modify: `apps/api/app/tasks.py`
- Test: `apps/api/tests/test_public_video_download_service.py`
- Test: `apps/api/tests/test_sse_stream.py`

- [ ] **Step 1: Write the failing orchestration test**

Add to `apps/api/tests/test_public_video_download_service.py`:

```python
def test_download_progress_event_is_persisted_and_published(fake_job, event_recorder):
    progress_payload = {
        "status": "downloading",
        "percent": 50,
        "downloaded_bytes": 500,
        "total_bytes": 1000,
        "speed_bytes_per_second": 100,
        "eta_seconds": 5,
    }

    fake_job.download_progress_json = None
    from app.tasks import _apply_public_video_download_progress

    _apply_public_video_download_progress(fake_job, progress_payload)

    assert '"percent": 50' in fake_job.download_progress_json
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd apps/api
source .venv-local/bin/activate || source .venv/bin/activate
pytest tests/test_public_video_download_service.py::test_download_progress_event_is_persisted_and_published -q
```

Expected: FAIL because `_apply_public_video_download_progress` does not exist.

- [ ] **Step 3: Write minimal implementation**

Add to `apps/api/app/tasks.py`:

```python
def _apply_public_video_download_progress(job, progress_payload: dict) -> None:
    job.download_progress_json = json.dumps(progress_payload, ensure_ascii=False)
    job.download_status = progress_payload.get("status", job.download_status)
    if progress_payload.get("status") == "downloading":
        job.stage = "downloading"
        job.status = JobStatus.RUNNING
```

Wire download progress callbacks in `_execute_public_video_download` when the executor supports `on_progress`, and publish:

```python
publish_now(
    "video.download.progress",
    {"job_id": str(job_id), "progress": progress_payload},
)
```

- [ ] **Step 4: Run targeted tests**

Run:

```bash
cd apps/api
source .venv-local/bin/activate || source .venv/bin/activate
pytest tests/test_public_video_download_service.py tests/test_sse_stream.py -q
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/tasks.py apps/api/tests/test_public_video_download_service.py apps/api/tests/test_sse_stream.py
git commit -m "feat: publish download progress events"
```

### Task 6: Render Progress, Formats, and Diagnostics in Video Info Panel

**Files:**
- Modify: `apps/web/lib/types.ts`
- Modify: `apps/web/components/video-info-panel.tsx`
- Modify: `apps/web/app/page.tsx`
- Test: `apps/web/tests/video-info-panel.test.tsx`

- [ ] **Step 1: Write the failing frontend test**

Append to `apps/web/tests/video-info-panel.test.tsx`:

```tsx
test("renders download progress, formats, and diagnostics", () => {
  render(
    <VideoInfoPanel
      downloadFormats={[
        {
          container: "mp4",
          format_id: "rc-best",
          format_label: "RingCentral recording stream",
          kind: "video",
          resolution: "source",
        },
      ]}
      downloadProgress={{
        downloaded_bytes: 500,
        eta_seconds: 5,
        percent: 50,
        speed_bytes_per_second: 100,
        status: "downloading",
        total_bytes: 1000,
      }}
      diagnostics={[
        {
          message: "This RingCentral recording requires a signed-in session.",
          reason: "ringcentral_auth_required",
          stage: "metadata_probe",
          suggestion: "Open the recording in your browser, then retry.",
        },
      ]}
      inputMode="ringcentral_recording"
      sourceUrl="https://xmrupxmn-rxe-1-v.int.rclabenv.com/recordings/abc"
    />,
  );

  expect(screen.getByText("Download progress")).toBeInTheDocument();
  expect(screen.getByText("50%")).toBeInTheDocument();
  expect(screen.getByText("RingCentral recording stream")).toBeInTheDocument();
  expect(screen.getByText("This RingCentral recording requires a signed-in session.")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd apps/web
/usr/bin/env PATH=/Users/ace.wang/.local/runtime/node20/bin:/usr/bin:/bin:/usr/sbin:/sbin ../../node_modules/.pnpm/node_modules/.bin/vitest run tests/video-info-panel.test.tsx
```

Expected: FAIL because props and UI are missing.

- [ ] **Step 3: Write minimal implementation**

Add types in `apps/web/lib/types.ts`:

```ts
export type DownloadProgress = {
  downloaded_bytes?: number | null;
  eta_seconds?: number | null;
  percent?: number | null;
  speed_bytes_per_second?: number | null;
  status: "queued" | "probing" | "downloading" | "ready" | "failed";
  total_bytes?: number | null;
};

export type DownloadFormat = {
  container?: string | null;
  format_id: string;
  format_label: string;
  kind: "video" | "audio" | "subtitle" | "thumbnail" | "report";
  resolution?: string | null;
};

export type Diagnostic = {
  message: string;
  reason: string;
  stage: string;
  suggestion: string;
};
```

Add optional props to `VideoInfoPanelProps` and render:

```tsx
{downloadProgress ? (
  <div aria-label="Download progress">
    <p>Download progress</p>
    <strong>{downloadProgress.percent ?? 0}%</strong>
  </div>
) : null}
```

Render format labels and diagnostic message/suggestion below the metadata grid.

- [ ] **Step 4: Run targeted frontend test**

Run:

```bash
cd apps/web
/usr/bin/env PATH=/Users/ace.wang/.local/runtime/node20/bin:/usr/bin:/bin:/usr/sbin:/sbin ../../node_modules/.pnpm/node_modules/.bin/vitest run tests/video-info-panel.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/types.ts apps/web/components/video-info-panel.tsx apps/web/app/page.tsx apps/web/tests/video-info-panel.test.tsx
git commit -m "feat: show video progress diagnostics"
```

### Task 7: Merge Download Progress SSE Events on the Homepage

**Files:**
- Modify: `apps/web/lib/sse.ts`
- Modify: `apps/web/app/page.tsx`
- Test: `apps/web/tests/homepage.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `apps/web/tests/homepage.test.tsx`:

```tsx
test("streams download progress into the video info panel", async () => {
  const job = buildJobRecord({
    id: "job-123",
    stage: "downloading",
    status: "running",
  });
  mockListJobs.mockResolvedValue([job]);
  mockGetJob.mockResolvedValue(job);

  render(<HomePage />);

  emitJobEvent("video.download.progress", {
    job_id: "job-123",
    progress: {
      downloaded_bytes: 500,
      eta_seconds: 5,
      percent: 50,
      speed_bytes_per_second: 100,
      status: "downloading",
      total_bytes: 1000,
    },
  });

  expect(await screen.findByText("Download progress")).toBeInTheDocument();
  expect(screen.getByText("50%")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd apps/web
/usr/bin/env PATH=/Users/ace.wang/.local/runtime/node20/bin:/usr/bin:/bin:/usr/sbin:/sbin ../../node_modules/.pnpm/node_modules/.bin/vitest run tests/homepage.test.tsx
```

Expected: FAIL because the event is ignored or progress is not merged.

- [ ] **Step 3: Write minimal implementation**

In the homepage SSE handler, handle:

```ts
if (event.event === "video.download.progress") {
  setJobState((currentJob) =>
    currentJob && currentJob.id === event.payload.job_id
      ? {
          ...currentJob,
          download_progress: event.payload.progress,
          download_status: event.payload.progress.status,
          stage: event.payload.progress.status === "downloading" ? "downloading" : currentJob.stage,
        }
      : currentJob,
  );
}
```

Pass `downloadProgress`, `downloadFormats`, and `diagnostics` to `VideoInfoPanel`.

- [ ] **Step 4: Run targeted test**

Run:

```bash
cd apps/web
/usr/bin/env PATH=/Users/ace.wang/.local/runtime/node20/bin:/usr/bin:/bin:/usr/sbin:/sbin ../../node_modules/.pnpm/node_modules/.bin/vitest run tests/homepage.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/sse.ts apps/web/app/page.tsx apps/web/tests/homepage.test.tsx
git commit -m "feat: stream download progress to homepage"
```

---

## Milestone 2: Structured AI Output

### Task 8: Persist Timestamped Transcript Segments

**Files:**
- Modify: `apps/api/app/models/job.py`
- Modify: `apps/api/app/schemas/jobs.py`
- Modify: `apps/api/app/tasks.py`
- Modify: `apps/web/lib/types.ts`
- Modify: `apps/web/components/transcript-tab.tsx`
- Test: `apps/api/tests/test_public_video_transcript_service.py`
- Test: `apps/web/tests/result-tabs.test.tsx`

Steps:

- [ ] Add a failing API test that expects `transcript_source_segments` with `id`, `start_seconds`, `end_seconds`, and `text`.
- [ ] Add a failing web test that expects timestamp chips such as `00:03` beside transcript segments.
- [ ] Add additive schema/property fields and preserve existing `transcript_source_text`.
- [ ] Render segment list when structured segments exist; keep current text fallback.
- [ ] Run targeted API and web tests.
- [ ] Commit with `feat: render timestamped transcript segments`.

### Task 9: Add Layered Summary With Citations

**Files:**
- Modify: `apps/api/app/models/job.py`
- Modify: `apps/api/app/schemas/jobs.py`
- Modify: `apps/api/app/services/summaries/public_video.py`
- Modify: `apps/web/lib/types.ts`
- Modify: `apps/web/components/summary-tab.tsx`
- Test: `apps/api/tests/test_public_video_summary_service.py`
- Test: `apps/web/tests/result-tabs.test.tsx`

Steps:

- [ ] Add a failing API test for `summary_structured` containing `abstract`, `key_points`, `action_items`, `decisions`, `risks`, and `citations`.
- [ ] Add a failing web test for visible sections: `Action items`, `Decisions`, and timestamp citation chips.
- [ ] Add additive JSON persistence and response fields.
- [ ] Render structured summary sections with legacy fallback.
- [ ] Run targeted API and web tests.
- [ ] Commit with `feat: add structured summary sections`.

### Task 10: Add Structured Mind Map Tree

**Files:**
- Modify: `apps/api/app/models/job.py`
- Modify: `apps/api/app/schemas/jobs.py`
- Modify: `apps/api/app/services/mindmaps/public_video.py`
- Modify: `apps/web/lib/types.ts`
- Modify: `apps/web/components/mindmap-tab.tsx`
- Test: `apps/api/tests/test_public_video_mindmap_service.py`
- Test: `apps/web/tests/result-tabs.test.tsx`

Steps:

- [ ] Add a failing API test for `mindmap_nodes` tree with node IDs, labels, children, and references.
- [ ] Add a failing web test that expands/collapses at least one mind map branch.
- [ ] Add additive JSON persistence and response fields.
- [ ] Render tree UI with text preview fallback.
- [ ] Run targeted API and web tests.
- [ ] Commit with `feat: render structured mind map`.

### Task 11: Add Ask AI Structured References

**Files:**
- Modify: `apps/api/app/schemas/jobs.py`
- Modify: `apps/api/app/services/qa_pipeline.py`
- Modify: `apps/web/components/ask-ai-tab.tsx`
- Test: `apps/api/tests/test_qa_pipeline.py`
- Test: `apps/web/tests/ask-ai-flow.test.tsx`

Steps:

- [ ] Add a failing API test that expects QA references as objects with `source_type`, `segment_id`, `start_seconds`, `end_seconds`, and `snippet`.
- [ ] Add a failing web test that renders answer references and a transcript jump control.
- [ ] Keep legacy string references compatible while adding structured references.
- [ ] Render references under each answer.
- [ ] Run targeted tests.
- [ ] Commit with `feat: cite ask ai answers`.

---

## Milestone 3: Assets, History, and Recovery

### Task 12: Add Format Choice UI and Asset Download Actions

**Files:**
- Modify: `apps/api/app/services/downloads/public_video.py`
- Modify: `apps/api/app/schemas/jobs.py`
- Modify: `apps/web/components/video-info-panel.tsx`
- Test: `apps/api/tests/test_public_video_download_service.py`
- Test: `apps/web/tests/video-info-panel.test.tsx`

Steps:

- [ ] Add failing tests for multiple available formats.
- [ ] Persist `download_formats_json`.
- [ ] Render format radio/list controls and download links when artifact paths are available.
- [ ] Run targeted tests.
- [ ] Commit with `feat: expose downloadable formats`.

### Task 13: Add Rename, Retry, and Delete Job APIs

**Files:**
- Modify: `apps/api/app/models/job.py`
- Modify: `apps/api/app/api/routes/jobs.py`
- Modify: `apps/api/app/schemas/jobs.py`
- Test: `apps/api/tests/test_create_job.py`

Steps:

- [ ] Add failing API tests for `PATCH /api/jobs/{job_id}`, `POST /api/jobs/{job_id}/retry`, and `DELETE /api/jobs/{job_id}`.
- [ ] Add a nullable title override or reuse `title` for rename.
- [ ] Implement route handlers with 404 behavior.
- [ ] Run API tests.
- [ ] Commit with `feat: manage saved jobs`.

### Task 14: Add Job History Panel

**Files:**
- Create: `apps/web/components/job-history-panel.tsx`
- Modify: `apps/web/lib/api.ts`
- Modify: `apps/web/app/page.tsx`
- Test: `apps/web/tests/homepage.test.tsx`

Steps:

- [ ] Add failing tests for reopen, rename, retry, and delete controls.
- [ ] Implement API helpers.
- [ ] Render compact history panel.
- [ ] Wire controls to existing hydration.
- [ ] Run homepage tests.
- [ ] Commit with `feat: add job history controls`.

---

## Milestone 4: Export and Screenshot Test Report

### Task 15: Add Markdown Analysis Report Export

**Files:**
- Create: `apps/api/app/services/reports/export.py`
- Modify: `apps/api/app/api/routes/jobs.py`
- Modify: `apps/web/lib/api.ts`
- Create: `apps/web/components/report-export-panel.tsx`
- Test: `apps/api/tests/test_report_export.py`
- Test: `apps/web/tests/result-tabs.test.tsx`

Steps:

- [ ] Add a failing API test that exports Markdown with metadata, summary, transcript, mind map, Ask AI, and references.
- [ ] Add a failing web test that shows `Export report` and downloads `.md`.
- [ ] Implement Markdown renderer from existing job fields.
- [ ] Render export action in the result workspace.
- [ ] Run targeted tests.
- [ ] Commit with `feat: export analysis report markdown`.

### Task 16: Add Screenshot-Backed Test Report

**Files:**
- Create: `docs/reports/2026-05-07-get-phase2-test-report.md`
- Create directory: `docs/reports/assets/`
- Test/Run: API pytest, web Vitest, browser screenshots.

Steps:

- [ ] Run API tests:

```bash
cd apps/api
source .venv-local/bin/activate || source .venv/bin/activate
pytest -q
```

- [ ] Run web tests:

```bash
cd apps/web
/usr/bin/env PATH=/Users/ace.wang/.local/runtime/node20/bin:/usr/bin:/bin:/usr/sbin:/sbin ../../node_modules/.pnpm/node_modules/.bin/vitest run
```

- [ ] Start the local app and capture screenshots for homepage, active analysis, progress/diagnostics, transcript timeline, Ask AI references, history panel, and export controls.
- [ ] Save screenshots under `docs/reports/assets/`.
- [ ] Write the report with command outputs, screenshot links, feature checklist, and known limitations.
- [ ] Commit with `docs: add phase 2 test report`.

---

## Self-Review

Spec coverage:

- RingCentral loop: Tasks 3-4.
- Download progress: Tasks 1-2 and 5-7.
- Format choices: Task 12.
- Transcript timeline: Task 8.
- Layered summary: Task 9.
- Structured mind map: Task 10.
- Ask AI references: Task 11.
- Task history: Tasks 13-14.
- Error diagnostics: Tasks 1-4 and 6.
- Complete report export and screenshots: Tasks 15-16.

Placeholder scan:

- This plan intentionally avoids unfinished-marker wording and unspecified future-work phrasing.
- Milestone 1 includes exact test snippets and implementation snippets because it is the immediate execution target.
- Milestones 2-4 are file-bound execution tasks with explicit test expectations and commit gates; they should be expanded into finer implementation subplans if a worker takes them independently.

Type consistency:

- Backend additive fields use snake_case JSON response names.
- Frontend types mirror backend response names.
- `download_progress`, `download_formats`, and `diagnostics` are the shared bridge fields for Milestone 1.
