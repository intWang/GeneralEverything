"use client";

import { useState } from "react";
import type { FormEvent, MouseEvent } from "react";

import styles from "../app/homepage.module.css";
import type { JobRecord } from "../lib/types";

type JobHistoryPanelProps = {
  activeJobId?: string | null;
  jobs: JobRecord[];
  onDelete: (jobId: string) => Promise<void>;
  onRename: (jobId: string, title: string) => Promise<void>;
  onRetry: (jobId: string) => Promise<void>;
  onSelect: (jobId: string) => void;
};

function getJobLabel(job: JobRecord) {
  return job.title?.trim() || `job ${job.id}`;
}

export function JobHistoryPanel({
  activeJobId,
  jobs,
  onDelete,
  onRename,
  onRetry,
  onSelect,
}: JobHistoryPanelProps) {
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  function stopRowSelection(event: MouseEvent) {
    event.stopPropagation();
  }

  function startRename(job: JobRecord) {
    setEditingJobId(job.id);
    setDraftTitle(job.title?.trim() || "");
    setFeedback(null);
  }

  async function handleRenameSubmit(event: FormEvent<HTMLFormElement>, jobId: string) {
    event.preventDefault();
    event.stopPropagation();

    const nextTitle = draftTitle.trim();
    if (!nextTitle) {
      setFeedback("Enter a title before saving.");
      return;
    }

    setPendingAction(`rename:${jobId}`);
    setFeedback(null);
    try {
      await onRename(jobId, nextTitle);
      setEditingJobId(null);
      setDraftTitle("");
    } catch {
      setFeedback("Unable to rename this job.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleRetry(event: MouseEvent<HTMLButtonElement>, jobId: string) {
    stopRowSelection(event);
    setPendingAction(`retry:${jobId}`);
    setFeedback(null);
    try {
      await onRetry(jobId);
    } catch {
      setFeedback("Unable to retry this job.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleDelete(event: MouseEvent<HTMLButtonElement>, jobId: string) {
    stopRowSelection(event);
    setPendingAction(`delete:${jobId}`);
    setFeedback(null);
    try {
      await onDelete(jobId);
    } catch {
      setFeedback("Unable to delete this job.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <section
      aria-label="Recent jobs"
      className={`${styles.panel} ${styles.recentJobsPanel}`}
    >
      <h2 className={styles.panelTitle}>Recent jobs</h2>
      {jobs.length > 0 ? (
        <ul className={styles.historyList}>
          {jobs.map((job) => {
            const jobLabel = getJobLabel(job);
            const isEditing = editingJobId === job.id;

            return (
              <li key={job.id}>
                <button
                  aria-pressed={activeJobId === job.id}
                  className={styles.historyButton}
                  onClick={() => onSelect(job.id)}
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
                {isEditing ? (
                  <form
                    className={styles.historyInlineForm}
                    onClick={(event) => event.stopPropagation()}
                    onSubmit={(event) => handleRenameSubmit(event, job.id)}
                  >
                    <label className={styles.fieldLabel} htmlFor={`rename-job-${job.id}`}>
                      Rename job
                    </label>
                    <input
                      aria-label="Rename job"
                      className={styles.historyTextInput}
                      id={`rename-job-${job.id}`}
                      onChange={(event) => setDraftTitle(event.target.value)}
                      value={draftTitle}
                    />
                    <button
                      aria-label="Save job name"
                      className={styles.primaryButton}
                      disabled={pendingAction === `rename:${job.id}`}
                      type="submit"
                    >
                      Save
                    </button>
                    <button
                      className={styles.secondaryButton}
                      onClick={() => {
                        setEditingJobId(null);
                        setDraftTitle("");
                      }}
                      type="button"
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <div className={styles.historyActions}>
                    <button
                      aria-label={`Rename ${jobLabel}`}
                      className={styles.secondaryButton}
                      onClick={(event) => {
                        stopRowSelection(event);
                        startRename(job);
                      }}
                      type="button"
                    >
                      Rename
                    </button>
                    <button
                      aria-label={`Retry ${jobLabel}`}
                      className={styles.secondaryButton}
                      disabled={pendingAction === `retry:${job.id}`}
                      onClick={(event) => handleRetry(event, job.id)}
                      type="button"
                    >
                      Retry
                    </button>
                    <button
                      aria-label={`Delete ${jobLabel}`}
                      className={styles.secondaryButton}
                      disabled={pendingAction === `delete:${job.id}`}
                      onClick={(event) => handleDelete(event, job.id)}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={styles.workspaceDescription}>
          Completed and in-flight jobs will appear here once created.
        </p>
      )}
      {feedback ? <p className={styles.formFeedback}>{feedback}</p> : null}
    </section>
  );
}
