"use client";

import { useState } from "react";

import styles from "../app/homepage.module.css";
import { AskAiTab } from "./ask-ai-tab";
import { MindMapTab } from "./mindmap-tab";
import { SummaryTab } from "./summary-tab";
import { TranscriptTab } from "./transcript-tab";
import type { JobStatus } from "../lib/types";
import type { TabShellState } from "./summary-tab";

const DEFAULT_TABS = ["Summary", "Transcript", "Mind Map", "Ask AI"] as const;

type AITab = (typeof DEFAULT_TABS)[number];

type AITabsProps = {
  jobStage?: string;
  jobStatus?: JobStatus;
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

export function AITabs({
  jobStage,
  jobStatus = "queued",
  tabs = DEFAULT_TABS,
}: AITabsProps) {
  const [activeTab, setActiveTab] = useState<AITab>(tabs[0] ?? "Summary");
  const shellStates = deriveTabShellStates(jobStatus, jobStage);

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
          <TranscriptTab shellState={shellStates.transcript} />
        ) : null}
        {activeTab === "Mind Map" ? (
          <MindMapTab shellState={shellStates.mindmap} />
        ) : null}
        {activeTab === "Ask AI" ? <AskAiTab /> : null}
      </div>
    </section>
  );
}
