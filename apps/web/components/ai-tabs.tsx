"use client";

import { useState } from "react";

import styles from "../app/homepage.module.css";
import { AskAiTab, type AskAiShellState } from "./ask-ai-tab";
import { MindMapTab } from "./mindmap-tab";
import { SummaryTab } from "./summary-tab";
import { TranscriptTab } from "./transcript-tab";
import type { JobRecord, JobStatus } from "../lib/types";
import type { TabShellState } from "./summary-tab";

const DEFAULT_TABS = ["Summary", "Transcript", "Mind Map", "Ask AI"] as const;

type AITab = (typeof DEFAULT_TABS)[number];

type AITabsProps = {
  activeJobId?: string;
  jobStage?: string;
  jobStatus?: JobStatus;
  transcriptAudioArtifactPath?: JobRecord["transcript_audio_artifact_path"];
  transcriptExtractor?: JobRecord["transcript_extractor"];
  transcriptStatus?: JobRecord["transcript_status"];
  tabs?: readonly AITab[];
};

function deriveTabShellStates(
  jobStatus: JobStatus,
  jobStage?: string,
): Record<"summary" | "transcript" | "mindmap", TabShellState> {
  if (jobStatus === "completed") {
    return {
      summary: "complete",
      transcript: "complete",
      mindmap: "complete",
    };
  }

  if (jobStatus === "failed") {
    return {
      summary: "failed",
      transcript: "failed",
      mindmap: "failed",
    };
  }

  if (jobStatus === "running") {
    if (jobStage === "transcript_ready") {
      return {
        summary: "queued",
        transcript: "processing",
        mindmap: "queued",
      };
    }

    if (jobStage?.includes("transcript")) {
      return {
        summary: "queued",
        transcript: "partial",
        mindmap: "queued",
      };
    }

    if (jobStage?.includes("summary")) {
      return {
        summary: "partial",
        transcript: "complete",
        mindmap: "queued",
      };
    }

    if (jobStage?.includes("mind")) {
      return {
        summary: "complete",
        transcript: "complete",
        mindmap: "partial",
      };
    }

    return {
      summary: "processing",
      transcript: "partial",
      mindmap: "queued",
    };
  }

  return {
    summary: "queued",
    transcript: "queued",
    mindmap: "queued",
  };
}

function deriveAskAiShellState(
  jobStatus: JobStatus,
  jobStage?: string,
): AskAiShellState {
  if (jobStatus === "completed") {
    return "complete";
  }

  if (jobStatus === "failed") {
    return "failed";
  }

  if (jobStatus === "running") {
    if (jobStage?.includes("transcript")) {
      return "queued";
    }

    return "processing";
  }

  return "queued";
}

export function AITabs({
  activeJobId,
  jobStage,
  jobStatus = "queued",
  transcriptAudioArtifactPath,
  transcriptExtractor,
  transcriptStatus,
  tabs = DEFAULT_TABS,
}: AITabsProps) {
  const [activeTab, setActiveTab] = useState<AITab>(tabs[0] ?? "Summary");
  const shellStates = deriveTabShellStates(jobStatus, jobStage);
  const askAiShellState = deriveAskAiShellState(jobStatus, jobStage);

  return (
    <section aria-label="AI analysis panels" className={styles.panel}>
      <h2 className={styles.panelTitle}>AI output</h2>
      <div aria-label="Analysis tabs" className={styles.tabList} role="tablist">
        {tabs.map((tab) => {
          const isSelected = activeTab === tab;

          return (
            <button
              aria-controls={`tab-panel-${tab}`}
              aria-selected={isSelected}
              className={styles.tabButton}
              data-selected={isSelected}
              key={tab}
              onClick={() => setActiveTab(tab)}
              role="tab"
              type="button"
            >
              {tab}
            </button>
          );
        })}
      </div>
      <div
        className={styles.tabPanel}
        id={`tab-panel-${activeTab}`}
        role="tabpanel"
      >
        {activeTab === "Summary" ? (
          <SummaryTab shellState={shellStates.summary} />
        ) : null}
        {activeTab === "Transcript" ? (
          <TranscriptTab
            audioArtifactPath={transcriptAudioArtifactPath}
            extractor={transcriptExtractor}
            previewLines={
              jobStage === "transcript_ready"
                ? [
                    "Audio extraction finished and the transcript worker shell is ready for speech recognition.",
                    "Transcript text has not been generated yet, but the audio artifact is now available to the next stage.",
                    "Summary and mind map remain queued until transcript generation starts.",
                  ]
                : undefined
            }
            shellState={
              transcriptStatus === "failed" ? "failed" : shellStates.transcript
            }
          />
        ) : null}
        {activeTab === "Mind Map" ? (
          <MindMapTab shellState={shellStates.mindmap} />
        ) : null}
        {activeTab === "Ask AI" ? (
          <AskAiTab
            jobId={activeJobId}
            key={activeJobId ?? "ask-ai-shell"}
            shellState={askAiShellState}
          />
        ) : null}
      </div>
    </section>
  );
}
