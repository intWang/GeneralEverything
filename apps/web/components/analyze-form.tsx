"use client";

import { type FormEvent, useState } from "react";

import styles from "../app/homepage.module.css";
import {
  createJob,
  probeRingCentralAccess,
  type CreateJobResponse,
} from "../lib/api";
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
  const [isCheckingAccess, setIsCheckingAccess] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [accessFeedback, setAccessFeedback] = useState<{
    message: string;
    suggestion?: string;
  } | null>(null);
  const trimmedSourceUrl = sourceUrl.trim();
  const canCheckRingCentralAccess =
    isRingCentralMode && ringCentralIsReady && Boolean(trimmedSourceUrl);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!trimmedSourceUrl) {
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
      const job = await createJob(trimmedSourceUrl);
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

  async function handleCheckAccess() {
    if (!trimmedSourceUrl) {
      setAccessFeedback({ message: "Paste a RingCentral recording URL to check access." });
      return;
    }

    if (!canCheckRingCentralAccess) {
      setAccessFeedback({
        message: "RingCentral server authentication is required before checking access.",
      });
      return;
    }

    setIsCheckingAccess(true);
    setAccessFeedback(null);

    try {
      const probe = await probeRingCentralAccess(trimmedSourceUrl);
      if (probe.ok) {
        setAccessFeedback({
          message: "RingCentral access ready. You can analyze this recording.",
        });
      } else {
        setAccessFeedback({
          message:
            probe.diagnostic?.message ??
            "RingCentral access could not be confirmed.",
          suggestion: probe.diagnostic?.suggestion,
        });
      }
    } catch (error) {
      setAccessFeedback({
        message:
          error instanceof Error
            ? error.message
            : "RingCentral access could not be checked.",
      });
    } finally {
      setIsCheckingAccess(false);
    }
  }

  return (
    <form
      className={styles.formCard}
      data-probe-layout={canCheckRingCentralAccess ? "true" : "false"}
      onSubmit={handleSubmit}
    >
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
        onChange={(event) => {
          setSourceUrl(event.target.value);
          setAccessFeedback(null);
        }}
        placeholder={
          isRingCentralMode
            ? "Paste a RingCentral recording URL"
            : "Paste a public video URL"
        }
        value={sourceUrl}
      />
      {isRingCentralMode && ringCentralIsReady ? (
        <button
          className={`${styles.secondaryButton} ${styles.probeButton}`}
          disabled={!canCheckRingCentralAccess || isCheckingAccess || isSubmitting}
          onClick={handleCheckAccess}
          type="button"
        >
          {isCheckingAccess ? "Checking..." : "Check access"}
        </button>
      ) : null}
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
      {accessFeedback ? (
        <div aria-live="polite" className={styles.formFeedback}>
          <p className={styles.probeFeedbackMessage}>{accessFeedback.message}</p>
          {accessFeedback.suggestion ? (
            <p className={styles.probeFeedbackSuggestion}>{accessFeedback.suggestion}</p>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
