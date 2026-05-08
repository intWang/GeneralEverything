# RingCentral Access Recovery Design

## Goal

Turn the new RingCentral dry-run probe into a guided recovery experience. When a user checks access to an internal recording and GET cannot reach it, the product should explain what failed, what is safe to try next, and whether the user can continue to analysis.

This keeps the Phase 2 RingCentral path honest: GET should not pretend every company recording is universally downloadable, but it should make the next step obvious when auth, permission, expiration, or page-shape issues block access.

## Scope

This design covers one focused increment:

1. Render probe success and failure states as a structured RingCentral access guidance panel.
2. Map backend diagnostic reasons to user-facing recovery checklists.
3. Preserve the current safety boundary: the browser never receives cookie paths, browser profile names, raw signed query parameters, tokens, or stack traces.
4. Add tests that prove the probe remains a dry-run and that each important failure family shows useful next-step guidance.

Out of scope:

- Automatically refreshing RingCentral sessions.
- Uploading or storing user cookies from the browser.
- Rewriting the download executor.
- Adding new AI output behavior.
- Building a full settings page for admin configuration.

## Recommended Approach

Use an additive frontend-first recovery layer on top of the existing `/api/ringcentral/probe` response.

The backend already returns safe `DownloadDiagnostic` values. The frontend should convert those diagnostics into a small, consistent panel with:

- A status heading.
- A plain-language explanation.
- A short checklist of recovery steps.
- A "what GET checked" detail line.
- A safe retry action.

This is preferable to adding more backend fields now because the existing diagnostic model is already shared by download failures, analysis failures, and the dry-run probe. Keeping the first recovery layer in the web app avoids API churn while still improving the user's path through the product.

## User Experience

The RingCentral input flow keeps the current URL-first layout.

When RingCentral server auth is configured and the user enters a RingCentral URL, the form shows `Check access`.

On success:

- The panel confirms GET can access the recording.
- If metadata is available, it may mention the title and duration later, but the first increment can keep the current ready message.
- The primary `Analyze` button remains the action that creates a job.

On failure:

- The panel shows a diagnostic heading such as "Session needs refresh" or "Recording permission blocked".
- The panel shows 2-4 checklist steps tailored to the failure reason.
- The panel keeps `Analyze` blocked if capabilities already say RingCentral is not ready.
- If capabilities say RingCentral is ready but the specific recording fails, `Analyze` can remain available only if the existing product flow allows it; the panel must still warn that the job may fail until the issue is fixed.

The copy should be calm and operational, not scary. The user should feel like GET is helping them debug an internal tool, not blaming them for auth complexity.

## Diagnostic Mapping

The first mapping should cover these reasons:

- `ringcentral_auth_required`: Server-side RingCentral auth is not configured. Ask the operator to set `RINGCENTRAL_COOKIE_FILE` or `RINGCENTRAL_COOKIES_FROM_BROWSER`, then restart the API.
- `ringcentral_session_expired`: The configured browser/cookie session likely expired. Ask the user/operator to open RingCentral in that browser profile, sign in again, and retry the probe.
- `ringcentral_permission_denied`: The current account can reach RingCentral but cannot access this recording. Ask the owner to share the recording or confirm the signed link still grants access.
- `ringcentral_recording_unavailable`: The recording may have expired, been deleted, or not finished processing. Ask the user to confirm the recording opens in a normal browser.
- `ringcentral_unsupported_page`: GET reached a page shape that `yt-dlp` does not understand. Ask the user to open the recording in browser-view mode and retry with the copied browser URL.
- `ringcentral_download_failed`: Generic fallback. Ask the user to retry once, then collect the sanitized URL and diagnostic reason for investigation.

Unknown reasons should use the generic fallback and never render raw backend exception text beyond the already sanitized diagnostic message.

## Component Design

Add a focused frontend helper rather than embedding all copy directly inside `AnalyzeForm`.

Proposed units:

- `components/ringcentral-access-guidance.tsx`
- `lib/ringcentral-diagnostics.ts`

`lib/ringcentral-diagnostics.ts` should expose a pure function:

```ts
getRingCentralRecoveryGuidance(reason?: string): {
  title: string;
  severity: "success" | "warning" | "error";
  steps: string[];
  detail: string;
}
```

`RingCentralAccessGuidance` should render the current probe result and the mapped guidance. It should be presentational and easy to test.

`AnalyzeForm` should keep ownership of:

- URL input.
- Probe button loading state.
- Calling `probeRingCentralAccess`.
- Calling `createJob` only when the user clicks `Analyze`.

## Backend Design

No new backend endpoint is required for this increment.

The existing `POST /api/ringcentral/probe` contract remains:

- It sanitizes sensitive query parameters.
- It returns `ok=true` with lightweight metadata when access works.
- It returns `ok=false` with a safe diagnostic when access fails.
- It does not create a job.
- It does not download the recording.

Backend work should be limited to small type or fixture improvements only if frontend tests expose a gap in the current response shape.

## Error Handling And Safety

The panel must never display:

- Raw submitted signed URLs with `code`, `token`, `access_token`, `auth`, or `jwt`.
- Cookie file paths.
- Browser profile names.
- Raw stderr from `yt-dlp`.
- Python stack traces.

The panel may display:

- Sanitized diagnostic reason.
- Sanitized diagnostic message.
- Sanitized suggestion.
- A general explanation of what GET attempted.

If the probe request itself fails due to network/API errors, the UI should show a generic "Access check could not complete" message and keep the URL input intact.

## Testing

Frontend tests should cover:

- Probe success shows the ready state and does not call `createJob`.
- `ringcentral_auth_required` shows server-auth setup guidance.
- `ringcentral_session_expired` shows sign-in/session refresh guidance.
- `ringcentral_permission_denied` shows owner/share guidance.
- Generic or unknown failure falls back to safe retry/investigation guidance.
- Changing the URL clears old probe guidance.

Backend tests from the previous probe increment already cover:

- Probe route rejects non-RingCentral URLs.
- Probe route does not create jobs.
- Probe route returns sanitized source URLs.
- Probe route returns safe diagnostics.

Run at minimum:

```bash
cd apps/api && ./.venv-local/bin/python -m pytest tests/test_ringcentral_probe_route.py tests/test_ringcentral_download_service.py -q
pnpm --filter web exec vitest run tests/analyze-flow.test.tsx
pnpm test:web
pnpm lint:web
```

## Success Criteria

The increment is complete when:

- RingCentral probe failures show specific recovery steps for the main diagnostic reasons.
- The dry-run access check still never creates an analysis job.
- Existing RingCentral success behavior remains intact.
- Automated tests cover the diagnostic mapping and UI rendering.
- No sensitive RingCentral URL/query/auth material appears in docs, tests, snapshots, or rendered copy.
