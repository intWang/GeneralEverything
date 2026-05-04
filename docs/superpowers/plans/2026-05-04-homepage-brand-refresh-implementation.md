# Homepage Brand Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the homepage into a professional B2B marketing-style product page that explains the video transcription, summarization, and Q&A workflow while preserving the current analysis entry and results workspace.

**Architecture:** Keep the page as a single Next.js route, but split responsibilities between the page container, the hero, and new marketing sections. Drive the new layout with semantic section IDs, data-driven section content, and a larger CSS module refactor so the marketing narrative and real workspace can coexist on one page.

**Tech Stack:** Next.js App Router, React 18, TypeScript, CSS Modules, Vitest, Testing Library

---

## File Structure

Implementation units for this work:

- `apps/web/app/page.tsx` - homepage orchestration, section ordering, real job hydration flow, analysis/workspace placement
- `apps/web/components/hero.tsx` - hero copy, CTA links, hero preview shell
- `apps/web/components/homepage-sections.tsx` - marketing sections after the hero: trust band, capabilities, workflow, use cases, preview CTA
- `apps/web/app/homepage.module.css` - full visual system for the refreshed homepage
- `apps/web/tests/homepage.test.tsx` - primary homepage behavior and structure tests
- `apps/web/tests/homepage.spec.tsx` - smoke coverage for restored-job behavior after the layout changes
- `docs/superpowers/specs/2026-05-04-homepage-brand-refresh-design.md` - approved design source of truth

Keep the existing supporting components unchanged unless the implementation reveals a hard dependency:

- `apps/web/components/analyze-form.tsx`
- `apps/web/components/input-switcher.tsx`
- `apps/web/components/status-timeline.tsx`
- `apps/web/components/video-info-panel.tsx`
- `apps/web/components/ai-tabs.tsx`

## Task 1: Lock the New Homepage Narrative in Tests

**Files:**
- Modify: `apps/web/tests/homepage.test.tsx`
- Modify: `apps/web/tests/homepage.spec.tsx`
- Test: `apps/web/tests/homepage.test.tsx`
- Test: `apps/web/tests/homepage.spec.tsx`

- [ ] **Step 1: Add a failing structure test for the new hero and marketing sections**

```tsx
test("renders the product-led homepage sections before the analysis workspace", () => {
  render(<HomePage />);

  expect(
    screen.getByRole("heading", {
      name: "Turn recordings into transcripts, summaries, and answers.",
    }),
  ).toBeInTheDocument();
  expect(screen.getByText("Video analysis for teams")).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "Capabilities" }),
  ).toHaveAttribute("href", "#capabilities");
  expect(
    screen.getByRole("link", { name: "Workflow" }),
  ).toHaveAttribute("href", "#workflow");
  expect(
    screen.getByRole("link", { name: "Use Cases" }),
  ).toHaveAttribute("href", "#use-cases");
  expect(
    screen.getByRole("link", { name: "Preview" }),
  ).toHaveAttribute("href", "#preview");
  expect(screen.getByText("Built for recorded meetings")).toBeInTheDocument();
  expect(screen.getByText("Transcript")).toBeInTheDocument();
  expect(screen.getByText("Summary")).toBeInTheDocument();
  expect(screen.getByText("Ask AI")).toBeInTheDocument();
  expect(screen.getByText("Mind Map")).toBeInTheDocument();
  expect(screen.getByText("Meeting review")).toBeInTheDocument();
  expect(screen.getByText("Training recap")).toBeInTheDocument();
  expect(screen.getByText("Knowledge capture")).toBeInTheDocument();
});
```

- [ ] **Step 2: Add a failing test for CTA anchor targets and preserved analysis entry**

```tsx
test("keeps the analysis form on the page and points CTA links to in-page sections", () => {
  render(<HomePage />);

  expect(
    screen.getAllByRole("link", { name: "Start analysis" })[0],
  ).toHaveAttribute("href", "#analysis-entry");
  expect(
    screen.getByRole("link", { name: "See workflow" }),
  ).toHaveAttribute("href", "#workflow");
  expect(
    screen.getByRole("heading", { name: "Start analysis" }),
  ).toBeInTheDocument();
  expect(screen.getByLabelText("Video source")).toBeInTheDocument();
});
```

- [ ] **Step 3: Update the restored-job smoke test so it still proves the workspace survives the marketing refresh**

```tsx
test("smoke: restored jobs still render the refreshed homepage and Ask AI shell", async () => {
  vi.mocked(api.getJob).mockResolvedValue({
    created_at: "2026-05-04T15:00:00Z",
    id: "88888888-8888-8888-8888-888888888888",
    input_mode: "public_video",
    source_url: "https://example.com/smoke",
    stage: "building_mindmap",
    status: "completed",
  });
  vi.mocked(api.listJobs).mockResolvedValue([
    {
      created_at: "2026-05-04T15:00:00Z",
      id: "88888888-8888-8888-8888-888888888888",
      input_mode: "public_video",
      source_url: "https://example.com/smoke",
      stage: "building_mindmap",
      status: "completed",
    },
  ]);
  window.history.replaceState(
    {},
    "",
    "/?job=88888888-8888-8888-8888-888888888888",
  );

  render(<HomePage />);

  expect(
    screen.getByRole("heading", {
      name: "Turn recordings into transcripts, summaries, and answers.",
    }),
  ).toBeInTheDocument();

  await waitFor(() => {
    expect(
      screen.getByText(
        "Job 88888888-8888-8888-8888-888888888888 is completed for analysis.",
      ),
    ).toBeInTheDocument();
  });

  fireEvent.click(screen.getByRole("tab", { name: "Ask AI" }));

  expect(
    screen.getByText("Ask AI shell is ready for grounded follow-ups"),
  ).toBeInTheDocument();
});
```

- [ ] **Step 4: Run the homepage tests to verify they fail on the current implementation**

Run: `cd apps/web && pnpm vitest run tests/homepage.test.tsx tests/homepage.spec.tsx`

Expected: FAIL because the current homepage does not yet render the new marketing sections, anchor targets, or updated section heading.

- [ ] **Step 5: Commit**

```bash
git add apps/web/tests/homepage.test.tsx apps/web/tests/homepage.spec.tsx
git commit -m "test: define homepage brand refresh expectations"
```

## Task 2: Implement the New Homepage Structure and Marketing Sections

**Files:**
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/components/hero.tsx`
- Create: `apps/web/components/homepage-sections.tsx`
- Test: `apps/web/tests/homepage.test.tsx`

- [ ] **Step 1: Build the shared content model and presentational sections**

```tsx
// apps/web/components/homepage-sections.tsx
import styles from "../app/homepage.module.css";

const VALUE_POINTS = [
  "Built for recorded meetings",
  "Designed for training archives",
  "Structured for follow-up questions",
  "Ready for internal knowledge reuse",
];

const CAPABILITIES = [
  {
    title: "Transcript",
    description:
      "Capture searchable spoken content without replaying the full recording.",
  },
  {
    title: "Summary",
    description:
      "Turn long recordings into concise takeaways, actions, and highlights.",
  },
  {
    title: "Ask AI",
    description:
      "Follow up with targeted questions after the first review is done.",
  },
  {
    title: "Mind Map",
    description:
      "Give teams a faster structural view of what the recording covered.",
  },
];

const WORKFLOW_STEPS = [
  "Add a public video or recording source",
  "Extract metadata and transcript",
  "Generate summary and topic structure",
  "Ask follow-up questions in one workspace",
];

const USE_CASES = [
  {
    title: "Meeting review",
    description:
      "Revisit decisions, highlights, and unresolved questions without replaying the full call.",
  },
  {
    title: "Training recap",
    description:
      "Help teams absorb long training recordings faster and retain the important parts.",
  },
  {
    title: "Knowledge capture",
    description:
      "Turn one-off recordings into reusable internal references for future work.",
  },
];

export function HomepageSections() {
  return (
    <>
      <section className={styles.valueBand} aria-label="Product value">
        <div className={styles.sectionInner}>
          <ul className={styles.valueList}>
            {VALUE_POINTS.map((item) => (
              <li className={styles.valueItem} key={item}>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={styles.section} id="capabilities">
        <div className={styles.sectionInner}>
          <p className={styles.sectionEyebrow}>Capabilities</p>
          <h2 className={styles.sectionTitle}>Everything teams need after the recording ends.</h2>
          <div className={styles.cardGrid}>
            {CAPABILITIES.map((item) => (
              <article className={styles.featureCard} key={item.title}>
                <h3 className={styles.featureTitle}>{item.title}</h3>
                <p className={styles.featureDescription}>{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
```

- [ ] **Step 2: Replace the minimal hero with the approved two-column hero**

```tsx
// apps/web/components/hero.tsx
import styles from "../app/homepage.module.css";

export function Hero() {
  return (
    <section className={styles.hero}>
      <div className={styles.heroCopy}>
        <p className={styles.heroEyebrow}>Video analysis for teams</p>
        <h1 className={styles.heroTitle}>
          Turn recordings into transcripts, summaries, and answers.
        </h1>
        <p className={styles.heroDescription}>
          Review meetings, training sessions, and internal video content in a
          workspace designed for faster understanding and follow-up.
        </p>
        <div className={styles.heroActions}>
          <a className={styles.primaryButton} href="#analysis-entry">
            Start analysis
          </a>
          <a className={styles.secondaryButton} href="#workflow">
            See workflow
          </a>
        </div>
        <ul className={styles.heroChips} aria-label="Product highlights">
          <li className={styles.heroChip}>Transcript-first</li>
          <li className={styles.heroChip}>Summary-ready</li>
          <li className={styles.heroChip}>Ask AI follow-up</li>
        </ul>
      </div>

      <div className={styles.heroPreview} aria-label="Product preview">
        <div className={styles.previewShell}>
          <div className={styles.previewHeader}>
            <span className={styles.previewStatus}>Ready for review</span>
            <span className={styles.previewMeta}>Meeting recording</span>
          </div>
          <h2 className={styles.previewTitle}>Weekly enablement sync</h2>
          <div className={styles.previewPanel}>
            <h3 className={styles.previewPanelTitle}>Summary</h3>
            <p className={styles.previewPanelBody}>
              Action items, highlights, and key decisions are grouped into one readable recap.
            </p>
          </div>
          <div className={styles.previewGrid}>
            <div className={styles.previewPanel}>
              <h3 className={styles.previewPanelTitle}>Transcript</h3>
              <p className={styles.previewPanelBody}>
                Searchable excerpts help teams revisit the exact moment a decision was made.
              </p>
            </div>
            <div className={styles.previewPanel}>
              <h3 className={styles.previewPanelTitle}>Ask AI</h3>
              <p className={styles.previewPanelBody}>
                Follow up with grounded questions after the first review is complete.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Recompose `page.tsx` so the marketing narrative wraps the existing workflow**

```tsx
// apps/web/app/page.tsx
import { HomepageSections } from "../components/homepage-sections";

return (
  <main className={styles.page}>
    <header className={styles.topBar}>
      <div className={styles.topBarInner}>
        <a className={styles.brand} href="#top">
          GET Video AI
        </a>
        <nav aria-label="Homepage sections" className={styles.topNav}>
          <a href="#capabilities">Capabilities</a>
          <a href="#workflow">Workflow</a>
          <a href="#use-cases">Use Cases</a>
          <a href="#preview">Preview</a>
        </nav>
        <a className={styles.topBarCta} href="#analysis-entry">
          Start analysis
        </a>
      </div>
    </header>

    <section className={styles.heroSection} id="top">
      <div className={styles.contentShell}>
        <Hero />
      </div>
    </section>

    <HomepageSections />

    <section className={styles.analysisSection} id="analysis-entry">
      <div className={styles.contentShell}>
        <div className={styles.analysisIntro}>
          <p className={styles.sectionEyebrow}>Start analysis</p>
          <h2 className={styles.sectionTitle}>
            Start with a recording. Leave with searchable answers.
          </h2>
          <p className={styles.sectionDescription}>
            Add a source, generate the first pass of understanding, and keep the
            transcript, summary, and follow-up questions in one workspace.
          </p>
        </div>
        <InputSwitcher onChange={setInputMode} value={inputMode} />
        <div className={styles.workflowLayout}>
          {/* existing analyze form, recent jobs, and conditional workspace blocks stay here */}
        </div>
      </div>
    </section>
  </main>
);
```

- [ ] **Step 4: Run the focused homepage tests to verify the structure now passes**

Run: `cd apps/web && pnpm vitest run tests/homepage.test.tsx tests/homepage.spec.tsx`

Expected: PASS for the new marketing section assertions and the restored-job smoke coverage.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/page.tsx apps/web/components/hero.tsx apps/web/components/homepage-sections.tsx
git commit -m "feat: add homepage marketing structure"
```

## Task 3: Refactor Homepage Styling to Match the Approved Enterprise Visual Direction

**Files:**
- Modify: `apps/web/app/homepage.module.css`
- Modify: `apps/web/app/page.tsx`
- Test: `apps/web/tests/homepage.test.tsx`

- [ ] **Step 1: Replace the current minimal page styles with section, navigation, and card systems**

```css
.page {
  min-height: 100vh;
  background:
    linear-gradient(180deg, #f8fbff 0%, #ffffff 18%, #ffffff 100%);
  color: #0f172a;
}

.topBar {
  position: sticky;
  top: 0;
  z-index: 20;
  backdrop-filter: blur(12px);
  background: rgba(255, 255, 255, 0.9);
  border-bottom: 1px solid rgba(148, 163, 184, 0.16);
}

.topBarInner {
  max-width: 76rem;
  margin: 0 auto;
  padding: 1rem 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.hero {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(18rem, 0.85fr);
  gap: 2rem;
  align-items: center;
  padding: 5rem 0 3rem;
}

.featureCard,
.previewPanel,
.panel,
.formCard,
.switcher,
.historyButton {
  border: 1px solid #dbe4f0;
  border-radius: 1.25rem;
  background: #ffffff;
  box-shadow: 0 18px 50px -34px rgba(15, 23, 42, 0.28);
}

.cardGrid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

@media (max-width: 900px) {
  .hero,
  .workflowLayout,
  .topBarInner {
    grid-template-columns: 1fr;
  }

  .cardGrid {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 2: Move the recent-jobs inline styles into CSS module classes**

```tsx
<ul className={styles.historyList}>
  {jobHistory.map((job) => (
    <li key={job.id}>
      <button
        aria-pressed={jobState?.id === job.id}
        className={styles.historyButton}
        onClick={() => handleHistorySelection(job.id)}
        type="button"
      >
        <span>{job.title || job.source_url}</span>
        <span className={styles.historyMeta}>{job.source_url}</span>
        <span className={styles.historyMeta}>
          {job.status} • {job.stage}
        </span>
      </button>
    </li>
  ))}
</ul>
```

- [ ] **Step 3: Add the remaining styles for the analysis transition and marketing sections**

```css
.analysisSection {
  padding: 1rem 0 5rem;
}

.analysisIntro {
  max-width: 44rem;
  margin-bottom: 1.5rem;
}

.sectionEyebrow {
  margin: 0 0 0.75rem;
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #2563eb;
}

.sectionTitle {
  margin: 0;
  font-size: clamp(2rem, 4vw, 3rem);
  line-height: 1.08;
}

.sectionDescription,
.heroDescription,
.featureDescription,
.workspaceDescription,
.historyMeta {
  color: #475569;
}
```

- [ ] **Step 4: Run the homepage tests after the CSS refactor**

Run: `cd apps/web && pnpm vitest run tests/homepage.test.tsx tests/homepage.spec.tsx`

Expected: PASS with no selector or accessibility regressions caused by the markup/class changes.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/homepage.module.css apps/web/app/page.tsx
git commit -m "feat: restyle homepage for enterprise marketing layout"
```

## Task 4: Restore Analysis and Recent Job Behavior Inside the New Layout

**Files:**
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/tests/homepage.test.tsx`
- Test: `apps/web/tests/homepage.test.tsx`

- [ ] **Step 1: Add a failing regression test for job creation and in-page workspace continuity**

```tsx
test("reveals the refreshed workspace area after creating a job", async () => {
  const createJob = vi.mocked(api.createJob);
  const getJob = vi.mocked(api.getJob);
  const listJobs = vi.mocked(api.listJobs);

  createJob.mockResolvedValue({
    created_at: "2026-05-04T09:00:00Z",
    id: "11111111-1111-1111-1111-111111111111",
    input_mode: "public_video",
    source_url: "https://example.com/video",
    stage: "queued",
    status: "queued",
  });
  getJob.mockResolvedValue({
    created_at: "2026-05-04T09:00:00Z",
    id: "11111111-1111-1111-1111-111111111111",
    input_mode: "public_video",
    source_url: "https://example.com/video",
    stage: "queued",
    status: "queued",
  });
  listJobs
    .mockResolvedValueOnce([])
    .mockResolvedValue([
      {
        created_at: "2026-05-04T09:00:00Z",
        id: "11111111-1111-1111-1111-111111111111",
        input_mode: "public_video",
        source_url: "https://example.com/video",
        stage: "queued",
        status: "queued",
      },
    ]);

  render(<HomePage />);

  fireEvent.change(screen.getByLabelText("Video source"), {
    target: { value: "https://example.com/video" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Analyze" }));

  await waitFor(() => {
    expect(screen.getByRole("heading", { name: "AI output" })).toBeInTheDocument();
  });

  expect(screen.getByRole("heading", { name: "Recent jobs" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /https:\/\/example.com\/video/i })).toBeInTheDocument();
  expect(
    screen.getByText(
      "Job 11111111-1111-1111-1111-111111111111 is queued for analysis.",
    ),
  ).toBeInTheDocument();
});
```

- [ ] **Step 2: Keep the real workspace conditional blocks inside the new `analysis-entry` section**

```tsx
<section className={styles.analysisSection} id="analysis-entry">
  <div className={styles.contentShell}>
    <div className={styles.analysisShell}>
      <div className={styles.workflowSidebar}>
        <AnalyzeForm inputMode={inputMode} onJobCreated={handleJobCreated} />
        <section aria-label="Recent jobs" className={styles.panel}>
          <h2 className={styles.panelTitle}>Recent jobs</h2>
          {jobHistory.length > 0 ? (
            <ul className={styles.historyList}>
              {/* mapped recent jobs */}
            </ul>
          ) : (
            <p className={styles.workspaceDescription}>
              Completed and in-flight jobs will appear here once created.
            </p>
          )}
        </section>
      </div>

      {jobState ? (
        <div className={styles.workflowPanels}>
          {loadError ? <p className={styles.formFeedback}>{loadError}</p> : null}
          <StatusTimeline items={buildTimelineItems(jobState)} />
          <VideoInfoPanel {...videoInfoProps} />
          <AITabs {...aiTabProps} />
        </div>
      ) : (
        <section aria-label="Analysis workspace" className={styles.panel}>
          <h2 className={styles.panelTitle}>Analysis workspace</h2>
          <p className={styles.workspaceDescription}>
            {isHydrating
              ? "Loading saved analysis shell..."
              : "Start an analysis to unlock status, video info, transcript, summary, mind map, and Ask AI panels."}
          </p>
          {loadError ? <p className={styles.formFeedback}>{loadError}</p> : null}
        </section>
      )}
    </div>
  </div>
</section>
```

- [ ] **Step 3: Re-run the homepage tests to ensure the refreshed layout still supports live job behavior**

Run: `cd apps/web && pnpm vitest run tests/homepage.test.tsx tests/homepage.spec.tsx`

Expected: PASS, including job creation, restored-job smoke behavior, and recent-jobs coverage.

- [ ] **Step 4: Run the broader web test suite for related homepage regressions**

Run: `cd apps/web && pnpm vitest run tests/result-tabs.test.tsx tests/video-info-panel.test.tsx`

Expected: PASS, confirming the homepage integration did not break downstream UI components.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/page.tsx apps/web/tests/homepage.test.tsx
git commit -m "feat: preserve analysis workflow in refreshed homepage"
```

## Task 5: Final Verification and Cleanup

**Files:**
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/components/hero.tsx`
- Modify: `apps/web/components/homepage-sections.tsx`
- Modify: `apps/web/app/homepage.module.css`
- Modify: `apps/web/tests/homepage.test.tsx`
- Modify: `apps/web/tests/homepage.spec.tsx`

- [ ] **Step 1: Remove any dead imports, duplicated copy, or unused style hooks discovered during implementation**

```tsx
// Example cleanup target in apps/web/app/page.tsx
import { Hero } from "../components/hero";
import { HomepageSections } from "../components/homepage-sections";

// Remove any no-longer-used inline style objects or obsolete helper markup
```

- [ ] **Step 2: Run the targeted homepage tests one final time**

Run: `cd apps/web && pnpm vitest run tests/homepage.test.tsx tests/homepage.spec.tsx`

Expected: PASS

- [ ] **Step 3: Run the full web test suite**

Run: `cd apps/web && pnpm vitest run`

Expected: PASS across the existing homepage, Ask AI, result tabs, and video info coverage.

- [ ] **Step 4: Manually smoke the page in the browser**

Run: `cd apps/web && pnpm dev`

Expected:
- the sticky header stays readable
- hero CTA links jump to the right section
- marketing sections read clearly on desktop and mobile widths
- analysis form still submits
- a restored `?job=` URL still lands on the same page with workspace data visible

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/page.tsx apps/web/components/hero.tsx apps/web/components/homepage-sections.tsx apps/web/app/homepage.module.css apps/web/tests/homepage.test.tsx apps/web/tests/homepage.spec.tsx
git commit -m "feat: complete homepage brand refresh"
```
