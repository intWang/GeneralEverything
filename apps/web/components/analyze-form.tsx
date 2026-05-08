"use client";

import { type FormEvent, useState } from "react";

import styles from "../app/homepage.module.css";
import { createJob, type CreateJobResponse } from "../lib/api";
import type { InputMode, InputModeCapability } from "../lib/types";

type AnalyzeFormProps = {
  capabilityStatus?: "error" | "loading" | "ready";
  inputMode: InputMode;
  onJobCreated?: (job: CreateJobResponse) => void;
  ringCentralCapability?: InputModeCapability | null;
};

export function AnalyzeForm({
  capabilityStatus = "ready",
  inputMode,
  onJobCreated,
  ringCentralCapability = null,
}: AnalyzeFormProps) {
  const isRingCentralMode = inputMode === "ringcentral_recording";
  const ringCentralIsReady = Boolean(ringCentralCapability?.enabled);
  const ringCentralIsLoading = isRingCentralMode && capabilityStatus === "loading";
  const ringCentralIsBlocked = isRingCentralMode && !ringCentralIsReady;
  const [sourceUrl, setSourceUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!sourceUrl.trim()) {
      setFeedback("Paste a video URL to begin.");
      return;
    }

    if (ringCentralIsBlocked) {
      setFeedback("RingCentral authentication is required before analysis can start.");
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const job = await createJob(sourceUrl.trim());
      setFeedback("Analysis requested. Live status will appear below.");
      onJobCreated?.(job);
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "Failed to create job",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className={styles.formCard} onSubmit={handleSubmit}>
      {isRingCentralMode ? (
        <div className={styles.modeNotice}>
          <p className={styles.modeNoticeTitle}>RingCentral workspace</p>
          <p className={styles.modeNoticeBody}>
            {ringCentralIsLoading
              ? "Checking whether the API server has RingCentral recording access..."
              : ringCentralCapability?.message ??
                "RingCentral authentication is required before analysis can start."}
          </p>
          <p className={styles.modeNoticeBody}>
            {capabilityStatus === "error"
              ? "GET could not load the server capability status. Public video mode is still available."
              : ringCentralCapability?.suggestion ??
                "Configure RingCentral cookies on the API server, then retry."}
          </p>
          <span className={styles.modeNoticeStatus}>
            {ringCentralIsReady ? "Server auth ready" : "Server auth required"}
          </span>
        </div>
      ) : null}
      <label className={styles.fieldLabel} htmlFor="source-url">
        Video source
      </label>
      <input
        className={styles.textInput}
        id="source-url"
        name="sourceUrl"
        onChange={(event) => setSourceUrl(event.target.value)}
        placeholder={
          isRingCentralMode
            ? "Paste a RingCentral recording URL"
            : "Paste a public video URL"
        }
        value={sourceUrl}
      />
      <button
        aria-label={
          isRingCentralMode
            ? ringCentralIsReady
              ? "Analyze RingCentral recording"
              : "Analyze (blocked until RingCentral auth is available)"
            : "Analyze"
        }
        className={styles.primaryButton}
        disabled={isSubmitting || ringCentralIsBlocked}
        type="submit"
      >
        {isRingCentralMode
          ? isSubmitting
            ? "Analyzing..."
            : "Analyze"
          : isSubmitting
            ? "Analyzing..."
            : "Analyze"}
      </button>
      {feedback ? (
        <p aria-live="polite" className={styles.formFeedback}>
          {feedback}
        </p>
      ) : null}
    </form>
  );
}
