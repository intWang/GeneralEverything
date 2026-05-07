# GET Phase 2 Screenshot Test Report

Report date: 2026-05-07  
Validated commit: `b615326`  
Scope: Phase 2 video-analysis implementation, including internal recording support foundations, progress/diagnostics, structured AI output, history controls, Markdown export, and browser smoke screenshots.

## Summary

Phase 2 automated validation passed for both backend and frontend suites. Browser smoke screenshots were captured from the local Next.js app with sanitized fixture-backed API responses so the report can show the full user workflow without exposing internal RingCentral recording tokens or session material.

## Verification Commands

### Backend API

Command:

```bash
cd apps/api
./.venv-local/bin/python -m pytest -q
```

Result:

```text
125 passed in 14.13s
```

### Web UI

Command:

```bash
cd apps/web
/usr/bin/env PATH=/Users/ace.wang/.local/runtime/node20/bin:/usr/bin:/bin:/usr/sbin:/sbin ../../node_modules/.pnpm/node_modules/.bin/vitest run
```

Result:

```text
Test Files  6 passed (6)
Tests       114 passed (114)
Duration    7.25s
```

Observed non-blocking warnings:

- Vite reports the CJS Node API deprecation warning.
- Existing homepage tests emit React `act(...)` warnings while still passing.

## Browser Screenshots

Screenshots were captured against `http://localhost:3020` using Playwright and mocked local API fixtures. All fixture URLs use `recording.example.internal` and contain no real RingCentral query parameters, auth codes, or signed tokens.

| Flow | Screenshot |
| --- | --- |
| Homepage URL-first entry | [phase2-homepage.png](assets/phase2-homepage.png) |
| Active analysis workspace | [phase2-active-analysis.png](assets/phase2-active-analysis.png) |
| Progress, formats, and diagnostics | [phase2-progress-diagnostics.png](assets/phase2-progress-diagnostics.png) |
| Transcript timeline | [phase2-transcript-timeline.png](assets/phase2-transcript-timeline.png) |
| Ask AI answer with references | [phase2-ask-ai-references.png](assets/phase2-ask-ai-references.png) |
| Recent job history controls | [phase2-history-panel.png](assets/phase2-history-panel.png) |
| Markdown export controls | [phase2-export-controls.png](assets/phase2-export-controls.png) |

## Feature Checklist

- RingCentral source foundation: implemented through normalized internal recording handling, safe metadata/probe diagnostics, and UI source mode support.
- Download progress and diagnostics: persisted on jobs, streamed through SSE/API, and rendered with progress percent, asset formats, download links, and recovery suggestions.
- Transcript timeline: structured transcript segments render with timestamps, search, copy, live-progress affordances, and Ask AI jump targets.
- Summary output: layered summary data supports source text, bullets, structured summary fields, citations, translations, copy, preview, and bundle download.
- Mind map output: structured tree nodes and references render in the AI workspace with readiness state.
- Ask AI references: grounded answers include structured references and transcript jump actions.
- History controls: recent jobs can be reopened, renamed, retried, and deleted from the workspace.
- Export: Markdown report export is available from the results workspace and includes backend-rendered analysis content.
- Automated tests: API pytest and web Vitest suites are passing.
- Screenshot report: committed screenshots cover homepage, active analysis, diagnostics/progress, transcript, Ask AI, history, and export controls.

## Known Limitations

- Real RingCentral authenticated playback was not exercised in this report. Internal recordings can require browser/session credentials, so this validation uses sanitized fixtures and connector-level tests rather than a real company recording URL.
- Browser screenshots are fixture-backed to avoid leaking sensitive RingCentral `code`, auth, session, or signed URL query parameters.
- Real media download speed and streaming behavior remain network-dependent in production-like environments; automated tests mock shell execution and progress callbacks.
- Markdown export is the guaranteed Phase 2 export baseline. PDF/DOCX export remains intentionally out of scope until local tooling is reliable.
- The web suite passes with existing React `act(...)` warnings in homepage tests; these warnings do not currently block the validated behavior.

## Evidence Assets

All screenshots are stored under `docs/reports/assets/`:

- `phase2-homepage.png`
- `phase2-active-analysis.png`
- `phase2-progress-diagnostics.png`
- `phase2-transcript-timeline.png`
- `phase2-ask-ai-references.png`
- `phase2-history-panel.png`
- `phase2-export-controls.png`
