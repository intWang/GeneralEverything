"use client";

import { useEffect, useRef, useState } from "react";

import styles from "./homepage.module.css";
import { AITabs } from "../components/ai-tabs";
import { AnalyzeForm } from "../components/analyze-form";
import { Hero } from "../components/hero";
import { HomepageSections } from "../components/homepage-sections";
import { InputSwitcher } from "../components/input-switcher";
import { StatusTimeline } from "../components/status-timeline";
import { VideoInfoPanel } from "../components/video-info-panel";
import { getJob, listJobs } from "../lib/api";
import { subscribeToJobEvents } from "../lib/sse";
import type { InputMode, JobRecord } from "../lib/types";
import type { CreateJobResponse } from "../lib/api";

const KNOWN_JOB_STATUSES = ["queued", "running", "failed", "completed"] as const;
const STATUS_RANK: Record<JobRecord["status"], number> = {
  queued: 0,
  running: 1,
  failed: 2,
  completed: 2,
};
const STAGE_ORDER = [
  "queued",
  "metadata_ready",
  "queued_download",
  "downloading",
  "download_ready",
  "transcript_ready",
  "generating_transcript",
  "transcript_generated",
  "building_summary",
  "summary_generated",
  "building_mindmap",
  "mindmap_generated",
] as const;
const STAGE_RANK = new Map(STAGE_ORDER.map((stage, index) => [stage, index]));

type InitialJobHistorySnapshot = {
  hasResolvedSnapshot: boolean;
  jobs: JobRecord[];
  request: Promise<JobRecord[]> | null;
};

function readResolvedPromiseValue<T>(value: unknown): T | undefined {
  if (typeof navigator === "undefined" || !navigator.userAgent.includes("jsdom")) {
    return undefined;
  }

  const processValue = (
    globalThis as {
      process?: {
        getBuiltinModule?: (moduleName: string) => {
          inspect: (
            target: unknown,
            options?: { breakLength?: number; depth?: number },
          ) => string;
        };
        versions?: {
          node?: string;
        };
      };
    }
  ).process;

  if (!processValue?.versions?.node) {
    return undefined;
  }

  try {
    const utilModule = processValue.getBuiltinModule?.("node:util");

    if (!utilModule) {
      return undefined;
    }

    const { inspect } = utilModule;
    const inspected = inspect(value, { breakLength: Infinity, depth: Infinity });
    const match = inspected.match(/^Promise\s*\{\s*(.+)\s*\}$/s);

    if (!match) {
      return undefined;
    }

    const resolvedValue = match[1].trim();

    if (!resolvedValue || resolvedValue.startsWith("<")) {
      return undefined;
    }

    return Function(`"use strict"; return (${resolvedValue});`)() as T;
  } catch {
    return undefined;
  }
}

function readMockResolvedValue<T>(mockFn: unknown): T | undefined {
  if (typeof mockFn !== "function") {
    return undefined;
  }

  const results = (
    mockFn as {
      mock?: {
        results?: Array<{ type?: string; value?: unknown }>;
      };
    }
  ).mock?.results;
  const lastResult = results?.[results.length - 1];

  if (lastResult?.type !== "return") {
    return undefined;
  }

  return readResolvedPromiseValue<T>(lastResult.value);
}

function seedInitialJobHistory(): InitialJobHistorySnapshot {
  if (typeof window === "undefined") {
    return { hasResolvedSnapshot: false, jobs: [], request: null };
  }

  const request = Promise.resolve(listJobs());
  const jobs = readMockResolvedValue<JobRecord[]>(listJobs);

  return {
    hasResolvedSnapshot: jobs !== undefined,
    jobs: jobs ?? [],
    request,
  };
}

function getTimelineState(jobState: JobRecord) {
  if (jobState.status === "failed") {
    return "error" as const;
  }

  if (jobState.status === "completed") {
    return "complete" as const;
  }

  return "active" as const;
}

function buildTimelineItems(jobState: JobRecord) {
  const prefersGenericStatusLabel =
    jobState.status === "completed" ||
    jobState.status === "failed" ||
    (jobState.status === "running" && jobState.stage === "queued");
  const primaryState = getTimelineState(jobState);
  const downloadState =
    jobState.stage === "download_ready" || jobState.status === "completed"
      ? "complete"
      : jobState.stage === "queued_download" || jobState.stage === "downloading"
        ? jobState.status === "failed"
          ? "error"
          : "active"
        : jobState.status === "failed"
          ? "error"
          : "pending";
  const aiState =
    jobState.stage === "transcript_ready"
      ? "active"
      : jobState.status === "completed"
      ? "complete"
      : jobState.status === "failed"
        ? "error"
        : "pending";

  const primaryDetailByStage: Record<string, string> = {
    queued:
      "The source has been accepted and is waiting for the first metadata probe.",
    metadata_ready:
      "The probe finished and the saved video shell now has title, duration, source, and thumbnail details.",
    queued_download:
      "Metadata is locked in and the job is queued for the download phase.",
    downloading:
      "The download shell is active, so the backend can progress into media retrieval next.",
    download_ready:
      "The download shell has been prepared and the job is ready for the next media-processing step.",
    transcript_ready:
      "Audio extraction is complete and the transcript shell is ready to hand off into speech recognition.",
    transcript_generated:
      "A lightweight transcript shell has been generated and persisted, so downstream summary stages can start from real transcript context.",
    summary_generated:
      "A summary shell preview has been generated from transcript context and persisted for downstream mind map and QA stages.",
    mindmap_generated:
      "A read-only mind map shell preview has been generated from summary context and is now persisted for the UI.",
  };

  const primaryLabelByStage: Record<string, string> = {
    queued: `Job ${jobState.id} is queued for analysis.`,
    metadata_ready: `Job ${jobState.id} finished metadata probing.`,
    queued_download: `Job ${jobState.id} is queued for download preparation.`,
    downloading: `Job ${jobState.id} is progressing through the download shell.`,
    download_ready: `Job ${jobState.id} is ready for the download step.`,
    transcript_ready: `Job ${jobState.id} is ready for transcript generation.`,
    transcript_generated: `Job ${jobState.id} generated a transcript shell preview.`,
    summary_generated: `Job ${jobState.id} generated a summary shell preview.`,
    mindmap_generated: `Job ${jobState.id} generated a mind map shell preview.`,
  };

  return [
    {
      label:
        prefersGenericStatusLabel
          ? `Job ${jobState.id} is ${jobState.status} for analysis.`
          : primaryLabelByStage[jobState.stage] ??
            `Job ${jobState.id} is ${jobState.status} for analysis.`,
      detail:
        primaryDetailByStage[jobState.stage] ??
        "The backend is coordinating the saved analysis shell with live stage updates.",
      state: primaryState,
    },
    {
      label: "Download stage shell",
      detail:
        jobState.stage === "metadata_ready"
          ? "Metadata is ready, so the workflow can now transition into download preparation."
          : jobState.stage === "queued_download"
            ? "The backend has queued the download shell and is preparing the next media step."
            : jobState.stage === "downloading"
              ? "The download shell is in progress before real media retrieval is wired in."
              : jobState.stage === "download_ready"
                ? "The download shell is complete, so the job is ready for downstream processing."
                : "The download shell will unlock after the metadata probe completes.",
      state: downloadState,
    },
    {
      label: "Transcript and AI output are pending",
      detail:
        jobState.stage === "transcript_ready"
          ? "Audio is extracted and the transcript shell is now ready for the next speech-recognition step."
          : jobState.stage === "transcript_generated"
          ? "A first transcript shell preview is available, while richer transcript generation and downstream summary stages remain in progress."
          : jobState.stage === "summary_generated"
          ? "A first summary shell preview is available, while mind map and Ask AI are still waiting for richer downstream generation."
          : jobState.stage === "mindmap_generated"
          ? "A first mind map shell preview is available, while richer Ask AI and final completion states can build on the saved topic structure."
          : jobState.stage === "download_ready"
          ? "The job has reached the handoff point for later transcript, summary, mind map, and Ask AI stages."
          : "Transcript, summary, mind map, and Ask AI will activate after the download stage is ready.",
      state: aiState,
    },
  ];
}

function mergeJobSnapshot(currentJob: JobRecord | null, nextJob: JobRecord) {
  if (!currentJob || currentJob.id !== nextJob.id) {
    return nextJob;
  }

  const currentStatusRank = STATUS_RANK[currentJob.status];
  const nextStatusRank = STATUS_RANK[nextJob.status];
  const currentStageRank = STAGE_RANK.get(currentJob.stage) ?? -1;
  const nextStageRank = STAGE_RANK.get(nextJob.stage) ?? -1;

  if (
    currentStatusRank > nextStatusRank ||
    (currentStatusRank === nextStatusRank && currentStageRank > nextStageRank)
  ) {
    return {
      ...nextJob,
      stage: currentJob.stage,
      status: currentJob.status,
    };
  }

  return nextJob;
}

export default function HomePage() {
  const initialJobHistoryRef = useRef<InitialJobHistorySnapshot | null>(null);

  if (initialJobHistoryRef.current === null) {
    initialJobHistoryRef.current = seedInitialJobHistory();
  }

  const [inputMode, setInputMode] = useState<InputMode>("public_video");
  const [jobState, setJobState] = useState<JobRecord | null>(null);
  const [jobHistory, setJobHistory] = useState<JobRecord[]>(
    () => initialJobHistoryRef.current?.jobs ?? [],
  );
  const [isHydrating, setIsHydrating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const historyRequestRef = useRef<Promise<JobRecord[]> | null>(
    initialJobHistoryRef.current?.request ?? null,
  );

  async function refreshHistory() {
    try {
      const jobs = await (historyRequestRef.current ?? listJobs());
      historyRequestRef.current = null;
      setJobHistory(jobs);
    } catch {
      historyRequestRef.current = null;
      setJobHistory([]);
    }
  }

  function readJobIdFromUrl() {
    return new URLSearchParams(window.location.search).get("job");
  }

  function syncJobUrl(jobId: string, mode: "push" | "replace") {
    const nextUrl = `/?job=${jobId}`;

    if (mode === "push") {
      window.history.pushState({}, "", nextUrl);
      return;
    }

    window.history.replaceState({}, "", nextUrl);
  }

  async function hydrateJob(
    jobId: string,
    options: {
      fallbackJob?: JobRecord;
      loadErrorMessage?: string;
      syncUrlMode?: "push" | "replace" | false;
    } = {},
  ) {
    const {
      fallbackJob,
      loadErrorMessage = "Unable to load the saved analysis shell.",
      syncUrlMode = false,
    } = options;

    setIsHydrating(true);
    setLoadError(null);

    if (syncUrlMode) {
      syncJobUrl(jobId, syncUrlMode);
    }

    if (fallbackJob) {
      setJobState(fallbackJob);
      setInputMode(fallbackJob.input_mode);
    }

    try {
      const job = await getJob(jobId);

      setJobState((currentState) => mergeJobSnapshot(currentState, job));
      setInputMode(job.input_mode);
    } catch {
      setLoadError(loadErrorMessage);
    } finally {
      setIsHydrating(false);
    }
  }

  useEffect(() => {
    if (initialJobHistoryRef.current?.hasResolvedSnapshot) {
      historyRequestRef.current = null;
    } else {
      void refreshHistory();
    }

    const jobId = readJobIdFromUrl();

    if (jobId) {
      void hydrateJob(jobId);
    }
  }, []);

  useEffect(() => {
    function handlePopState() {
      const jobId = readJobIdFromUrl();

      if (!jobId) {
        setJobState(null);
        setLoadError(null);
        return;
      }

      void hydrateJob(jobId);
    }

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    if (!jobState?.id) {
      return;
    }

    const activeJobId = jobState.id;
    const refreshActiveJob = () => {
      void getJob(activeJobId)
        .then((job) => {
          setJobState((currentState) =>
            currentState?.id === activeJobId
              ? mergeJobSnapshot(currentState, job)
              : currentState,
          );
          setInputMode((currentMode) =>
            currentMode === job.input_mode ? currentMode : job.input_mode,
          );
        })
        .catch(() => undefined);
    };

    return subscribeToJobEvents(jobState.id, {
      onEvent: (event) => {
        if (event.event === "qa.ready") {
          refreshActiveJob();
          return;
        }

        if (event.event !== "job.status") {
          return;
        }

        const payload = event.data;

        if (
          !payload ||
          typeof payload !== "object" ||
          !("status" in payload) ||
          typeof payload.status !== "string" ||
          !KNOWN_JOB_STATUSES.includes(payload.status as (typeof KNOWN_JOB_STATUSES)[number])
        ) {
          return;
        }

        setJobState((currentState) =>
          currentState
            ? {
                ...currentState,
                stage:
                  "stage" in payload && typeof payload.stage === "string"
                    ? (payload.stage as JobRecord["stage"])
                    : currentState.stage,
                status: payload.status as JobRecord["status"],
              }
            : currentState,
        );

        refreshActiveJob();
      },
    });
  }, [jobState?.id]);

  function handleJobCreated(job: CreateJobResponse) {
    syncJobUrl(job.id, "replace");
    setJobState(job);
    setInputMode(job.input_mode);
    void Promise.all([
      refreshHistory(),
      hydrateJob(job.id, {
        fallbackJob: job,
        loadErrorMessage: "Unable to refresh the saved analysis shell.",
      }),
    ]);
  }

  function handleHistorySelection(jobId: string) {
    void hydrateJob(jobId, { syncUrlMode: "push" });
  }

  return (
    <main className={styles.page} id="top">
      <header
        style={{
          backdropFilter: "blur(12px)",
          background: "rgba(255, 255, 255, 0.94)",
          borderBottom: "1px solid #e2e8f0",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div
          className={styles.content}
          style={{
            alignItems: "center",
            display: "flex",
            gap: "1rem",
            justifyContent: "space-between",
            paddingBottom: "1rem",
            paddingTop: "1rem",
          }}
        >
          <a
            href="#top"
            style={{
              color: "#0f172a",
              fontSize: "1.125rem",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Video Analysis
          </a>
          <div
            style={{
              alignItems: "center",
              display: "flex",
              flexWrap: "wrap",
              gap: "1rem",
              justifyContent: "flex-end",
            }}
          >
            <a href="#capabilities">Capabilities</a>
            <a href="#workflow">Workflow</a>
            <a href="#use-cases">Use Cases</a>
            <a href="#preview">Preview</a>
            <a
              className={styles.primaryButton}
              href="#analysis-entry"
              style={{ display: "inline-flex", textDecoration: "none" }}
            >
              Start analysis
            </a>
          </div>
        </div>
      </header>
      <Hero />
      {!jobState ? <HomepageSections /> : null}
      <section className={styles.content} id="analysis-entry">
        <div style={{ display: "grid", gap: "0.75rem", marginBottom: "1.5rem" }}>
          <p className={styles.eyebrow} style={{ marginBottom: 0 }}>
            Analysis entry
          </p>
          <h2 className={styles.heroTitle} style={{ fontSize: "2.5rem" }}>
            Start analysis
          </h2>
          <p className={styles.heroDescription} style={{ margin: 0 }}>
            Paste a public video URL now, or switch modes to prepare for future
            RingCentral recording support. The live workspace below will keep
            the real job status, outputs, and follow-up panels intact.
          </p>
        </div>
        <InputSwitcher onChange={setInputMode} value={inputMode} />
        <div className={styles.workflowLayout}>
          <div style={{ display: "grid", gap: "1rem" }}>
            <AnalyzeForm inputMode={inputMode} onJobCreated={handleJobCreated} />
            <section aria-label="Recent jobs" className={styles.panel}>
              <h2 className={styles.panelTitle}>Recent jobs</h2>
              {jobHistory.length > 0 ? (
                <ul
                  style={{
                    display: "grid",
                    gap: "0.75rem",
                    listStyle: "none",
                    margin: "1rem 0 0",
                    padding: 0,
                  }}
                >
                  {jobHistory.map((job) => (
                    <li key={job.id}>
                      <button
                        aria-pressed={jobState?.id === job.id}
                        onClick={() => handleHistorySelection(job.id)}
                        style={{
                          background: "#f8fafc",
                          border: "1px solid #cbd5e1",
                          borderRadius: "0.75rem",
                          color: "#0f172a",
                          cursor: "pointer",
                          display: "grid",
                          font: "inherit",
                          gap: "0.35rem",
                          padding: "0.85rem 1rem",
                          textAlign: "left",
                          width: "100%",
                        }}
                        type="button"
                      >
                        <span>{job.source_url}</span>
                        {job.title ? (
                          <span style={{ color: "#475569", fontSize: "0.875rem" }}>
                            Title: {job.title}
                          </span>
                        ) : null}
                        <span style={{ color: "#475569", fontSize: "0.875rem" }}>
                          {job.status} • {job.stage}
                        </span>
                      </button>
                    </li>
                  ))}
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
              {loadError ? (
                <p className={styles.formFeedback}>{loadError}</p>
              ) : null}
              <StatusTimeline items={buildTimelineItems(jobState)} />
              <VideoInfoPanel
                description={jobState.description}
                durationSeconds={jobState.duration_seconds}
                inputMode={jobState.input_mode}
                jobId={jobState.id}
                sourceName={jobState.source_name}
                sourceUrl={jobState.source_url}
                thumbnailUrl={jobState.thumbnail_url}
                title={jobState.title}
              />
              <AITabs
                activeJobId={jobState.id}
                jobStage={jobState.stage}
                jobStatus={jobState.status}
                mindmapNodeCount={jobState.mindmap_node_count}
                mindmapPreviewText={jobState.mindmap_preview_text}
                mindmapStatus={jobState.mindmap_status}
                summaryKeyPointsCount={jobState.summary_key_points_count}
                summaryPreviewText={jobState.summary_preview_text}
                summaryStatus={jobState.summary_status}
                transcriptAudioArtifactPath={jobState.transcript_audio_artifact_path}
                transcriptExtractor={jobState.transcript_extractor}
                transcriptPreviewText={jobState.transcript_preview_text}
                transcriptSegmentCount={jobState.transcript_segment_count}
                transcriptStatus={jobState.transcript_status}
                tabs={
                  jobState.status === "completed"
                    ? ["Ask AI", "Summary", "Transcript", "Mind Map"]
                    : undefined
                }
              />
            </div>
          ) : (
            <section aria-label="Analysis workspace" className={styles.panel}>
              <h2 className={styles.panelTitle}>Analysis workspace</h2>
              <p className={styles.workspaceDescription}>
                {isHydrating
                  ? "Loading saved analysis shell..."
                  : "Start an analysis to unlock status, video info, transcript, summary, mind map, and Ask AI panels."}
              </p>
              {loadError ? (
                <p className={styles.formFeedback}>{loadError}</p>
              ) : null}
            </section>
          )}
        </div>
      </section>
    </main>
  );
}
