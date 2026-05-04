"use client";

import { type FormEvent, useState } from "react";

import styles from "../app/homepage.module.css";
import { createJob, type CreateJobResponse } from "../lib/api";
import type { InputMode } from "../lib/types";

type AnalyzeFormProps = {
  inputMode: InputMode;
  onJobCreated?: (job: CreateJobResponse) => void;
};

export function AnalyzeForm({
  inputMode,
  onJobCreated,
}: AnalyzeFormProps) {
  const [sourceUrl, setSourceUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!sourceUrl.trim()) {
      setFeedback("Paste a video URL to begin.");
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
      {inputMode === "ringcentral_recording" ? (
        <div className={styles.modeNotice}>
          <p className={styles.modeNoticeTitle}>RingCentral workspace</p>
          <p className={styles.modeNoticeBody}>
            RingCentral connection will be added in a later task.
          </p>
          <button
            className={styles.secondaryButton}
            disabled
            type="button"
          >
            Connect RingCentral (coming soon)
          </button>
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
          inputMode === "ringcentral_recording"
            ? "Paste a RingCentral recording URL"
            : "Paste a public video URL"
        }
        value={sourceUrl}
      />
      <button className={styles.primaryButton} disabled={isSubmitting} type="submit">
        {isSubmitting ? "Analyzing..." : "Analyze"}
      </button>
      {feedback ? (
        <p aria-live="polite" className={styles.formFeedback}>
          {feedback}
        </p>
      ) : null}
    </form>
  );
}
