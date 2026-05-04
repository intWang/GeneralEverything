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
  const [inputMode, setInputMode] = useState<InputMode>("public_video");
  const [jobState, setJobState] = useState<JobRecord | null>(null);
  const [jobHistory, setJobHistory] = useState<JobRecord[]>([]);
  const [isHeaderScrolled, setIsHeaderScrolled] = useState(false);
  const [isHydrating, setIsHydrating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const activeJobIdRef = useRef<string | null>(jobState?.id ?? null);
  const hydrationRequestIdRef = useRef(0);

  activeJobIdRef.current = jobState?.id ?? null;

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
    const requestId = hydrationRequestIdRef.current + 1;

    hydrationRequestIdRef.current = requestId;

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

      if (requestId !== hydrationRequestIdRef.current) {
        return;
      }

      setJobState((currentState) => mergeJobSnapshot(currentState, job));
      setInputMode(job.input_mode);
    } catch {
      if (requestId === hydrationRequestIdRef.current) {
        setLoadError(loadErrorMessage);
      }
    } finally {
      if (requestId === hydrationRequestIdRef.current) {
        setIsHydrating(false);
      }
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
        hydrationRequestIdRef.current += 1;
        setJobState(null);
        setIsHydrating(false);
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
    function syncHeaderScrollState() {
      setIsHeaderScrolled(window.scrollY > 24);
    }

    syncHeaderScrollState();
    window.addEventListener("scroll", syncHeaderScrollState, { passive: true });

    return () => {
      window.removeEventListener("scroll", syncHeaderScrollState);
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
          if (activeJobIdRef.current !== activeJobId) {
            return;
          }

          setJobState((currentState) =>
            currentState?.id === activeJobId
              ? mergeJobSnapshot(currentState, job)
              : currentState,
          );
          if (activeJobIdRef.current === activeJobId) {
            setInputMode((currentMode) =>
              currentMode === job.input_mode ? currentMode : job.input_mode,
            );
          }
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

        if (
          ("job_id" in payload &&
            typeof payload.job_id === "string" &&
            payload.job_id !== activeJobId) ||
          activeJobIdRef.current !== activeJobId
        ) {
          return;
        }

        setJobState((currentState) =>
          currentState?.id === activeJobId
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
        className={styles.siteHeader}
        data-scrolled={isHeaderScrolled}
      >
        <div className={`${styles.content} ${styles.siteHeaderInner}`}>
          <a className={styles.brandLink} href="#top">
            Video Analysis
          </a>
          <div className={styles.siteNav}>
            <a href="#capabilities">Capabilities</a>
            <a href="#workflow">Workflow</a>
            <a href="#use-cases">Use Cases</a>
            <a href="#preview">Preview</a>
            <a
              className={`${styles.primaryButton} ${styles.buttonLink}`}
              href="#analysis-entry"
            >
              Start analysis
            </a>
          </div>
        </div>
      </header>
      <Hero />
      <HomepageSections />
      <section className={`${styles.content} ${styles.analysisEntry}`} id="analysis-entry">
        <div className={styles.analysisEntryIntro}>
          <p className={`${styles.eyebrow} ${styles.compactEyebrow}`}>
            Workspace entry
          </p>
          <h2 className={styles.analysisEntryTitle}>
            Start with a recording. Leave with searchable answers.
          </h2>
          <p className={styles.analysisEntryDescription}>
            Add a recording source to open one workspace for transcript review,
            summary takeaways, and grounded follow-up questions. The live
            analysis area below keeps status, recording context, and AI outputs
            connected as the job progresses.
          </p>
        </div>
        <InputSwitcher onChange={setInputMode} value={inputMode} />
        <div className={styles.workflowLayout}>
          <div className={styles.workflowSidebar}>
            <AnalyzeForm inputMode={inputMode} onJobCreated={handleJobCreated} />
            <section aria-label="Recent jobs" className={styles.panel}>
              <h2 className={styles.panelTitle}>Recent jobs</h2>
              {jobHistory.length > 0 ? (
                <ul className={styles.historyList}>
                  {jobHistory.map((job) => (
                    <li key={job.id}>
                      <button
                        aria-pressed={jobState?.id === job.id}
                        className={styles.historyButton}
                        onClick={() => handleHistorySelection(job.id)}
                        type="button"
                      >
                        <span>{job.source_url}</span>
                        {job.title ? (
                          <span className={styles.historyMeta}>
                            Title: {job.title}
                          </span>
                        ) : null}
                        <span className={styles.historyMeta}>
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
