# GET Phase 2 Video Analysis Design

## Goal

Phase 2 turns GET from a polished Phase 1 video-analysis shell into an internally useful video-intelligence workspace. It must support company RingCentral recording URLs as a first-class source, expose real progress and recoverable errors, enrich the four AI result areas, preserve task history, and produce exportable reports with a screenshot-backed test report.

## Scope

This design covers the 10 requested demand points as one coordinated Phase 2 program:

1. Real RingCentral recording analysis loop.
2. Download progress visualization.
3. Real format and resolution choices.
4. Streamed transcript timeline.
5. Layered streaming summary.
6. Structured interactive mind map.
7. Ask AI answers with source references.
8. Task history and reopen experience.
9. Error recovery and diagnostics.
10. Complete analysis report export.

The implementation should still ship in small commits. Each milestone must produce working, testable software and must not block later milestones if an external RingCentral URL or media tool is unavailable in local development.

## Product Principles

- URL-first remains the main interaction. Users should not choose a technical workflow before pasting a URL.
- RingCentral recordings are the primary internal success path. Public video support remains useful but secondary.
- The UI should expose useful progress instead of opaque loading states.
- AI output must show provenance. Summaries, mind maps, and answers are more trustworthy when users can trace them back to transcript segments.
- Exported reports should be useful outside the app and preserve source context.
- Every user-visible feature must have automated tests and the final validation report must include screenshots.

## Architecture

The existing architecture stays intact:

- `apps/api`: FastAPI service, SQLAlchemy models, background task orchestration, connector services, download/transcript/summary/mindmap/QA services, and SSE event publishing.
- `apps/web`: Next.js app with URL-first homepage, job hydration, SSE subscription, result workspace, video info panel, timeline, and four AI tabs.
- `docs`: product specs, implementation plans, status documents, and final test reports.

Phase 2 adds focused units rather than one large rewrite:

- Source connectors normalize public video and RingCentral URLs into common metadata, download, and transcript-ready contracts.
- Download services publish progress snapshots and available format choices.
- Transcript services persist timestamped segments, not just raw text.
- Summary, mind map, and QA services consume timestamped transcript references and preserve citations.
- Export services build Markdown first, then optionally PDF and DOCX from the same normalized report model.
- The web app renders progress, diagnostics, cited AI output, task history controls, and report export actions from the shared job API shape.

## Backend Design

### RingCentral Recording Loop

RingCentral support should use the existing `ringcentral_recording` input mode. The connector should:

- Detect RingCentral recording URLs from the submitted source.
- Preserve the original URL and derived recording ID when available.
- Extract metadata such as title, duration, thumbnail, owner/source, and meeting description when available.
- Support authenticated or signed internal recording URLs without logging sensitive query tokens.
- Return clear typed failures for expired links, missing auth, unreachable media, unsupported recording pages, and download-denied responses.

Local tests should use deterministic fixtures and mocked HTTP responses. The local implementation may keep real credential handling behind configuration flags if internal auth cannot be exercised in CI.

### Download Progress and Format Choices

The download layer should expose a common `DownloadProgress` shape:

- `status`: `queued`, `probing`, `downloading`, `ready`, or `failed`.
- `percent`: integer from 0 to 100 when known.
- `downloaded_bytes` and `total_bytes` when known.
- `speed_bytes_per_second` when known.
- `eta_seconds` when known.
- `format_id`, `format_label`, `resolution`, `container`, and `kind` for available formats.

The backend should publish `video.download.progress` events during long-running downloads and persist the latest progress snapshot on the job. Format choices can be populated during metadata probing or download planning. The initial implementation can expose known fixture choices and yt-dlp choices for public video while RingCentral exposes the best available recording stream if multiple internal variants are unavailable.

### Timestamped Transcript Timeline

Transcript output should persist structured segments:

- Segment ID.
- Start and end time in seconds.
- Source text.
- Optional translated text per language.
- Confidence or extractor label when available.

SSE should keep publishing incremental transcript segment events. The persisted job response should include enough structured segment data for reopening a completed job without losing the timeline.

### Layered Summary

Summary generation should produce a structured result:

- Live takeaways while transcript is streaming.
- Final abstract.
- Key points.
- Action items.
- Decisions.
- Risks or open questions.
- Citations referencing transcript segment IDs or timestamp ranges.

The current summary text and bullets can remain as compatibility fields while the structured summary is introduced.

### Structured Mind Map

Mind map generation should emit a normalized tree:

- Node ID.
- Label.
- Optional summary.
- Children.
- Optional source segment references.

The text preview remains available for legacy rendering and export fallback. The frontend should render the tree interactively when structured data exists.

### Ask AI With References

QA should answer only from available transcript, summary, and mind map context. Each answer should include references:

- Source type: transcript, summary, or mind map.
- Segment ID or section key.
- Timestamp range when available.
- Short quoted or paraphrased snippet.

The UI should render references under answers and allow users to jump to the related transcript segment when possible.

### Task History

The job list should become a useful history surface:

- Reopen recent jobs.
- Rename jobs locally or via persisted title override.
- Retry failed jobs.
- Delete jobs.
- Preserve current `?job=` URL hydration behavior.

This can start as backend endpoints plus a compact frontend history panel.

### Error Diagnostics

Failures should use typed reasons and user-facing remediation copy:

- Expired RingCentral link.
- Missing or invalid authentication.
- Unsupported source.
- Download blocked.
- Transcript extraction failed.
- AI generation failed.

The UI should show the failure stage, plain-language explanation, and a suggested action. Raw exception details should stay out of the user-facing UI.

### Report Export

The export model should be built once and rendered to multiple formats:

- Markdown is required.
- PDF is required if local tooling is reliable.
- DOCX is preferred if local tooling is reliable.

The report should include:

- Video metadata.
- Download/source details.
- Summary layers.
- Transcript timeline.
- Mind map.
- Ask AI history.
- References and timestamps.
- Generation metadata such as job ID and export time.

## Frontend Design

### Video Info Panel

The left panel should evolve from static metadata into an asset hub:

- Thumbnail, title, source, duration, description, and tags.
- Download status and progress.
- Available formats/resolutions.
- Download buttons for video, audio, subtitles, and report assets when available.
- Diagnostic callouts when a source cannot be accessed.

### Status Timeline

The timeline should show major stages plus live progress:

- Metadata.
- Format planning.
- Download.
- Audio extraction.
- Transcript.
- Summary.
- Mind map.
- QA readiness.
- Export readiness.

Progress events should update without forcing a full job refresh when the event payload is sufficient.

### Transcript Tab

The transcript tab should support:

- Search.
- Timestamped segments.
- Newly streamed segment highlighting.
- Copy transcript.
- Jump targets from Ask AI references.
- Language display and translation controls from the existing translation foundation.

### Summary Tab

The summary tab should show:

- Live takeaways during streaming.
- Final abstract.
- Key points.
- Action items.
- Decisions.
- Risks or open questions.
- Citations or timestamp chips.

### Mind Map Tab

The mind map tab should render:

- Interactive tree when structured nodes exist.
- Text fallback when only preview text exists.
- Copy and export actions.
- Source reference chips for nodes when available.

### Ask AI Tab

The Ask AI tab should show:

- Suggested questions.
- Readiness state.
- Answer copy action.
- References under each answer.
- Transcript jump links when references have segment IDs.

### History and Reports

The homepage should add:

- A compact recent-job history surface.
- Rename, retry, delete, and reopen actions.
- Export report actions once required analysis content exists.
- Clear state when a reopened job is stale or unavailable.

## Data Compatibility

Existing job fields should remain valid so current tests and UI paths keep working. New structured fields should be additive:

- `download_progress_json`.
- `download_formats_json`.
- `transcript_source_segments_json` expanded with timestamps.
- `summary_structured_json`.
- `mindmap_nodes_json`.
- `qa_history_json` or dedicated answer records if needed.
- `diagnostics_json`.
- `report_exports_json`.

If migrations are needed, they should be backward compatible for existing local data.

## Milestones

### Milestone 1: Internal Source and Progress Foundation

Deliver:

- RingCentral recording URL handling and typed diagnostics.
- Download progress model, persistence, and SSE events.
- Frontend progress rendering and diagnostic callouts.
- Tests for connector behavior, job task transitions, SSE payloads, and UI progress display.

### Milestone 2: Structured AI Output

Deliver:

- Timestamped transcript timeline.
- Structured layered summary.
- Structured mind map model and interactive rendering.
- Ask AI references and transcript jump behavior.
- Tests for structured API shape, streaming updates, and UI rendering.

### Milestone 3: Assets, History, and Recovery

Deliver:

- Format and resolution choices.
- Asset download actions.
- Recent job history controls.
- Retry, rename, delete flows.
- Tests for API endpoints and UI controls.

### Milestone 4: Export and Screenshot Test Report

Deliver:

- Complete Markdown report export.
- PDF and DOCX exports when tooling is stable.
- Browser-driven screenshots of core flows.
- Final Markdown test report with screenshots, command outputs, and known limitations.

## Testing Strategy

Backend tests:

- Connector unit tests with fixture HTML/JSON and mocked HTTP responses.
- Download progress tests with mocked progress callbacks.
- Task orchestration tests for event order and persisted job fields.
- API route tests for history, retry, delete, rename, and exports.
- QA reference tests that prove answers include source references.

Frontend tests:

- React Testing Library tests for progress, diagnostics, transcript timeline, summary layers, mind map nodes, Ask AI references, history actions, and export controls.
- Existing tests must remain green.
- Browser smoke tests for homepage, submitted job, reopened job, and export-ready job.

Screenshot report:

- Store screenshots under `docs/reports/assets/`.
- Store final report under `docs/reports/2026-05-07-get-phase2-test-report.md`.
- Include at least homepage, active analysis, transcript timeline, Ask AI with references, history panel, diagnostic state, and export controls.

## Risks and Constraints

- Internal RingCentral recordings may require authenticated browser/session behavior that cannot be fully exercised in CI. The implementation should isolate this behind connector interfaces and fixtures.
- Real media downloads can be slow or network-dependent. Tests should mock shell execution and progress callbacks.
- PDF/DOCX export tooling may add dependency complexity. Markdown export is the guaranteed baseline; PDF/DOCX should be enabled only with reliable local commands.
- The existing `AITabs` component is already large. Phase 2 should split focused subcomponents as new structured UI grows.
- Sensitive RingCentral query tokens must not be logged, stored in reports, or shown in screenshots.

## Acceptance Criteria

- A RingCentral recording URL can be submitted through the existing input mode and progresses through metadata, download, transcript, summary, mind map, and QA readiness when fixtures or available credentials allow.
- Users can see download progress and diagnostics in the UI.
- Users can select available media formats or see a clear message when only one format is available.
- Transcript, summary, mind map, and Ask AI all preserve source references.
- Users can reopen, retry, rename, and delete jobs from history.
- Users can export a complete analysis report at least as Markdown.
- API and web automated tests pass.
- A screenshot-backed Markdown test report is committed.
