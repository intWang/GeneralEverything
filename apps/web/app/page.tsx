"use client";

import { useEffect, useState } from "react";

import styles from "./homepage.module.css";
import { AITabs } from "../components/ai-tabs";
import { AnalyzeForm } from "../components/analyze-form";
import { Hero } from "../components/hero";
import { InputSwitcher } from "../components/input-switcher";
import { StatusTimeline } from "../components/status-timeline";
import { VideoInfoPanel } from "../components/video-info-panel";
import { subscribeToJobEvents } from "../lib/sse";
import type { InputMode } from "../lib/types";
import type { CreateJobResponse } from "../lib/api";

type JobStatusState = {
  jobId: string;
  sourceLabel: string;
  status: string;
};

export default function HomePage() {
  const [inputMode, setInputMode] = useState<InputMode>("public_video");
  const [jobState, setJobState] = useState<JobStatusState | null>(null);

  useEffect(() => {
    if (!jobState?.jobId) {
      return;
    }

    return subscribeToJobEvents(jobState.jobId, {
      onEvent: (event) => {
        if (event.event !== "job.status") {
          return;
        }

        const payload = event.data;

        if (
          !payload ||
          typeof payload !== "object" ||
          !("status" in payload) ||
          typeof payload.status !== "string"
        ) {
          return;
        }

        setJobState((currentState) =>
          currentState
            ? {
                ...currentState,
                status: payload.status,
              }
            : currentState,
        );
      },
    });
  }, [jobState?.jobId]);

  function handleJobCreated(job: CreateJobResponse) {
    setJobState({
      jobId: job.id,
      sourceLabel:
        inputMode === "ringcentral_recording"
          ? "RingCentral recording"
          : "Public video URL submitted",
      status: "queued",
    });
  }

  return (
    <main className={styles.page}>
      <Hero />
      <section className={styles.content}>
        <InputSwitcher onChange={setInputMode} value={inputMode} />
        <div className={styles.workflowLayout}>
          <AnalyzeForm inputMode={inputMode} onJobCreated={handleJobCreated} />
          {jobState ? (
            <div className={styles.workflowPanels}>
              <StatusTimeline
                items={[
                  {
                    label: `Job ${jobState.jobId} is ${jobState.status} for analysis.`,
                    detail: "Backend events will replace this shell with live stage updates.",
                    state:
                      jobState.status === "failed"
                        ? "error"
                        : jobState.status === "complete"
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
                jobId={jobState.jobId}
                sourceLabel={jobState.sourceLabel}
              />
              <AITabs />
            </div>
          ) : (
            <section aria-label="Analysis workspace" className={styles.panel}>
              <h2 className={styles.panelTitle}>Analysis workspace</h2>
              <p className={styles.workspaceDescription}>
                Start an analysis to unlock status, video info, transcript, summary, mind map, and Ask AI panels.
              </p>
            </section>
          )}
        </div>
      </section>
    </main>
  );
}
