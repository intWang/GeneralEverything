# GeneralEveryThing

GeneralEveryThing (GET) is an AI video-intelligence workspace. The current product focus is video analysis: users submit a video URL, GET creates an analysis job, downloads/prepares the media, and presents video details, transcript, summary, mind map, grounded Ask AI, job history, and Markdown export in one workspace.

Phase 2 is implemented and validated. The app has a Next.js frontend, FastAPI backend, persistent job model, SSE-driven progress events, browser smoke coverage, CI, and a screenshot-backed validation report.

## Current Capabilities

- URL-first video analysis workspace with public video and RingCentral recording input modes.
- Video info panel with preview metadata, source details, download progress, format choices, artifact links, and diagnostics.
- AI output tabs for Summary, Transcript, Mind Map, and Ask AI.
- Timestamped transcript segments with copy/search/jump affordances.
- Structured summary sections with citations, decisions, risks, action items, and translation hooks.
- Structured mind map tree with source references.
- Ask AI answers with structured transcript/summary references.
- Recent job history with reopen, rename, retry, and delete controls.
- Markdown analysis report export.
- API, frontend unit tests, Playwright browser smoke test, and GitHub Actions CI.

## Repository Layout

```text
apps/api     FastAPI backend, SQLAlchemy models, Alembic migrations, pipeline services, pytest
apps/web     Next.js frontend, React components, Vitest tests, Playwright E2E smoke
docs         Product specs, implementation plans, status summaries, screenshot test report
infra        Local Postgres and Redis docker-compose services
```

Important docs:

- `docs/superpowers/status/2026-05-08-get-phase2-completion-summary.md`
- `docs/reports/2026-05-07-get-phase2-test-report.md`
- `docs/superpowers/specs/2026-05-07-get-phase2-video-analysis-design.md`
- `docs/superpowers/plans/2026-05-07-get-phase2-video-analysis-implementation.md`

## Prerequisites

- Python 3.12 or newer
- Node.js 20
- pnpm 10
- Docker and Docker Compose
- `yt-dlp` compatible environment for real media download paths
- Optional: OpenAI-compatible API key for translation/model-backed features

## Local Setup

Start infrastructure:

```bash
docker compose -f infra/docker-compose.yml up -d
```

Install backend dependencies:

```bash
cd apps/api
python -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -e .
```

Install frontend dependencies:

```bash
pnpm install
```

The API package includes a small `setup.py` shim so editable installs work on older pip/setuptools toolchains.

## Environment

Backend settings are loaded from `apps/api/.env` when present. Defaults are development-oriented:

```text
DATABASE_URL=postgresql+psycopg://get:get@localhost:5432/get
REDIS_URL=redis://localhost:6379/0
TRANSCRIPT_MODEL_NAME=small
TRANSCRIPT_DEVICE=auto
TRANSCRIPT_COMPUTE_TYPE=int8
TRANSCRIPT_BEAM_SIZE=5
TRANSCRIPT_ENABLE_VAD=true
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
TRANSLATION_MODEL=gpt-5-mini
RINGCENTRAL_COOKIE_FILE=
RINGCENTRAL_COOKIES_FROM_BROWSER=
```

Do not commit real RingCentral links, signed query parameters, cookies, tokens, or `.env` files.

## Run Locally

Run the API:

```bash
cd apps/api
source .venv/bin/activate
uvicorn app.main:app --reload
```

Run the web app:

```bash
pnpm dev:web
```

Default URLs:

- Web: `http://localhost:3000`
- API: `http://localhost:8000`
- API health: `http://localhost:8000/api/health`

## Verification

Run API tests:

```bash
cd apps/api
source .venv/bin/activate
pytest -q
```

Run web lint:

```bash
pnpm lint:web
```

Run web unit tests:

```bash
pnpm test:web
```

Run browser smoke tests:

```bash
pnpm test:e2e:web
```

If Playwright browsers are missing in a fresh environment:

```bash
pnpm --filter web exec playwright install --with-deps chromium
```

Current validated baseline:

- API: `125 passed`
- Web unit tests: `114 passed`
- Playwright browser smoke: `1 passed`

Known non-blocking warnings:

- Vite CJS Node API deprecation warning in Vitest.
- React `act(...)` warnings in existing homepage tests.
- Next lint warnings for selected hook dependencies and `<img>` usage.

## CI

GitHub Actions runs `.github/workflows/ci.yml` on `main`, `master`, `codex/**`, and pull requests.

CI checks:

- API tests on Python 3.12
- Web lint on Node 20 + pnpm 10
- Web Vitest suite
- Playwright Chromium browser smoke test

## RingCentral Recording Status

RingCentral recording URLs are detected, sanitized, persisted safely, queued into the analysis runner, and surfaced with safe diagnostics. Sensitive query parameters such as `code`, `token`, `access_token`, `auth`, and `jwt` are removed before storage/reporting.

The first authenticated RingCentral download PoC is available behind backend-only configuration:

- `RINGCENTRAL_COOKIE_FILE=/absolute/path/to/cookies.txt`
- `RINGCENTRAL_COOKIES_FROM_BROWSER=chrome`
- `RINGCENTRAL_COOKIES_FROM_BROWSER=chrome:Default`

GET passes that authentication context to `yt-dlp` with either `--cookies` or `--cookies-from-browser`. The cookie path/browser source is never returned by the API, stored on jobs, or included in reports. The API also exposes `/api/capabilities`, which tells the web app whether the RingCentral input mode is ready without exposing the configured cookie path or browser profile.

If neither setting is configured, the web app keeps the RingCentral Analyze button blocked with server-auth guidance, and any backend RingCentral job still fails safely with `ringcentral_auth_required` diagnostics. Runtime download failures are classified into safer, more actionable reasons including `ringcentral_session_expired`, `ringcentral_permission_denied`, `ringcentral_recording_unavailable`, `ringcentral_unsupported_page`, and the generic `ringcentral_download_failed` fallback. The video information panel renders these diagnostics with readable labels and next-step suggestions.

The API also provides `POST /api/ringcentral/probe` for dry-run access checks. It accepts a RingCentral recording URL, sanitizes sensitive query parameters, uses the configured server-side cookie/browser session with `yt-dlp --skip-download --dump-single-json`, and returns either lightweight metadata or a safe diagnostic without creating an analysis job.

Real company recording success still depends on the local machine/session having access to the recording in the configured browser or cookie file. The next milestone is to validate these classifications against real internal recordings and add automated session-refresh guidance.

## Current Limitations

- RingCentral authenticated media download is available as a server-configured PoC; it still needs production hardening and real-recording validation.
- Some AI outputs remain shell/fixture/rule-backed rather than fully model-backed.
- Production deployment packaging is not complete yet.
- Markdown export is supported; PDF/DOCX export is not implemented.
- Worker/process separation is still lightweight; local background tasks currently run through the API process.

## Recommended Next Work

1. Validate RingCentral diagnostics against real internal recordings and add guided session-refresh instructions.
2. Productionize streaming transcription with persisted partial segments.
3. Replace shell summary, mind map, and Ask AI output with model-backed provider interfaces.
4. Add a dedicated `/jobs/[id]` detail page.
5. Add Dockerfiles and production-ready web/api/worker deployment docs.
