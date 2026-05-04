"use client";

import { useEffect, useState } from "react";

import styles from "./homepage.module.css";
import { AITabs } from "../components/ai-tabs";
import { AnalyzeForm } from "../components/analyze-form";
import { Hero } from "../components/hero";
import { InputSwitcher } from "../components/input-switcher";
import { StatusTimeline } from "../components/status-timeline";
import { VideoInfoPanel } from "../components/video-info-panel";
import { getJob, listJobs } from "../lib/api";
import { subscribeToJobEvents } from "../lib/sse";
import type { InputMode, JobRecord } from "../lib/types";
import type { CreateJobResponse } from "../lib/api";

const KNOWN_JOB_STATUSES = ["queued", "running", "failed", "completed"] as const;

export default function HomePage() {
  const [inputMode, setInputMode] = useState<InputMode>("public_video");
  const [jobState, setJobState] = useState<JobRecord | null>(null);
  const [jobHistory, setJobHistory] = useState<JobRecord[]>([]);
  const [isHydrating, setIsHydrating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function refreshHistory() {
    try {
      setJobHistory(await listJobs());
    } catch {
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

      setJobState(job);
      setInputMode(job.input_mode);
    } catch {
      setLoadError(loadErrorMessage);
    } finally {
      setIsHydrating(false);
    }
  }

  useEffect(() => {
    void refreshHistory();

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

    return subscribeToJobEvents(jobState.id, {
      onEvent: (event) => {
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
                status: payload.status as JobRecord["status"],
              }
            : currentState,
        );
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
    <main className={styles.page}>
      <Hero />
      <section className={styles.content}>
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
                        <span>{job.title || job.source_url}</span>
                        <span style={{ color: "#475569", fontSize: "0.875rem" }}>
                          {job.source_url}
                        </span>
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
              <StatusTimeline
                items={[
                  {
                    label: `Job ${jobState.id} is ${jobState.status} for analysis.`,
                    detail: "Backend events will replace this shell with live stage updates.",
                    state:
                      jobState.status === "failed"
                        ? "error"
                        : jobState.status === "completed"
                          ? "complete"
                          : "active",
                  },
                  {
                    label: "Transcript and AI output are pending",
                    detail: "Task 10 will progressively render the analysis panels.",
                    state: "pending",
                  },
                ]}
              />
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
