"use client";

import { useEffect, useRef, useState } from "react";

import styles from "./homepage.module.css";
import { AITabs } from "../components/ai-tabs";
import { AnalyzeForm } from "../components/analyze-form";
import { Hero } from "../components/hero";
import { HomepageSections } from "../components/homepage-sections";
import { InputSwitcher } from "../components/input-switcher";
import { JobHistoryPanel } from "../components/job-history-panel";
import { ReportExportPanel } from "../components/report-export-panel";
import { StatusTimeline } from "../components/status-timeline";
import { VideoInfoPanel } from "../components/video-info-panel";
import {
  deleteJob,
  getCapabilities,
  getJob,
  listJobs,
  retryJob,
  updateJob,
} from "../lib/api";
import { subscribeToJobEvents } from "../lib/sse";
import type {
  DownloadProgress,
  InputModeCapability,
  InputMode,
  JobRecord,
  MindMapNode,
  MindMapReference,
  TranscriptSegment,
} from "../lib/types";
import type { CreateJobResponse } from "../lib/api";

const KNOWN_JOB_STATUSES = ["queued", "running", "failed", "completed"] as const;
const STATUS_RANK: Record<JobRecord["status"], number> = {
  queued: 0,
  running: 1,
  failed: 2,
  // Prefer success over failure for same-stage terminal reordering.
  completed: 3,
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
    jobState.stage === "transcript_ready" || jobState.stage === "generating_transcript"
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
    generating_transcript:
      "Audio has been extracted and the model is decoding the first transcript lines. Long recordings can take a little time before the first stable segment appears.",
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
    generating_transcript: `Job ${jobState.id} is decoding the first transcript lines.`,
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
          : jobState.stage === "generating_transcript"
          ? jobState.transcript_segment_count && jobState.transcript_segment_count > 0
            ? `Transcript streaming has started. ${jobState.transcript_segment_count} segments are already available while summary and Ask AI continue waiting for more stable context.`
            : "Audio has been extracted and decoding is underway. The first transcript lines may take 30 to 90 seconds on longer videos."
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
      ...currentJob,
    };
  }

  return {
    ...currentJob,
    ...nextJob,
  };
}

function mergeJobStatusUpdate(
  currentJob: JobRecord,
  status: JobRecord["status"],
  stage?: JobRecord["stage"],
) {
  return mergeJobSnapshot(currentJob, {
    ...currentJob,
    stage: stage ?? currentJob.stage,
    status,
  });
}

function normalizeTranscriptSegments(value: unknown): TranscriptSegment[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalizedSegments: TranscriptSegment[] = [];
  value.forEach((segment, index) => {
    if (!segment || typeof segment !== "object") {
      return;
    }

    const segmentRecord = segment as Record<string, unknown>;
    const text = segmentRecord.text;
    const startSeconds = segmentRecord.start_seconds ?? segmentRecord.start;
    const endSeconds = segmentRecord.end_seconds ?? segmentRecord.end;

    if (
      typeof text !== "string" ||
      typeof startSeconds !== "number" ||
      typeof endSeconds !== "number"
    ) {
      return;
    }

    const id = segmentRecord.id;
    normalizedSegments.push({
      id: typeof id === "string" ? id : `segment-${index + 1}`,
      start_seconds: startSeconds,
      end_seconds: endSeconds,
      text,
    });
  });

  return normalizedSegments;
}

function normalizeMindMapReference(value: unknown): MindMapReference | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const reference = value as Record<string, unknown>;
  const segmentId = reference.segment_id;
  const startSeconds = reference.start_seconds;
  const endSeconds = reference.end_seconds;
  const label = reference.label;

  if (segmentId !== undefined && segmentId !== null && typeof segmentId !== "string") {
    return null;
  }

  if (
    startSeconds !== undefined &&
    startSeconds !== null &&
    typeof startSeconds !== "number"
  ) {
    return null;
  }

  if (
    endSeconds !== undefined &&
    endSeconds !== null &&
    typeof endSeconds !== "number"
  ) {
    return null;
  }

  if (label !== undefined && label !== null && typeof label !== "string") {
    return null;
  }

  return {
    end_seconds: typeof endSeconds === "number" ? endSeconds : null,
    label: typeof label === "string" ? label : null,
    segment_id: typeof segmentId === "string" ? segmentId : null,
    start_seconds: typeof startSeconds === "number" ? startSeconds : null,
  };
}

function normalizeMindMapNode(value: unknown, depth = 0): MindMapNode | null {
  if (depth > 64 || !value || typeof value !== "object") {
    return null;
  }

  const node = value as Record<string, unknown>;
  if (typeof node.id !== "string" || typeof node.label !== "string") {
    return null;
  }

  if (
    node.summary !== undefined &&
    node.summary !== null &&
    typeof node.summary !== "string"
  ) {
    return null;
  }

  if (node.children !== undefined && !Array.isArray(node.children)) {
    return null;
  }

  if (node.references !== undefined && !Array.isArray(node.references)) {
    return null;
  }

  const children: MindMapNode[] = [];
  for (const child of node.children ?? []) {
    const normalizedChild = normalizeMindMapNode(child, depth + 1);
    if (!normalizedChild) {
      return null;
    }
    children.push(normalizedChild);
  }

  const references: MindMapReference[] = [];
  for (const reference of node.references ?? []) {
    const normalizedReference = normalizeMindMapReference(reference);
    if (!normalizedReference) {
      return null;
    }
    references.push(normalizedReference);
  }

  return {
    children,
    id: node.id,
    label: node.label,
    references,
    summary: typeof node.summary === "string" ? node.summary : null,
  };
}

type NullableProgressNumberField = Exclude<keyof DownloadProgress, "status">;

function mergeDownloadProgressField(
  payload: Record<string, unknown>,
  currentProgress: DownloadProgress | null | undefined,
  field: NullableProgressNumberField,
) {
  if (!Object.prototype.hasOwnProperty.call(payload, field)) {
    return currentProgress?.[field];
  }

  const value = payload[field];

  if (typeof value === "number" || value === null) {
    return value;
  }

  return currentProgress?.[field];
}

function getDownloadProgressStage(
  currentStage: JobRecord["stage"],
  progressStatus: string,
) {
  if (progressStatus !== "downloading") {
    return currentStage;
  }

  const currentStageRank = STAGE_RANK.get(currentStage);
  const downloadingStageRank = STAGE_RANK.get("downloading");

  if (
    currentStageRank === undefined ||
    downloadingStageRank === undefined ||
    currentStageRank > downloadingStageRank
  ) {
    return currentStage;
  }

  return "downloading";
}

export default function HomePage() {
  const [inputMode, setInputMode] = useState<InputMode>("public_video");
  const [capabilityStatus, setCapabilityStatus] = useState<"error" | "loading" | "ready">(
    "loading",
  );
  const [ringCentralCapability, setRingCentralCapability] =
    useState<InputModeCapability | null>(null);
  const [jobState, setJobState] = useState<JobRecord | null>(null);
  const [jobHistory, setJobHistory] = useState<JobRecord[]>([]);
  const [isHeaderScrolled, setIsHeaderScrolled] = useState(false);
  const [isHydrating, setIsHydrating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const activeJobIdRef = useRef<string | null>(jobState?.id ?? null);
  const hydrationRequestIdRef = useRef(0);
  const jobRefreshEpochRef = useRef<Record<string, number>>({});
  const resultsSectionRef = useRef<HTMLElement | null>(null);
  const [jobRefreshEpoch, setJobRefreshEpoch] = useState(0);

  activeJobIdRef.current = jobState?.id ?? null;

  async function refreshHistory() {
    try {
      const jobs = await listJobs();
      setJobHistory(jobs);
      return jobs;
    } catch {
      setJobHistory([]);
      return [];
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

  function clearJobUrl() {
    window.history.replaceState({}, "", "/");
  }

  function getJobRefreshEpoch(jobId: string) {
    return jobRefreshEpochRef.current[jobId] ?? 0;
  }

  function bumpJobRefreshEpoch(jobId: string) {
    jobRefreshEpochRef.current = {
      ...jobRefreshEpochRef.current,
      [jobId]: getJobRefreshEpoch(jobId) + 1,
    };
    setJobRefreshEpoch((currentEpoch) => currentEpoch + 1);
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
    void getCapabilities()
      .then((capabilities) => {
        setRingCentralCapability(capabilities.input_modes.ringcentral_recording);
        setCapabilityStatus("ready");
      })
      .catch(() => {
        setRingCentralCapability(null);
        setCapabilityStatus("error");
      });

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
    const activeEpoch = getJobRefreshEpoch(activeJobId);
    const refreshActiveJob = () => {
      void getJob(activeJobId)
        .then((job) => {
          if (
            activeJobIdRef.current !== activeJobId ||
            getJobRefreshEpoch(activeJobId) !== activeEpoch
          ) {
            return;
          }

          setJobState((currentState) =>
            currentState?.id === activeJobId
              ? mergeJobSnapshot(currentState, job)
              : currentState,
          );
          if (
            activeJobIdRef.current === activeJobId &&
            getJobRefreshEpoch(activeJobId) === activeEpoch
          ) {
            setInputMode((currentMode) =>
              currentMode === job.input_mode ? currentMode : job.input_mode,
            );
          }
        })
        .catch(() => undefined);
    };

    return subscribeToJobEvents(jobState.id, {
      onEvent: (event) => {
        if (getJobRefreshEpoch(activeJobId) !== activeEpoch) {
          return;
        }

        if (event.event === "qa.ready") {
          refreshActiveJob();
          return;
        }

        if (event.event === "transcript.segment") {
          const payload = event.data;
          if (
            !payload ||
            typeof payload !== "object" ||
            !("transcript" in payload) ||
            typeof payload.transcript !== "object" ||
            payload.transcript === null
          ) {
            return;
          }

          const transcriptPayload = payload.transcript as Record<string, unknown>;
          const transcriptSourceSegments = normalizeTranscriptSegments(
            transcriptPayload.source_segments,
          );
          setJobState((currentState) => {
            if (currentState?.id !== activeJobId) {
              return currentState;
            }

            return mergeJobSnapshot(currentState, {
              ...currentState,
              detected_language_code:
                typeof transcriptPayload.detected_language_code === "string"
                  ? transcriptPayload.detected_language_code
                  : currentState.detected_language_code,
              detected_language_name:
                typeof transcriptPayload.detected_language_name === "string"
                  ? transcriptPayload.detected_language_name
                  : currentState.detected_language_name,
              stage: "generating_transcript",
              status: "running",
              transcript_preview_text:
                typeof transcriptPayload.preview_text === "string"
                  ? transcriptPayload.preview_text
                  : currentState.transcript_preview_text,
              transcript_segment_count:
                typeof transcriptPayload.segment_count === "number"
                  ? transcriptPayload.segment_count
                  : currentState.transcript_segment_count,
              transcript_source_text:
                typeof transcriptPayload.source_text === "string"
                  ? transcriptPayload.source_text
                  : currentState.transcript_source_text,
              transcript_source_segments:
                transcriptSourceSegments ?? currentState.transcript_source_segments,
              transcript_status: "processing",
            });
          });
          return;
        }

        if (event.event === "summary.partial" || event.event === "summary.shell") {
          const payload = event.data;
          if (
            !payload ||
            typeof payload !== "object" ||
            !("summary" in payload) ||
            typeof payload.summary !== "object" ||
            payload.summary === null
          ) {
            return;
          }

          const summaryPayload = payload.summary as Record<string, unknown>;
          const isFinalSummaryShell = event.event === "summary.shell";
          setJobState((currentState) => {
            if (currentState?.id !== activeJobId) {
              return currentState;
            }

            return mergeJobSnapshot(currentState, {
              ...currentState,
              stage:
                typeof summaryPayload.stage === "string"
                  ? (summaryPayload.stage as JobRecord["stage"])
                  : isFinalSummaryShell
                    ? "summary_generated"
                    : currentState.stage,
              status: "running",
              summary_key_points_count:
                typeof summaryPayload.key_points_count === "number"
                  ? summaryPayload.key_points_count
                  : currentState.summary_key_points_count,
              summary_preview_text:
                typeof summaryPayload.preview_text === "string"
                  ? summaryPayload.preview_text
                  : currentState.summary_preview_text,
              summary_source_bullets: Array.isArray(summaryPayload.source_bullets)
                ? (summaryPayload.source_bullets.filter(
                    (item): item is string => typeof item === "string",
                  ) as string[])
                : currentState.summary_source_bullets,
              summary_source_text:
                typeof summaryPayload.source_text === "string"
                  ? summaryPayload.source_text
                  : currentState.summary_source_text,
              summary_structured:
                summaryPayload.summary_structured &&
                typeof summaryPayload.summary_structured === "object"
                  ? (summaryPayload.summary_structured as JobRecord["summary_structured"])
                  : isFinalSummaryShell
                    ? null
                    : currentState.summary_structured,
              summary_status:
                typeof summaryPayload.status === "string"
                  ? summaryPayload.status
                  : isFinalSummaryShell
                    ? "ready"
                    : "processing",
            });
          });
          return;
        }

        if (event.event === "mindmap.shell") {
          const payload = event.data;
          if (
            !payload ||
            typeof payload !== "object" ||
            !("mindmap" in payload) ||
            typeof payload.mindmap !== "object" ||
            payload.mindmap === null
          ) {
            return;
          }

          const mindmapPayload = payload.mindmap as Record<string, unknown>;
          const mindmapNodes = normalizeMindMapNode(mindmapPayload.mindmap_nodes);
          setJobState((currentState) => {
            if (currentState?.id !== activeJobId) {
              return currentState;
            }

            return mergeJobSnapshot(currentState, {
              ...currentState,
              mindmap_node_count:
                typeof mindmapPayload.node_count === "number"
                  ? mindmapPayload.node_count
                  : currentState.mindmap_node_count,
              mindmap_nodes: mindmapNodes,
              mindmap_preview_text:
                typeof mindmapPayload.preview_text === "string"
                  ? mindmapPayload.preview_text
                  : currentState.mindmap_preview_text,
              mindmap_status:
                typeof mindmapPayload.status === "string"
                  ? mindmapPayload.status
                  : "ready",
              stage:
                typeof mindmapPayload.stage === "string"
                  ? (mindmapPayload.stage as JobRecord["stage"])
                  : "mindmap_generated",
              status: "running",
            });
          });
          return;
        }

        if (event.event === "video.download.progress") {
          const payload = event.data;
          if (
            !payload ||
            typeof payload !== "object" ||
            !("progress" in payload) ||
            typeof payload.progress !== "object" ||
            payload.progress === null
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

          const progressPayload = payload.progress as Record<string, unknown>;
          if (typeof progressPayload.status !== "string") {
            return;
          }

          setJobState((currentState) => {
            if (currentState?.id !== activeJobId) {
              return currentState;
            }

            const downloadProgress = {
              ...(currentState.download_progress ?? {}),
              downloaded_bytes:
                mergeDownloadProgressField(
                  progressPayload,
                  currentState.download_progress,
                  "downloaded_bytes",
                ),
              eta_seconds:
                mergeDownloadProgressField(
                  progressPayload,
                  currentState.download_progress,
                  "eta_seconds",
                ),
              percent:
                mergeDownloadProgressField(
                  progressPayload,
                  currentState.download_progress,
                  "percent",
                ),
              speed_bytes_per_second:
                mergeDownloadProgressField(
                  progressPayload,
                  currentState.download_progress,
                  "speed_bytes_per_second",
                ),
              status: progressPayload.status,
              total_bytes:
                mergeDownloadProgressField(
                  progressPayload,
                  currentState.download_progress,
                  "total_bytes",
                ),
            };

            return {
              ...currentState,
              download_progress: downloadProgress,
              download_status: progressPayload.status,
              stage: getDownloadProgressStage(
                currentState.stage,
                progressPayload.status,
              ),
            };
          });
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
            ? mergeJobStatusUpdate(
                currentState,
                payload.status as JobRecord["status"],
                "stage" in payload && typeof payload.stage === "string"
                  ? (payload.stage as JobRecord["stage"])
                  : undefined,
              )
            : currentState,
        );

        refreshActiveJob();
      },
    });
  }, [jobState?.id, jobRefreshEpoch]);

  useEffect(() => {
    if (!jobState?.id || !["queued", "running"].includes(jobState.status)) {
      return;
    }

    const activeJobId = jobState.id;
    const activeEpoch = getJobRefreshEpoch(activeJobId);
    const intervalId = window.setInterval(() => {
      void getJob(activeJobId)
        .then((job) => {
          if (
            activeJobIdRef.current !== activeJobId ||
            getJobRefreshEpoch(activeJobId) !== activeEpoch
          ) {
            return;
          }

          setJobState((currentState) =>
            currentState?.id === activeJobId
              ? mergeJobSnapshot(currentState, job)
              : currentState,
          );
        })
        .catch(() => undefined);
    }, 2000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [jobState?.id, jobState?.status, jobRefreshEpoch]);

  function handleJobCreated(job: CreateJobResponse) {
    syncJobUrl(job.id, "replace");
    setJobState(job);
    setInputMode(job.input_mode);
    resultsSectionRef.current?.scrollIntoView?.({
      behavior: "smooth",
      block: "start",
    });
    void Promise.all([
      refreshHistory(),
      hydrateJob(job.id, {
        fallbackJob: job,
        loadErrorMessage: "Unable to refresh the saved analysis shell.",
      }),
    ]);
  }

  function handleHistorySelection(jobId: string) {
    const fallbackJob = jobHistory.find((job) => job.id === jobId);

    void hydrateJob(jobId, {
      fallbackJob,
      syncUrlMode: "push",
    });
  }

  async function handleHistoryRename(jobId: string, title: string) {
    const updatedJob = await updateJob(jobId, title);
    await refreshHistory();

    if (activeJobIdRef.current === jobId) {
      setJobState((currentState) =>
        currentState?.id === jobId ? mergeJobSnapshot(currentState, updatedJob) : currentState,
      );
      setInputMode(updatedJob.input_mode);
    }
  }

  async function handleHistoryRetry(jobId: string) {
    const retriedJob = await retryJob(jobId);
    await refreshHistory();

    if (activeJobIdRef.current === jobId) {
      hydrationRequestIdRef.current += 1;
      bumpJobRefreshEpoch(jobId);
      setJobState((currentState) =>
        currentState?.id === jobId ? { ...currentState, ...retriedJob } : currentState,
      );
      setInputMode(retriedJob.input_mode);
    }
  }

  async function handleHistoryDelete(jobId: string) {
    await deleteJob(jobId);
    await refreshHistory();

    if (activeJobIdRef.current === jobId) {
      hydrationRequestIdRef.current += 1;
      setJobState(null);
      setIsHydrating(false);
      setLoadError(null);
      clearJobUrl();
    }
  }

  const recentJobsPanel = (
    <JobHistoryPanel
      activeJobId={jobState?.id}
      jobs={jobHistory}
      onDelete={handleHistoryDelete}
      onRename={handleHistoryRename}
      onRetry={handleHistoryRetry}
      onSelect={handleHistorySelection}
    />
  );

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
            <a
              className={`${styles.primaryButton} ${styles.buttonLink}`}
              href="#analysis-entry"
            >
              Start analysis
            </a>
          </div>
        </div>
      </header>
      <Hero
        inputArea={
          <div className={styles.heroFormStack}>
            <InputSwitcher onChange={setInputMode} value={inputMode} />
            <AnalyzeForm
              capabilityStatus={capabilityStatus}
              inputMode={inputMode}
              onJobCreated={handleJobCreated}
              ringCentralCapability={ringCentralCapability}
            />
          </div>
        }
      />
      {!jobState ? <HomepageSections /> : null}
      <section
        className={`${styles.content} ${styles.resultsSection}`}
        id="results-workspace"
        ref={resultsSectionRef}
      >
        <div className={styles.analysisEntryIntro}>
          <p className={`${styles.eyebrow} ${styles.compactEyebrow}`}>
            Results workspace
          </p>
          <h2 className={styles.analysisEntryTitle}>
            Review the details after analysis starts.
          </h2>
          <p className={styles.analysisEntryDescription}>
            The live workspace below keeps status, video details, transcript,
            summary, and follow-up questions in one place once a job is in
            motion.
          </p>
        </div>
        <div className={styles.workflowLayout}>
          {jobState ? (
            <div className={styles.resultsGrid}>
              <div className={styles.resultsSidebar}>
                <VideoInfoPanel
                  detectedLanguageName={jobState.detected_language_name}
                  description={jobState.description}
                  diagnostics={jobState.diagnostics}
                  downloadFormats={jobState.download_formats}
                  downloadProgress={jobState.download_progress}
                  durationSeconds={jobState.duration_seconds}
                  inputMode={jobState.input_mode}
                  jobId={jobState.id}
                  sourceName={jobState.source_name}
                  sourceUrl={jobState.source_url}
                  thumbnailUrl={jobState.thumbnail_url}
                  title={jobState.title}
                />
                <StatusTimeline items={buildTimelineItems(jobState)} />
              </div>
              <div className={styles.resultsPrimary}>
                {loadError ? (
                  <p className={styles.formFeedback}>{loadError}</p>
                ) : null}
                <ReportExportPanel jobId={jobState.id} />
                <AITabs
                  activeJobId={jobState.id}
                  detectedLanguageName={jobState.detected_language_name}
                  jobStage={jobState.stage}
                  jobStatus={jobState.status}
                  mindmapNodeCount={jobState.mindmap_node_count}
                  mindmapNodes={jobState.mindmap_nodes}
                  mindmapPreviewText={jobState.mindmap_preview_text}
                  mindmapStatus={jobState.mindmap_status}
                  summaryKeyPointsCount={jobState.summary_key_points_count}
                  summaryPreviewText={jobState.summary_preview_text}
                  summarySourceBullets={jobState.summary_source_bullets}
                  summarySourceText={jobState.summary_source_text}
                  summaryStructured={jobState.summary_structured}
                  summaryTranslations={jobState.summary_translations}
                  summaryStatus={jobState.summary_status}
                  transcriptAudioArtifactPath={jobState.transcript_audio_artifact_path}
                  transcriptExtractor={jobState.transcript_extractor}
                  transcriptPreviewText={jobState.transcript_preview_text}
                  transcriptSourceSegments={jobState.transcript_source_segments}
                  transcriptSourceText={jobState.transcript_source_text}
                  transcriptTranslations={jobState.transcript_translations}
                  transcriptSegmentCount={jobState.transcript_segment_count}
                  transcriptStatus={jobState.transcript_status}
                  tabs={
                    jobState.status === "completed"
                      ? ["Ask AI", "Summary", "Transcript", "Mind Map"]
                      : undefined
                  }
                />
              </div>
              {recentJobsPanel}
            </div>
          ) : (
            <div className={styles.workflowPanels}>
              {loadError ? (
                <p className={styles.formFeedback}>{loadError}</p>
              ) : null}
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
              {recentJobsPanel}
            </div>
          )}
        </div>
      </section>
      {jobState ? <HomepageSections /> : null}
    </main>
  );
}
