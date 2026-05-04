# Multilingual Transcript And Translation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder transcript and summary shells with real multilingual source-language generation, then add on-demand translation for transcript and summary across 18 supported languages.

**Architecture:** Keep the current job-centric pipeline, but split the work into two shippable phases. Phase 1 upgrades the backend from shell placeholders to real transcription and summary generation with detected-language metadata stored on the job record. Phase 2 adds a derived-localization table, translation API, and language selectors in the transcript and summary tabs so translated artifacts can be generated lazily without blocking job completion.

**Tech Stack:** FastAPI, SQLAlchemy, Python 3.11+, Next.js App Router, React 18, TypeScript, CSS Modules, Vitest, Testing Library, Alembic or repo-standard SQLAlchemy migration workflow, OpenAI speech + text APIs

---

## File Structure

Implementation units for this work:

- `apps/api/app/models/job.py` - canonical source-language job fields
- `apps/api/app/models/analysis_job_localization.py` - new translation artifact model
- `apps/api/app/schemas/jobs.py` - API schema additions for detected language, source transcript, source summary, and localizations
- `apps/api/app/schemas/localizations.py` - request and response schema for lazy translation
- `apps/api/app/api/routes/jobs.py` - extend job detail response and add translation request endpoint
- `apps/api/app/services/transcripts/public_video.py` - replace transcript shell placeholder with real transcription
- `apps/api/app/services/summaries/public_video.py` - replace summary shell placeholder with summary from canonical transcript
- `apps/api/app/services/translations/public_video.py` - new translation service for transcript and summary
- `apps/api/app/tasks.py` - pipeline changes for real transcript + summary, without blocking completion on translation
- `apps/api/app/config.py` - OpenAI credentials and optional model settings
- `apps/api/app/db.py` or repo migration entrypoint - include new model and migration wiring
- `apps/web/lib/types.ts` - new job and localization data types
- `apps/web/lib/api.ts` - translation request client and updated job response parsing
- `apps/web/components/video-info-panel.tsx` - detected language display
- `apps/web/components/transcript-tab.tsx` - canonical source transcript rendering + language selector
- `apps/web/components/summary-tab.tsx` - canonical source summary rendering + language selector
- `apps/web/components/ai-tabs.tsx` - pass source-language and localization props into transcript and summary tabs
- `apps/web/app/page.tsx` - hand new transcript/summary job fields into AI tabs
- `apps/web/app/homepage.module.css` - lightweight styling for detected language and language selectors
- `apps/api/tests/test_transcripts_public_video.py` - transcription service tests
- `apps/api/tests/test_summaries_public_video.py` - summary service tests
- `apps/api/tests/test_translations_public_video.py` - translation service tests
- `apps/api/tests/test_jobs_routes.py` - API tests for job detail and translation endpoint
- `apps/web/tests/result-tabs.test.tsx` - transcript and summary rendering tests
- `apps/web/tests/homepage.test.tsx` - homepage integration for detected language and translated content states
- `docs/superpowers/specs/2026-05-04-multilingual-transcript-translation-design.md` - approved design source of truth

Keep existing UI shell behavior for `Mind Map` and `Ask AI` unless a task explicitly updates it.

## Task 1: Lock Phase 1 Requirements in Backend and Frontend Tests

**Files:**
- Modify: `apps/api/tests/test_transcripts_public_video.py`
- Modify: `apps/api/tests/test_summaries_public_video.py`
- Modify: `apps/api/tests/test_jobs_routes.py`
- Modify: `apps/web/tests/result-tabs.test.tsx`
- Modify: `apps/web/tests/homepage.test.tsx`
- Test: `apps/api/tests/test_transcripts_public_video.py`
- Test: `apps/api/tests/test_summaries_public_video.py`
- Test: `apps/api/tests/test_jobs_routes.py`
- Test: `apps/web/tests/result-tabs.test.tsx`
- Test: `apps/web/tests/homepage.test.tsx`

- [ ] **Step 1: Add a failing backend transcription service test for detected language and real source transcript fields**

```python
def test_execute_public_video_transcript_returns_detected_language_and_source_text():
    job = SimpleNamespace(
        transcript_status="ready",
        transcript_audio_artifact_path="var/transcripts/public-video/job-1.wav",
    )

    def fake_runner(_job):
        return PublicVideoTranscriptResult(
            status="ready",
            stage="transcript_generated",
            detected_language_code="zh",
            detected_language_name="Chinese",
            source_text="大家好，欢迎来到今天的会议。",
            source_segments=[
                {"start": 0.0, "end": 2.1, "text": "大家好，欢迎来到今天的会议。"},
            ],
            preview_text="大家好，欢迎来到今天的会议。",
            segment_count=1,
        )

    result = execute_public_video_transcript_shell(job, runner=fake_runner)

    assert result.detected_language_code == "zh"
    assert result.detected_language_name == "Chinese"
    assert result.source_text == "大家好，欢迎来到今天的会议。"
    assert result.segment_count == 1
```

- [ ] **Step 2: Add a failing backend summary service test that requires canonical transcript text instead of shell placeholder text**

```python
def test_generate_public_video_summary_uses_source_transcript_text():
    job = SimpleNamespace(
        transcript_status="ready",
        transcript_source_text="今天讨论了产品发布时间和客户培训安排。",
        transcript_segment_count=2,
    )

    result = generate_public_video_summary_shell(
        job,
        summarizer=lambda transcript: PublicVideoSummaryShell(
            status="ready",
            stage="summary_generated",
            source_text="产品将在下周发布，培训由支持团队负责。",
            source_bullets=[
                "产品下周发布",
                "支持团队负责培训",
            ],
            preview_text="产品将在下周发布，培训由支持团队负责。",
            key_points_count=2,
        ),
    )

    assert result.source_text == "产品将在下周发布，培训由支持团队负责。"
    assert result.key_points_count == 2
```

- [ ] **Step 3: Add a failing API test that expects detected language and canonical transcript/summary fields in the job detail response**

```python
def test_get_job_returns_detected_language_and_source_artifacts(client, db_session):
    job = AnalysisJob(
        input_mode=InputMode.PUBLIC_VIDEO,
        source_url="https://example.com/video",
        status=JobStatus.COMPLETED,
        stage="summary_generated",
        detected_language_code="zh",
        detected_language_name="Chinese",
        transcript_source_text="大家好，欢迎来到今天的会议。",
        summary_source_text="会议确定了发布时间。",
    )
    db_session.add(job)
    db_session.commit()

    response = client.get(f"/jobs/{job.id}")

    assert response.status_code == 200
    payload = response.json()
    assert payload["detected_language_code"] == "zh"
    assert payload["detected_language_name"] == "Chinese"
    assert payload["transcript_source_text"] == "大家好，欢迎来到今天的会议。"
    assert payload["summary_source_text"] == "会议确定了发布时间。"
```

- [ ] **Step 4: Add a failing frontend result-tabs test for source-language transcript and summary rendering**

```tsx
test("shows source-language transcript and summary content by default", () => {
  render(
    <AITabs
      activeJobId="job-zh"
      jobStatus="completed"
      transcriptSourceText="大家好，欢迎来到今天的会议。"
      summarySourceText="会议确定了发布时间。"
      detectedLanguageName="Chinese"
    />,
  );

  expect(screen.getByText("Detected language: Chinese")).toBeInTheDocument();
  expect(screen.getByText("大家好，欢迎来到今天的会议。")).toBeInTheDocument();
  expect(screen.getByText("会议确定了发布时间。")).toBeInTheDocument();
});
```

- [ ] **Step 5: Add a failing homepage integration test that expects detected language in `Video info` after hydration**

```tsx
test("shows detected audio language in the video info panel", async () => {
  vi.mocked(api.getJob).mockResolvedValue({
    created_at: "2026-05-04T09:00:00Z",
    id: "11111111-1111-1111-1111-111111111111",
    input_mode: "public_video",
    source_url: "https://example.com/video",
    stage: "summary_generated",
    status: "completed",
    detected_language_code: "zh",
    detected_language_name: "Chinese",
    transcript_source_text: "大家好，欢迎来到今天的会议。",
    summary_source_text: "会议确定了发布时间。",
  });

  render(<HomePage />);

  await waitFor(() => {
    expect(screen.getByText("Chinese")).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run the targeted tests to verify they fail on the current implementation**

Run: `cd apps/web && PATH="$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node | tail -n 1)/bin:$PATH" corepack pnpm vitest run tests/result-tabs.test.tsx tests/homepage.test.tsx`

Expected: FAIL because the current UI and API types do not expose detected language or source transcript/summary content.

Run: `cd apps/api && pytest app/tests/test_transcripts_public_video.py app/tests/test_summaries_public_video.py app/tests/test_jobs_routes.py -q`

Expected: FAIL because the backend models and services do not yet return canonical source-language artifacts.

- [ ] **Step 7: Commit**

```bash
git add apps/api/tests/test_transcripts_public_video.py apps/api/tests/test_summaries_public_video.py apps/api/tests/test_jobs_routes.py apps/web/tests/result-tabs.test.tsx apps/web/tests/homepage.test.tsx
git commit -m "test: define multilingual transcript phase one requirements"
```

## Task 2: Add Canonical Source-Language Fields and Persistence

**Files:**
- Modify: `apps/api/app/models/job.py`
- Create: `apps/api/app/models/analysis_job_localization.py`
- Modify: `apps/api/app/models/__init__.py`
- Modify: `apps/api/app/db.py`
- Create: `apps/api/migrations/versions/<timestamp>_add_multilingual_artifacts.py`
- Test: `apps/api/tests/test_jobs_routes.py`

- [ ] **Step 1: Add canonical source-language fields to the job model**

```python
class AnalysisJob(Base):
    __tablename__ = "analysis_jobs"

    # existing fields...
    detected_language_code: Mapped[str | None] = mapped_column(String(16), nullable=True)
    detected_language_name: Mapped[str | None] = mapped_column(String(64), nullable=True)
    transcript_source_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    transcript_source_segments_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary_source_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary_source_bullets_json: Mapped[str | None] = mapped_column(Text, nullable=True)
```

- [ ] **Step 2: Create the localization model for derived translations**

```python
class AnalysisJobLocalization(Base):
    __tablename__ = "analysis_job_localizations"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    job_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("analysis_jobs.id"), nullable=False)
    content_type: Mapped[str] = mapped_column(String(32), nullable=False)
    target_language_code: Mapped[str] = mapped_column(String(16), nullable=False)
    translated_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    translated_segments_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, server_default=text("'queued'"))
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.current_timestamp(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.current_timestamp(), onupdate=func.current_timestamp(), nullable=False)

    __table_args__ = (
        UniqueConstraint("job_id", "content_type", "target_language_code", name="uq_job_content_language"),
    )
```

- [ ] **Step 3: Register the new model and wire it into metadata imports**

```python
# apps/api/app/models/__init__.py
from app.models.analysis_job_localization import AnalysisJobLocalization
from app.models.job import AnalysisJob, InputMode, JobStatus

__all__ = ["AnalysisJob", "AnalysisJobLocalization", "InputMode", "JobStatus"]
```

- [ ] **Step 4: Add the schema migration**

```python
def upgrade():
    op.add_column("analysis_jobs", sa.Column("detected_language_code", sa.String(length=16), nullable=True))
    op.add_column("analysis_jobs", sa.Column("detected_language_name", sa.String(length=64), nullable=True))
    op.add_column("analysis_jobs", sa.Column("transcript_source_text", sa.Text(), nullable=True))
    op.add_column("analysis_jobs", sa.Column("transcript_source_segments_json", sa.Text(), nullable=True))
    op.add_column("analysis_jobs", sa.Column("summary_source_text", sa.Text(), nullable=True))
    op.add_column("analysis_jobs", sa.Column("summary_source_bullets_json", sa.Text(), nullable=True))
    op.create_table(
        "analysis_job_localizations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("job_id", sa.Uuid(), nullable=False),
        sa.Column("content_type", sa.String(length=32), nullable=False),
        sa.Column("target_language_code", sa.String(length=16), nullable=False),
        sa.Column("translated_text", sa.Text(), nullable=True),
        sa.Column("translated_segments_json", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="queued"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.current_timestamp(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.current_timestamp(), nullable=False),
        sa.ForeignKeyConstraint(["job_id"], ["analysis_jobs.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("job_id", "content_type", "target_language_code", name="uq_job_content_language"),
    )
```

- [ ] **Step 5: Run the API schema tests to verify the model migration layer is stable**

Run: `cd apps/api && pytest app/tests/test_jobs_routes.py -q`

Expected: still FAIL, but no import or metadata errors.

- [ ] **Step 6: Commit**

```bash
git add apps/api/app/models/job.py apps/api/app/models/analysis_job_localization.py apps/api/app/models/__init__.py apps/api/app/db.py apps/api/migrations/versions
git commit -m "feat: add canonical multilingual analysis models"
```

## Task 3: Implement Real Multilingual Transcription

**Files:**
- Modify: `apps/api/app/services/transcripts/public_video.py`
- Modify: `apps/api/app/tasks.py`
- Modify: `apps/api/app/config.py`
- Test: `apps/api/tests/test_transcripts_public_video.py`

- [ ] **Step 1: Expand the transcript result dataclass to carry canonical multilingual fields**

```python
@dataclass(slots=True)
class PublicVideoTranscriptResult:
    status: str
    stage: str
    detected_language_code: str | None
    detected_language_name: str | None
    source_text: str | None
    source_segments: list[dict[str, object]] | None
    preview_text: str | None
    segment_count: int | None
```

- [ ] **Step 2: Add a provider-backed transcription function with automatic language detection**

```python
def transcribe_audio_with_openai(
    *,
    audio_artifact_path: str,
    client: OpenAI,
    model: str,
) -> PublicVideoTranscriptResult:
    with open(audio_artifact_path, "rb") as audio_file:
        response = client.audio.transcriptions.create(
            model=model,
            file=audio_file,
            response_format="verbose_json",
        )

    segments = [
        {
            "start": segment.start,
            "end": segment.end,
            "text": segment.text,
        }
        for segment in (response.segments or [])
    ]
    text = (response.text or "").strip()

    return PublicVideoTranscriptResult(
        status="ready",
        stage="transcript_generated",
        detected_language_code=response.language,
        detected_language_name=LANGUAGE_LABELS.get(response.language, response.language),
        source_text=text,
        source_segments=segments,
        preview_text=text[:280] if text else None,
        segment_count=len(segments) if segments else (1 if text else 0),
    )
```

- [ ] **Step 3: Replace the placeholder fallback implementation in `execute_public_video_transcript_shell`**

```python
def execute_public_video_transcript_shell(
    job: object,
    runner: Callable[[object], PublicVideoTranscriptResult] | None = None,
    client: OpenAI | None = None,
    model: str | None = None,
) -> PublicVideoTranscriptResult:
    # existing readiness checks...
    if runner is not None:
        return runner(job)

    resolved_client = client or build_openai_client()
    resolved_model = model or settings.openai_transcription_model
    return transcribe_audio_with_openai(
        audio_artifact_path=audio_artifact_path,
        client=resolved_client,
        model=resolved_model,
    )
```

- [ ] **Step 4: Persist canonical transcript fields in the pipeline state application helper**

```python
def _apply_public_video_transcript_result(job, transcript_result: PublicVideoTranscriptResult) -> None:
    job.transcript_status = transcript_result.status
    job.transcript_preview_text = transcript_result.preview_text
    job.transcript_segment_count = transcript_result.segment_count
    job.detected_language_code = transcript_result.detected_language_code
    job.detected_language_name = transcript_result.detected_language_name
    job.transcript_source_text = transcript_result.source_text
    job.transcript_source_segments_json = json.dumps(transcript_result.source_segments or [], ensure_ascii=False)
    job.status = JobStatus.RUNNING
    job.stage = transcript_result.stage
```

- [ ] **Step 5: Add OpenAI settings for transcription**

```python
class Settings(BaseSettings):
    openai_api_key: str | None = None
    openai_transcription_model: str = "gpt-4o-transcribe"
```

- [ ] **Step 6: Run the transcription tests to verify they pass**

Run: `cd apps/api && pytest app/tests/test_transcripts_public_video.py -q`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/api/app/services/transcripts/public_video.py apps/api/app/tasks.py apps/api/app/config.py apps/api/tests/test_transcripts_public_video.py
git commit -m "feat: add real multilingual transcription"
```

## Task 4: Implement Source-Language Summary Generation

**Files:**
- Modify: `apps/api/app/services/summaries/public_video.py`
- Modify: `apps/api/app/tasks.py`
- Test: `apps/api/tests/test_summaries_public_video.py`

- [ ] **Step 1: Expand the summary dataclass to carry canonical source summary content**

```python
@dataclass(slots=True)
class PublicVideoSummaryShell:
    status: str
    stage: str
    source_text: str | None
    source_bullets: list[str] | None
    preview_text: str | None
    key_points_count: int | None
```

- [ ] **Step 2: Replace placeholder summary generation with a summarizer function that consumes canonical transcript text**

```python
def generate_public_video_summary_shell(
    job: object,
    summarizer: Callable[[str], PublicVideoSummaryShell] | None = None,
) -> PublicVideoSummaryShell:
    transcript_text = getattr(job, "transcript_source_text", None)
    if not transcript_text:
        raise PublicVideoSummaryShellError(
            "missing_transcript_source",
            "The job does not have canonical transcript text for summary generation.",
        )

    if summarizer is not None:
        return summarizer(transcript_text)

    response = summarize_with_openai(transcript_text)
    return PublicVideoSummaryShell(
        status="ready",
        stage="summary_generated",
        source_text=response["summary_text"],
        source_bullets=response["bullets"],
        preview_text=response["summary_text"],
        key_points_count=len(response["bullets"]),
    )
```

- [ ] **Step 3: Persist canonical summary fields in the pipeline**

```python
def _apply_public_video_summary_shell(job, summary_shell: PublicVideoSummaryShell) -> None:
    job.summary_status = summary_shell.status
    job.summary_preview_text = summary_shell.preview_text
    job.summary_key_points_count = summary_shell.key_points_count
    job.summary_source_text = summary_shell.source_text
    job.summary_source_bullets_json = json.dumps(summary_shell.source_bullets or [], ensure_ascii=False)
    job.status = JobStatus.RUNNING
    job.stage = summary_shell.stage
```

- [ ] **Step 4: Run summary tests to verify they pass**

Run: `cd apps/api && pytest app/tests/test_summaries_public_video.py -q`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/services/summaries/public_video.py apps/api/app/tasks.py apps/api/tests/test_summaries_public_video.py
git commit -m "feat: summarize canonical transcript text"
```

## Task 5: Expose Phase 1 Data Through API and UI

**Files:**
- Modify: `apps/api/app/schemas/jobs.py`
- Modify: `apps/api/app/api/routes/jobs.py`
- Modify: `apps/web/lib/types.ts`
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/components/video-info-panel.tsx`
- Modify: `apps/web/components/ai-tabs.tsx`
- Modify: `apps/web/components/transcript-tab.tsx`
- Modify: `apps/web/components/summary-tab.tsx`
- Modify: `apps/web/app/homepage.module.css`
- Test: `apps/api/tests/test_jobs_routes.py`
- Test: `apps/web/tests/result-tabs.test.tsx`
- Test: `apps/web/tests/homepage.test.tsx`

- [ ] **Step 1: Extend the job response schema and route serializer**

```python
class JobRead(BaseModel):
    # existing fields...
    detected_language_code: str | None = None
    detected_language_name: str | None = None
    transcript_source_text: str | None = None
    transcript_source_segments_json: str | None = None
    summary_source_text: str | None = None
    summary_source_bullets_json: str | None = None
```

- [ ] **Step 2: Extend frontend job types**

```ts
export type JobRecord = {
  // existing fields...
  detected_language_code?: string | null;
  detected_language_name?: string | null;
  transcript_source_text?: string | null;
  transcript_source_segments_json?: string | null;
  summary_source_text?: string | null;
  summary_source_bullets_json?: string | null;
};
```

- [ ] **Step 3: Show detected language in `VideoInfoPanel`**

```tsx
<div>
  <dt className={styles.infoLabel}>Detected language</dt>
  <dd className={styles.infoValue}>
    {detectedLanguageName || "Pending analysis"}
  </dd>
</div>
```

- [ ] **Step 4: Pass canonical source-language fields into `AITabs` and render them in the default transcript/summary views**

```tsx
<AITabs
  activeJobId={jobState.id}
  jobStage={jobState.stage}
  jobStatus={jobState.status}
  detectedLanguageName={jobState.detected_language_name}
  transcriptSourceText={jobState.transcript_source_text}
  summarySourceText={jobState.summary_source_text}
  // existing props...
/>;
```

- [ ] **Step 5: Make `TranscriptTab` and `SummaryTab` prefer canonical source text when available**

```tsx
if (sourceText) {
  return (
    <>
      <p className={styles.languageMeta}>Detected language: {detectedLanguageName ?? "Unknown"}</p>
      <div className={styles.transcriptPreview}>
        <p className={styles.transcriptLine}>{sourceText}</p>
      </div>
    </>
  );
}
```

- [ ] **Step 6: Run API and web tests to verify Phase 1 is complete**

Run: `cd apps/api && pytest app/tests/test_jobs_routes.py -q`

Expected: PASS

Run: `cd apps/web && PATH="$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node | tail -n 1)/bin:$PATH" corepack pnpm vitest run tests/result-tabs.test.tsx tests/homepage.test.tsx`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/api/app/schemas/jobs.py apps/api/app/api/routes/jobs.py apps/web/lib/types.ts apps/web/app/page.tsx apps/web/components/video-info-panel.tsx apps/web/components/ai-tabs.tsx apps/web/components/transcript-tab.tsx apps/web/components/summary-tab.tsx apps/web/app/homepage.module.css apps/api/tests/test_jobs_routes.py apps/web/tests/result-tabs.test.tsx apps/web/tests/homepage.test.tsx
git commit -m "feat: surface source-language transcript and summary"
```

## Task 6: Lock Phase 2 Translation Behavior in Tests

**Files:**
- Create: `apps/api/tests/test_translations_public_video.py`
- Modify: `apps/api/tests/test_jobs_routes.py`
- Modify: `apps/web/tests/result-tabs.test.tsx`
- Test: `apps/api/tests/test_translations_public_video.py`
- Test: `apps/api/tests/test_jobs_routes.py`
- Test: `apps/web/tests/result-tabs.test.tsx`

- [ ] **Step 1: Add a failing translation service test for create-or-reuse behavior**

```python
def test_translate_transcript_creates_localization_once(db_session):
    job = AnalysisJob(
        input_mode=InputMode.PUBLIC_VIDEO,
        source_url="https://example.com/video",
        transcript_source_text="大家好，欢迎来到今天的会议。",
    )
    db_session.add(job)
    db_session.commit()

    record = translate_job_artifact(
        db_session=db_session,
        job=job,
        content_type="transcript",
        target_language_code="en",
        translator=lambda text, language: "Hello everyone, welcome to today's meeting.",
    )

    assert record.target_language_code == "en"
    assert record.translated_text == "Hello everyone, welcome to today's meeting."
```

- [ ] **Step 2: Add a failing route test for `POST /jobs/{id}/localizations`**

```python
def test_post_job_localization_returns_existing_translation(client, db_session):
    # seed job + existing localization
    response = client.post(
        f"/jobs/{job.id}/localizations",
        json={"content_type": "summary", "target_language_code": "en"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["content_type"] == "summary"
    assert payload["target_language_code"] == "en"
```

- [ ] **Step 3: Add a failing result-tabs test for lazy translation UI**

```tsx
test("requests transcript translation when switching from original to english", async () => {
  const requestTranslation = vi.fn().mockResolvedValue({
    content_type: "transcript",
    target_language_code: "en",
    translated_text: "Hello everyone, welcome to today's meeting.",
    status: "ready",
  });

  render(
    <TranscriptTab
      detectedLanguageName="Chinese"
      sourceText="大家好，欢迎来到今天的会议。"
      onRequestTranslation={requestTranslation}
      supportedLanguages={[{ code: "en", label: "English" }]}
    />,
  );

  fireEvent.change(screen.getByLabelText("Transcript language"), {
    target: { value: "en" },
  });

  await waitFor(() => {
    expect(requestTranslation).toHaveBeenCalledWith("en");
  });
  expect(screen.getByText("Hello everyone, welcome to today's meeting.")).toBeInTheDocument();
});
```

- [ ] **Step 4: Run the targeted tests to verify they fail**

Run: `cd apps/api && pytest app/tests/test_translations_public_video.py app/tests/test_jobs_routes.py -q`

Expected: FAIL because the localization table and endpoint are not wired.

Run: `cd apps/web && PATH="$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node | tail -n 1)/bin:$PATH" corepack pnpm vitest run tests/result-tabs.test.tsx`

Expected: FAIL because the transcript and summary tabs do not yet support translation selectors.

- [ ] **Step 5: Commit**

```bash
git add apps/api/tests/test_translations_public_video.py apps/api/tests/test_jobs_routes.py apps/web/tests/result-tabs.test.tsx
git commit -m "test: define lazy translation behavior"
```

## Task 7: Implement Translation Service and Endpoint

**Files:**
- Create: `apps/api/app/services/translations/public_video.py`
- Create: `apps/api/app/schemas/localizations.py`
- Modify: `apps/api/app/api/routes/jobs.py`
- Modify: `apps/api/app/models/__init__.py`
- Test: `apps/api/tests/test_translations_public_video.py`
- Test: `apps/api/tests/test_jobs_routes.py`

- [ ] **Step 1: Add translation request and response schemas**

```python
class JobLocalizationCreate(BaseModel):
    content_type: Literal["transcript", "summary"]
    target_language_code: str


class JobLocalizationRead(BaseModel):
    job_id: UUID
    content_type: str
    target_language_code: str
    translated_text: str | None
    status: str
    error_message: str | None
```

- [ ] **Step 2: Implement translation create-or-reuse service**

```python
def translate_job_artifact(
    *,
    db_session: Session,
    job: AnalysisJob,
    content_type: str,
    target_language_code: str,
    translator: Callable[[str, str], str] | None = None,
) -> AnalysisJobLocalization:
    existing = db_session.query(AnalysisJobLocalization).filter_by(
        job_id=job.id,
        content_type=content_type,
        target_language_code=target_language_code,
    ).one_or_none()
    if existing and existing.status == "ready":
        return existing

    source_text = job.transcript_source_text if content_type == "transcript" else job.summary_source_text
    if not source_text:
        raise ValueError(f"Missing source text for {content_type}")

    translated_text = (translator or translate_text_with_openai)(source_text, target_language_code)
    record = existing or AnalysisJobLocalization(
        job_id=job.id,
        content_type=content_type,
        target_language_code=target_language_code,
    )
    record.translated_text = translated_text
    record.status = "ready"
    record.error_message = None
    db_session.add(record)
    db_session.commit()
    db_session.refresh(record)
    return record
```

- [ ] **Step 3: Add the lazy translation endpoint**

```python
@router.post("/jobs/{job_id}/localizations", response_model=JobLocalizationRead)
def create_job_localization(job_id: UUID, payload: JobLocalizationCreate, db: Session = Depends(get_db)):
    job = db.get(AnalysisJob, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    record = translate_job_artifact(
        db_session=db,
        job=job,
        content_type=payload.content_type,
        target_language_code=payload.target_language_code,
    )
    return record
```

- [ ] **Step 4: Run translation backend tests to verify they pass**

Run: `cd apps/api && pytest app/tests/test_translations_public_video.py app/tests/test_jobs_routes.py -q`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/services/translations/public_video.py apps/api/app/schemas/localizations.py apps/api/app/api/routes/jobs.py apps/api/tests/test_translations_public_video.py apps/api/tests/test_jobs_routes.py
git commit -m "feat: add lazy translation endpoint"
```

## Task 8: Add Language Selectors and Lazy Translation UI

**Files:**
- Modify: `apps/web/lib/types.ts`
- Modify: `apps/web/lib/api.ts`
- Modify: `apps/web/components/transcript-tab.tsx`
- Modify: `apps/web/components/summary-tab.tsx`
- Modify: `apps/web/components/ai-tabs.tsx`
- Modify: `apps/web/app/homepage.module.css`
- Test: `apps/web/tests/result-tabs.test.tsx`
- Test: `apps/web/tests/homepage.test.tsx`

- [ ] **Step 1: Add frontend localization types and API client**

```ts
export type JobLocalizationRecord = {
  content_type: "transcript" | "summary";
  target_language_code: string;
  translated_text: string | null;
  status: string;
  error_message?: string | null;
};

export async function createJobLocalization(
  jobId: string,
  payload: { content_type: "transcript" | "summary"; target_language_code: string },
): Promise<JobLocalizationRecord> {
  const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/localizations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleJsonResponse<JobLocalizationRecord>(response);
}
```

- [ ] **Step 2: Add shared supported-language metadata**

```ts
export const SUPPORTED_TRANSLATION_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "zh-CN", label: "Chinese (Simplified)" },
  { code: "zh-TW", label: "Chinese (Traditional)" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "pt", label: "Portuguese" },
  { code: "it", label: "Italian" },
  { code: "ru", label: "Russian" },
  { code: "ar", label: "Arabic" },
  { code: "hi", label: "Hindi" },
  { code: "id", label: "Indonesian" },
  { code: "th", label: "Thai" },
  { code: "vi", label: "Vietnamese" },
  { code: "tr", label: "Turkish" },
  { code: "nl", label: "Dutch" },
];
```

- [ ] **Step 3: Add per-tab language selector state and lazy translation request handling**

```tsx
const [selectedLanguage, setSelectedLanguage] = useState("original");
const [localizations, setLocalizations] = useState<Record<string, JobLocalizationRecord>>({});
const [isLoadingTranslation, setIsLoadingTranslation] = useState(false);
const [translationError, setTranslationError] = useState<string | null>(null);

async function handleLanguageChange(nextLanguage: string) {
  setSelectedLanguage(nextLanguage);
  if (nextLanguage === "original" || localizations[nextLanguage]) {
    return;
  }
  setIsLoadingTranslation(true);
  setTranslationError(null);
  try {
    const record = await createJobLocalization(jobId, {
      content_type: "transcript",
      target_language_code: nextLanguage,
    });
    setLocalizations((current) => ({ ...current, [nextLanguage]: record }));
  } catch (error) {
    setTranslationError(error instanceof Error ? error.message : "Translation failed");
  } finally {
    setIsLoadingTranslation(false);
  }
}
```

- [ ] **Step 4: Render translated transcript and summary content when available**

```tsx
const activeText =
  selectedLanguage === "original"
    ? sourceText
    : localizations[selectedLanguage]?.translated_text ?? null;

return (
  <>
    <label className={styles.languageSelectorLabel} htmlFor="transcript-language">
      Transcript language
    </label>
    <select
      id="transcript-language"
      className={styles.languageSelector}
      onChange={(event) => void handleLanguageChange(event.target.value)}
      value={selectedLanguage}
    >
      <option value="original">Original</option>
      {SUPPORTED_TRANSLATION_LANGUAGES.map((language) => (
        <option key={language.code} value={language.code}>
          {language.label}
        </option>
      ))}
    </select>
    {isLoadingTranslation ? <p>Translating...</p> : null}
    {translationError ? <p>{translationError}</p> : null}
    {activeText ? <p>{activeText}</p> : null}
  </>
);
```

- [ ] **Step 5: Run web tests to verify translation switching passes**

Run: `cd apps/web && PATH="$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node | tail -n 1)/bin:$PATH" corepack pnpm vitest run tests/result-tabs.test.tsx tests/homepage.test.tsx`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/types.ts apps/web/lib/api.ts apps/web/components/transcript-tab.tsx apps/web/components/summary-tab.tsx apps/web/components/ai-tabs.tsx apps/web/app/homepage.module.css apps/web/tests/result-tabs.test.tsx apps/web/tests/homepage.test.tsx
git commit -m "feat: add lazy transcript and summary translation ui"
```

## Task 9: Full Verification and Cleanup

**Files:**
- Modify: `docs/superpowers/specs/2026-05-04-multilingual-transcript-translation-design.md` only if implementation forced a spec correction
- Test: `apps/api/tests/test_transcripts_public_video.py`
- Test: `apps/api/tests/test_summaries_public_video.py`
- Test: `apps/api/tests/test_translations_public_video.py`
- Test: `apps/api/tests/test_jobs_routes.py`
- Test: `apps/web/tests/result-tabs.test.tsx`
- Test: `apps/web/tests/homepage.test.tsx`
- Test: `apps/web/tests/homepage.spec.tsx`
- Test: `apps/web/tests/ask-ai-flow.test.tsx`

- [ ] **Step 1: Run the backend multilingual suite**

Run: `cd apps/api && pytest app/tests/test_transcripts_public_video.py app/tests/test_summaries_public_video.py app/tests/test_translations_public_video.py app/tests/test_jobs_routes.py -q`

Expected: PASS

- [ ] **Step 2: Run the frontend suite affected by transcript and summary changes**

Run: `cd apps/web && PATH="$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node | tail -n 1)/bin:$PATH" corepack pnpm vitest run tests/result-tabs.test.tsx tests/homepage.test.tsx tests/homepage.spec.tsx tests/ask-ai-flow.test.tsx`

Expected: PASS

- [ ] **Step 3: Run the full web test suite**

Run: `cd apps/web && PATH="$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node | tail -n 1)/bin:$PATH" corepack pnpm vitest run`

Expected: PASS

- [ ] **Step 4: Manually verify one Chinese source and one English source**

Run:

```bash
curl -X POST http://localhost:8000/jobs \
  -H "Content-Type: application/json" \
  -d '{"source_url":"<chinese-public-video-url>"}'

curl -X POST http://localhost:8000/jobs \
  -H "Content-Type: application/json" \
  -d '{"source_url":"<english-public-video-url>"}'
```

Expected:

- job detail returns detected language metadata
- transcript source text is non-placeholder
- summary source text is non-placeholder
- UI displays source-language transcript and summary

- [ ] **Step 5: Commit**

```bash
git add apps/api apps/web
git commit -m "feat: ship multilingual transcript and translation pipeline"
```

## Self-Review

Spec coverage check:

- Real transcript generation is covered by Tasks 1, 3, and 5.
- Source-language summary generation is covered by Tasks 1, 4, and 5.
- Derived localization storage and API are covered by Tasks 2, 6, and 7.
- Frontend language switching is covered by Tasks 6 and 8.
- Error isolation for translation is covered by Tasks 6, 7, and 8.

Placeholder scan:

- No `TODO`, `TBD`, or “implement later” markers remain in steps.
- Every code-changing step includes concrete code.
- Every verification step includes exact commands and expected outcomes.

Type consistency check:

- Canonical job fields use `detected_language_code`, `detected_language_name`, `transcript_source_text`, and `summary_source_text` consistently.
- Translation artifact naming uses `content_type`, `target_language_code`, and `translated_text` consistently across model, schema, API, and frontend.
- Phase 1 and Phase 2 boundaries are explicit and do not require translation for overall job completion.
