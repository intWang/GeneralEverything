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
  };

  const primaryLabelByStage: Record<string, string> = {
    queued: `Job ${jobState.id} is queued for analysis.`,
    metadata_ready: `Job ${jobState.id} finished metadata probing.`,
    queued_download: `Job ${jobState.id} is queued for download preparation.`,
    downloading: `Job ${jobState.id} is progressing through the download shell.`,
    download_ready: `Job ${jobState.id} is ready for the download step.`,
    transcript_ready: `Job ${jobState.id} is ready for transcript generation.`,
    transcript_generated: `Job ${jobState.id} generated a transcript shell preview.`,
  };

  return [
    {
      label:
        primaryLabelByStage[jobState.stage] ??
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
          : jobState.stage === "download_ready"
          ? "The download shell is complete and the workflow is now preparing the transcript stage."
          : "Transcript, summary, mind map, and Ask AI will activate after the download stage is ready.",
      state: aiState,
    },
  ];
}

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
                transcriptAudioArtifactPath={jobState.transcript_audio_artifact_path}
                transcriptExtractor={jobState.transcript_extractor}
                transcriptPreviewText={jobState.transcript_preview_text}
                transcriptSegmentCount={jobState.transcript_segment_count}
                transcriptStatus={jobState.transcript_status}
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
