# RingCentral Access Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a structured RingCentral access recovery panel that turns dry-run probe diagnostics into clear, safe next-step guidance.

**Architecture:** Keep the existing `/api/ringcentral/probe` backend contract unchanged. Add a pure frontend diagnostic mapper, a focused presentational component, and a small `AnalyzeForm` integration so probe success/failure rendering is testable without mixing recovery copy into form logic.

**Tech Stack:** Next.js, React, TypeScript, CSS modules, Vitest, Testing Library, existing FastAPI probe tests for backend safety regression coverage.

---

## File Structure

- Create `apps/web/lib/ringcentral-diagnostics.ts`: pure diagnostic-to-guidance mapping with no React dependency.
- Create `apps/web/components/ringcentral-access-guidance.tsx`: presentational component for success, failure, and request-error states.
- Modify `apps/web/components/analyze-form.tsx`: store the whole probe result/error state and render `RingCentralAccessGuidance`.
- Modify `apps/web/app/homepage.module.css`: add panel, checklist, and status styles.
- Modify `apps/web/tests/analyze-flow.test.tsx`: expand RingCentral probe coverage and prove dry-run behavior.
- Optionally modify `apps/web/lib/api.ts`: only if tests need probe metadata fields; do not change endpoint path or payload.

## Task 1: Diagnostic Mapping

**Files:**
- Create: `apps/web/lib/ringcentral-diagnostics.ts`
- Test: `apps/web/tests/analyze-flow.test.tsx`

- [ ] **Step 1: Write failing tests for recovery copy**

Add these tests to `apps/web/tests/analyze-flow.test.tsx` near the existing RingCentral probe tests:

```ts
test("shows server-auth setup guidance for RingCentral probe auth-required failures", async () => {
  const createJob = vi.mocked(api.createJob);
  const probeRingCentralAccess = vi.mocked(api.probeRingCentralAccess);

  probeRingCentralAccess.mockResolvedValue({
    diagnostic: {
      message: "RingCentral server authentication is not configured.",
      reason: "ringcentral_auth_required",
      suggestion: "Configure RingCentral cookies on the API server.",
    },
    input_mode: "ringcentral_recording",
    ok: false,
    source_url: "https://app.ringcentral.com/recording/private",
  });

  renderReadyRingCentralForm();

  fireEvent.change(screen.getByLabelText("Video source"), {
    target: { value: "https://app.ringcentral.com/recording/private?code=fixture" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Check access" }));

  expect(await screen.findByText("Server RingCentral auth is not configured")).toBeInTheDocument();
  expect(screen.getByText("Set RINGCENTRAL_COOKIE_FILE or RINGCENTRAL_COOKIES_FROM_BROWSER on the API server.")).toBeInTheDocument();
  expect(screen.getByText("Restart the API after changing RingCentral auth settings.")).toBeInTheDocument();
  expect(screen.queryByText(/code=fixture/)).not.toBeInTheDocument();
  expect(createJob).not.toHaveBeenCalled();
});

test("shows session refresh guidance for expired RingCentral probe sessions", async () => {
  const probeRingCentralAccess = vi.mocked(api.probeRingCentralAccess);

  probeRingCentralAccess.mockResolvedValue({
    diagnostic: {
      message: "The configured RingCentral session appears to be expired.",
      reason: "ringcentral_session_expired",
      suggestion: "Sign in again from the configured browser profile.",
    },
    input_mode: "ringcentral_recording",
    ok: false,
    source_url: "https://app.ringcentral.com/recording/private",
  });

  renderReadyRingCentralForm();

  fireEvent.change(screen.getByLabelText("Video source"), {
    target: { value: "https://app.ringcentral.com/recording/private" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Check access" }));

  expect(await screen.findByText("RingCentral session needs refresh")).toBeInTheDocument();
  expect(screen.getByText("Open RingCentral in the configured browser profile and sign in again.")).toBeInTheDocument();
  expect(screen.getByText("Retry Check access after the recording opens normally in that browser.")).toBeInTheDocument();
});

test("shows owner sharing guidance for RingCentral permission failures", async () => {
  const probeRingCentralAccess = vi.mocked(api.probeRingCentralAccess);

  probeRingCentralAccess.mockResolvedValue({
    diagnostic: {
      message: "The current RingCentral account cannot access this recording.",
      reason: "ringcentral_permission_denied",
      suggestion: "Ask the owner to share the recording.",
    },
    input_mode: "ringcentral_recording",
    ok: false,
    source_url: "https://app.ringcentral.com/recording/private",
  });

  renderReadyRingCentralForm();

  fireEvent.change(screen.getByLabelText("Video source"), {
    target: { value: "https://app.ringcentral.com/recording/private" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Check access" }));

  expect(await screen.findByText("Recording permission is blocked")).toBeInTheDocument();
  expect(screen.getByText("Ask the meeting owner to share the recording with the configured RingCentral account.")).toBeInTheDocument();
  expect(screen.getByText("Confirm the same account can play the recording in a normal browser tab.")).toBeInTheDocument();
});

test("falls back to safe generic RingCentral recovery guidance", async () => {
  const probeRingCentralAccess = vi.mocked(api.probeRingCentralAccess);

  probeRingCentralAccess.mockResolvedValue({
    diagnostic: {
      message: "The recording could not be checked.",
      reason: "ringcentral_future_reason",
      suggestion: "Try again later.",
    },
    input_mode: "ringcentral_recording",
    ok: false,
    source_url: "https://app.ringcentral.com/recording/private",
  });

  renderReadyRingCentralForm();

  fireEvent.change(screen.getByLabelText("Video source"), {
    target: { value: "https://app.ringcentral.com/recording/private" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Check access" }));

  expect(await screen.findByText("RingCentral access could not be confirmed")).toBeInTheDocument();
  expect(screen.getByText("Retry the access check once in case RingCentral returned a transient response.")).toBeInTheDocument();
  expect(screen.getByText("If it still fails, share the sanitized diagnostic reason with the GET maintainer.")).toBeInTheDocument();
});
```

Add this helper near the top of `apps/web/tests/analyze-flow.test.tsx` after `beforeEach`:

```ts
function renderReadyRingCentralForm() {
  return render(
    <AnalyzeForm
      inputMode="ringcentral_recording"
      ringCentralCapability={{
        auth_configured: true,
        auth_method: "browser_cookies",
        enabled: true,
        label: "RingCentral Recording URL",
        message: "RingCentral recording downloads can use configured browser cookies.",
        status: "ready",
        suggestion: "Paste an internal recording URL to start.",
      }}
    />,
  );
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
pnpm --filter web exec vitest run tests/analyze-flow.test.tsx
```

Expected: FAIL because the new guidance titles and checklist copy are not implemented.

- [ ] **Step 3: Implement the pure mapping helper**

Create `apps/web/lib/ringcentral-diagnostics.ts`:

```ts
export type RingCentralRecoverySeverity = "success" | "warning" | "error";

export type RingCentralRecoveryGuidance = {
  detail: string;
  severity: RingCentralRecoverySeverity;
  steps: string[];
  title: string;
};

const GENERIC_GUIDANCE: RingCentralRecoveryGuidance = {
  detail: "GET attempted a safe dry-run metadata check without creating an analysis job.",
  severity: "warning",
  steps: [
    "Retry the access check once in case RingCentral returned a transient response.",
    "Confirm the recording opens in a normal browser tab.",
    "If it still fails, share the sanitized diagnostic reason with the GET maintainer.",
  ],
  title: "RingCentral access could not be confirmed",
};

const GUIDANCE_BY_REASON: Record<string, RingCentralRecoveryGuidance> = {
  ringcentral_auth_required: {
    detail: "GET could not run the dry-run check because server-side RingCentral authentication is missing.",
    severity: "error",
    steps: [
      "Set RINGCENTRAL_COOKIE_FILE or RINGCENTRAL_COOKIES_FROM_BROWSER on the API server.",
      "Restart the API after changing RingCentral auth settings.",
      "Run Check access again before starting analysis.",
    ],
    title: "Server RingCentral auth is not configured",
  },
  ringcentral_session_expired: {
    detail: "GET reached RingCentral with the configured auth method, but the session no longer appears valid.",
    severity: "warning",
    steps: [
      "Open RingCentral in the configured browser profile and sign in again.",
      "Confirm the recording plays normally in that browser profile.",
      "Retry Check access after the recording opens normally in that browser.",
    ],
    title: "RingCentral session needs refresh",
  },
  ringcentral_permission_denied: {
    detail: "GET reached RingCentral, but the configured account does not appear to have access to this recording.",
    severity: "error",
    steps: [
      "Ask the meeting owner to share the recording with the configured RingCentral account.",
      "Confirm the same account can play the recording in a normal browser tab.",
      "Retry Check access after access is granted.",
    ],
    title: "Recording permission is blocked",
  },
  ringcentral_recording_unavailable: {
    detail: "RingCentral did not expose a playable recording during the dry-run check.",
    severity: "warning",
    steps: [
      "Confirm the recording has finished processing in RingCentral.",
      "Check whether the recording was deleted or expired.",
      "Copy the recording URL again from the browser and retry Check access.",
    ],
    title: "Recording is not available",
  },
  ringcentral_unsupported_page: {
    detail: "GET reached a RingCentral page shape that the current downloader cannot parse.",
    severity: "warning",
    steps: [
      "Open the recording with browser-view mode enabled.",
      "Copy the URL from the browser after the recording page fully loads.",
      "Retry Check access with that browser URL.",
    ],
    title: "Recording page is not supported yet",
  },
  ringcentral_download_failed: GENERIC_GUIDANCE,
};

export function getRingCentralRecoveryGuidance(reason?: string | null) {
  if (!reason) {
    return GENERIC_GUIDANCE;
  }

  return GUIDANCE_BY_REASON[reason] ?? GENERIC_GUIDANCE;
}

export const RINGCENTRAL_ACCESS_READY_GUIDANCE: RingCentralRecoveryGuidance = {
  detail: "GET completed a safe dry-run metadata check without creating an analysis job.",
  severity: "success",
  steps: [
    "Start analysis when you are ready.",
    "If analysis later fails, run Check access again to confirm the session is still valid.",
  ],
  title: "RingCentral access ready",
};
```

- [ ] **Step 4: Run mapping-related tests**

Run:

```bash
pnpm --filter web exec vitest run tests/analyze-flow.test.tsx
```

Expected: tests still FAIL because the UI does not render the helper yet.

- [ ] **Step 5: Commit Task 1 if only tests/helper changed cleanly**

If the failing tests and helper are isolated and intentional, commit them:

```bash
git add apps/web/tests/analyze-flow.test.tsx apps/web/lib/ringcentral-diagnostics.ts
git commit -m "test: specify ringcentral recovery guidance"
```

If the team prefers not to commit red tests, skip this commit and include these files in Task 2.

## Task 2: Guidance Component

**Files:**
- Create: `apps/web/components/ringcentral-access-guidance.tsx`
- Modify: `apps/web/app/homepage.module.css`
- Test: `apps/web/tests/analyze-flow.test.tsx`

- [ ] **Step 1: Create presentational component**

Create `apps/web/components/ringcentral-access-guidance.tsx`:

```tsx
import styles from "../app/homepage.module.css";
import {
  RINGCENTRAL_ACCESS_READY_GUIDANCE,
  getRingCentralRecoveryGuidance,
} from "../lib/ringcentral-diagnostics";
import type { RingCentralProbeDiagnostic } from "../lib/api";

type RingCentralAccessGuidanceProps = {
  diagnostic?: RingCentralProbeDiagnostic | null;
  errorMessage?: string | null;
  ok: boolean;
};

export function RingCentralAccessGuidance({
  diagnostic = null,
  errorMessage = null,
  ok,
}: RingCentralAccessGuidanceProps) {
  const guidance = ok
    ? RINGCENTRAL_ACCESS_READY_GUIDANCE
    : getRingCentralRecoveryGuidance(diagnostic?.reason);
  const diagnosticMessage =
    errorMessage ??
    diagnostic?.message ??
    (ok
      ? "RingCentral access ready. You can analyze this recording."
      : "RingCentral access could not be confirmed.");
  const diagnosticSuggestion = diagnostic?.suggestion;

  return (
    <section
      aria-live="polite"
      className={styles.probeGuidancePanel}
      data-severity={guidance.severity}
    >
      <div className={styles.probeGuidanceHeader}>
        <p className={styles.probeGuidanceEyebrow}>RingCentral access check</p>
        <h3 className={styles.probeGuidanceTitle}>{guidance.title}</h3>
      </div>
      <p className={styles.probeFeedbackMessage}>{diagnosticMessage}</p>
      {diagnosticSuggestion ? (
        <p className={styles.probeFeedbackSuggestion}>{diagnosticSuggestion}</p>
      ) : null}
      <p className={styles.probeGuidanceDetail}>{guidance.detail}</p>
      <ul className={styles.probeGuidanceSteps}>
        {guidance.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 2: Add styles**

Append these styles to `apps/web/app/homepage.module.css` near the existing probe styles:

```css
.probeGuidancePanel {
  border: 1px solid rgba(20, 36, 62, 0.14);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 18px 50px rgba(24, 41, 71, 0.08);
  display: grid;
  gap: 0.75rem;
  grid-column: 1 / -1;
  padding: 1rem;
}

.probeGuidancePanel[data-severity="success"] {
  border-color: rgba(39, 142, 96, 0.28);
  background: linear-gradient(135deg, rgba(238, 252, 245, 0.94), rgba(255, 255, 255, 0.82));
}

.probeGuidancePanel[data-severity="warning"] {
  border-color: rgba(201, 130, 25, 0.3);
  background: linear-gradient(135deg, rgba(255, 248, 232, 0.94), rgba(255, 255, 255, 0.82));
}

.probeGuidancePanel[data-severity="error"] {
  border-color: rgba(194, 65, 65, 0.3);
  background: linear-gradient(135deg, rgba(255, 241, 241, 0.94), rgba(255, 255, 255, 0.82));
}

.probeGuidanceHeader {
  display: grid;
  gap: 0.2rem;
}

.probeGuidanceEyebrow {
  color: var(--muted);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  margin: 0;
  text-transform: uppercase;
}

.probeGuidanceTitle {
  color: var(--ink);
  font-family: var(--font-display);
  font-size: 1.05rem;
  margin: 0;
}

.probeGuidanceDetail {
  color: var(--muted);
  font-size: 0.9rem;
  line-height: 1.5;
  margin: 0;
}

.probeGuidanceSteps {
  color: var(--ink);
  display: grid;
  gap: 0.45rem;
  margin: 0;
  padding-left: 1.1rem;
}

.probeGuidanceSteps li {
  line-height: 1.45;
}
```

- [ ] **Step 3: Run tests before integration**

Run:

```bash
pnpm --filter web exec vitest run tests/analyze-flow.test.tsx
```

Expected: tests still FAIL because `AnalyzeForm` does not render `RingCentralAccessGuidance` yet.

## Task 3: AnalyzeForm Integration

**Files:**
- Modify: `apps/web/components/analyze-form.tsx`
- Test: `apps/web/tests/analyze-flow.test.tsx`

- [ ] **Step 1: Update imports and state**

Modify `apps/web/components/analyze-form.tsx` imports:

```tsx
import {
  createJob,
  probeRingCentralAccess,
  type CreateJobResponse,
  type RingCentralProbeResponse,
} from "../lib/api";
import { RingCentralAccessGuidance } from "./ringcentral-access-guidance";
```

Replace the existing `accessFeedback` state with:

```tsx
const [accessCheck, setAccessCheck] = useState<{
  errorMessage?: string;
  result?: RingCentralProbeResponse;
} | null>(null);
```

- [ ] **Step 2: Update check handler**

In `handleCheckAccess`, replace all `setAccessFeedback(...)` calls with:

```tsx
setAccessCheck({
  result: {
    diagnostic: {
      message: "Paste a RingCentral recording URL to check access.",
      reason: "ringcentral_download_failed",
    },
    input_mode: "ringcentral_recording",
    ok: false,
    source_url: trimmedSourceUrl,
  },
});
```

for the empty URL branch, and:

```tsx
setAccessCheck({
  result: {
    diagnostic: {
      message: "RingCentral server authentication is required before checking access.",
      reason: "ringcentral_auth_required",
    },
    input_mode: "ringcentral_recording",
    ok: false,
    source_url: trimmedSourceUrl,
  },
});
```

for the blocked branch.

In the normal branch, replace success/failure message shaping with:

```tsx
const probe = await probeRingCentralAccess(trimmedSourceUrl);
setAccessCheck({ result: probe });
```

In the catch branch, use:

```tsx
setAccessCheck({
  errorMessage:
    error instanceof Error
      ? error.message
      : "RingCentral access could not be checked.",
  result: {
    diagnostic: {
      message: "RingCentral access could not be checked.",
      reason: "ringcentral_download_failed",
    },
    input_mode: "ringcentral_recording",
    ok: false,
    source_url: trimmedSourceUrl,
  },
});
```

At the start of the normal branch keep:

```tsx
setAccessCheck(null);
```

- [ ] **Step 3: Clear old guidance when URL changes**

Replace the input `onChange` body:

```tsx
onChange={(event) => {
  setSourceUrl(event.target.value);
  setAccessCheck(null);
}}
```

- [ ] **Step 4: Render the guidance component**

Replace the old `accessFeedback` rendering block with:

```tsx
{accessCheck?.result ? (
  <RingCentralAccessGuidance
    diagnostic={accessCheck.result.diagnostic}
    errorMessage={accessCheck.errorMessage}
    ok={accessCheck.result.ok}
  />
) : null}
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
pnpm --filter web exec vitest run tests/analyze-flow.test.tsx
```

Expected: PASS for all analyze-flow tests.

- [ ] **Step 6: Commit integration**

Run:

```bash
git add apps/web/components/analyze-form.tsx apps/web/components/ringcentral-access-guidance.tsx apps/web/app/homepage.module.css apps/web/lib/ringcentral-diagnostics.ts apps/web/tests/analyze-flow.test.tsx
git commit -m "feat: add ringcentral recovery guidance"
```

## Task 4: Regression Verification

**Files:**
- No production changes expected.
- Optional docs update: `README.md` if the user-facing behavior needs a short note.

- [ ] **Step 1: Run backend RingCentral regression tests**

Run:

```bash
cd apps/api && ./.venv-local/bin/python -m pytest tests/test_ringcentral_probe_route.py tests/test_ringcentral_download_service.py -q
```

Expected: all tests pass.

- [ ] **Step 2: Run full frontend unit tests**

Run:

```bash
pnpm test:web
```

Expected: all tests pass. Existing React `act(...)` warnings may still appear; do not treat them as new failures unless test counts change.

- [ ] **Step 3: Run lint**

Run:

```bash
pnpm lint:web
```

Expected: exit code 0. Existing warnings in unrelated files may remain.

- [ ] **Step 4: Run whitespace and sensitive-data checks**

Run:

```bash
git diff --check
rg -n --glob '!docs/superpowers/plans/2026-05-08-ringcentral-access-recovery-implementation.md' "WE1|71e7404e|[?&]access_token=[A-Za-z0-9_-]{16,}|[?&]token=[A-Za-z0-9_-]{16,}|[?&]jwt=[A-Za-z0-9_-]{16,}|[?&]code=[A-Za-z0-9_-]{16,}" README.md docs apps/api/app apps/api/tests apps/web || true
```

Expected: `git diff --check` exits 0 and the sensitive-data scan prints no real secret material. Existing short fixture strings such as `code=secret` are not treated as real secrets.

- [ ] **Step 5: Push after final commit**

Run:

```bash
git status --short
git push origin codex/get-phase1-foundation
```

Expected: working tree clean before push; push succeeds.

## Self-Review

- Spec coverage: The plan covers structured guidance rendering, diagnostic mapping, safety boundaries, dry-run behavior, and automated tests. Backend endpoint changes are intentionally absent because the spec requires no new backend contract.
- Placeholder scan: The plan contains no unfinished-work placeholders. Each code step includes concrete paths and snippets.
- Type consistency: `RingCentralProbeDiagnostic`, `RingCentralProbeResponse`, `getRingCentralRecoveryGuidance`, and `RingCentralAccessGuidance` names are consistent across tasks.
