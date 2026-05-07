"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import styles from "../app/homepage.module.css";
import {
  ApiError,
  submitJobQuestion,
  type SubmitJobQuestionResponse,
} from "../lib/api";

export type AskAiShellState = "queued" | "processing" | "complete" | "failed";

type AskAiTabProps = {
  jobId?: string;
  shellState?: AskAiShellState;
};

const SHELL_COPY: Record<
  AskAiShellState,
  {
    answerBody: string;
    answerTitle: string;
    body: string;
    canDraft: boolean;
    canSubmit: boolean;
    eyebrow: string;
    readyMessage: string;
    title: string;
  }
> = {
  queued: {
    answerBody:
      "Answers will appear here once the analysis has enough grounded context to answer safely.",
    answerTitle: "Answer placeholder",
    body: "Draft a question now, but submission stays locked until transcript coverage and a stable summary shell exist.",
    canDraft: true,
    canSubmit: false,
    eyebrow: "Queued",
    readyMessage:
      "Grounding unlocks after transcript coverage and a stable summary shell are available.",
    title: "Ask AI is waiting for grounded context",
  },
  processing: {
    answerBody:
      "The answer area stays blank while the shell is still tightening its grounding context.",
    answerTitle: "Answer placeholder",
    body: "Transcript context is available, but the analysis shell is still tightening summary and topic structure before Q&A can open.",
    canDraft: true,
    canSubmit: false,
    eyebrow: "Grounding",
    readyMessage:
      "Grounding is still shifting, so questions can be drafted but not submitted yet.",
    title: "Ask AI is preparing grounded answers",
  },
  complete: {
    answerBody:
      "Submit a question to reserve this panel for the grounded answer shell that a later task will hydrate.",
    answerTitle: "Answer placeholder",
    body: "Ask a question to preview where a grounded answer will appear once the real Q&A backend lands.",
    canDraft: true,
    canSubmit: true,
    eyebrow: "Ready",
    readyMessage: "Grounding source: finalized transcript and summary shells.",
    title: "Ask AI shell is ready for grounded follow-ups",
  },
  failed: {
    answerBody:
      "No grounded answer can be prepared from incomplete analysis data.",
    answerTitle: "Answer unavailable",
    body: "The Q&A shell stays disabled so it does not imply answers can be grounded to incomplete analysis data.",
    canDraft: false,
    canSubmit: false,
    eyebrow: "Failed",
    readyMessage:
      "Grounding is unavailable until this analysis is rerun successfully.",
    title: "Ask AI is blocked by the failed analysis run",
  },
};

const SUGGESTED_QUESTIONS = [
  "What are the key decisions?",
  "What follow-ups should I track?",
  "What should I review first?",
] as const;

export function AskAiTab({ jobId, shellState = "queued" }: AskAiTabProps) {
  const [question, setQuestion] = useState("");
  const [answerShell, setAnswerShell] = useState<SubmitJobQuestionResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const activeRequestIdRef = useRef(0);
  const copy = SHELL_COPY[shellState];
  const isReady = shellState === "complete";
  const canSubmit = copy.canSubmit && !!jobId && question.trim().length > 0 && !isSubmitting;

  useEffect(() => {
    activeRequestIdRef.current += 1;
    setAnswerShell(null);
    setQuestion("");
    setIsSubmitting(false);
    setSubmitError(null);
  }, [jobId]);

  useEffect(() => {
    activeRequestIdRef.current += 1;
    setAnswerShell(null);
    setIsSubmitting(false);
    setSubmitError(null);
  }, [shellState]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    const nextQuestion = question.trim();
    setSubmitError(null);
    setAnswerShell(null);
    setIsSubmitting(true);
    const requestId = activeRequestIdRef.current + 1;
    activeRequestIdRef.current = requestId;

    try {
      const response = await submitJobQuestion(jobId, nextQuestion);
      if (requestId !== activeRequestIdRef.current) {
        return;
      }
      setAnswerShell(response);
    } catch (error) {
      if (requestId !== activeRequestIdRef.current) {
        return;
      }
      setAnswerShell(null);
      if (
        error instanceof ApiError &&
        error.status === 409 &&
        error.detail === "Ask AI is not ready for grounded questions yet"
      ) {
        setSubmitError(
          "Grounded context is still settling. Try again after more transcript and summary data land.",
        );
      } else {
        setSubmitError("Unable to submit the grounded question right now.");
      }
    } finally {
      if (requestId === activeRequestIdRef.current) {
        setIsSubmitting(false);
      }
    }
  }

  function applySuggestedQuestion(nextQuestion: string) {
    if (!copy.canDraft || isSubmitting) {
      return;
    }

    setSubmitError(null);
    setQuestion(nextQuestion);
  }

  return (
    <div className={styles.askAiShell} data-job-id={jobId}>
      <p className={styles.tabStateLabel} data-state={shellState}>
        {copy.eyebrow}
      </p>
      <h3 className={styles.tabSectionTitle}>{copy.title}</h3>
      <p className={styles.tabSectionBody}>{copy.body}</p>
      <p className={styles.askAiStatus} data-ready={isReady}>
        {copy.readyMessage}
      </p>
      {copy.canDraft ? (
        <section
          aria-label="Suggested questions"
          className={styles.askAiSuggestions}
        >
          <p className={styles.askAiSuggestionLabel}>Suggested questions</p>
          <div className={styles.askAiSuggestionList}>
            {SUGGESTED_QUESTIONS.map((suggestedQuestion) => (
              <button
                className={styles.askAiSuggestionButton}
                disabled={isSubmitting}
                key={suggestedQuestion}
                onClick={() => applySuggestedQuestion(suggestedQuestion)}
                type="button"
              >
                {suggestedQuestion}
              </button>
            ))}
          </div>
        </section>
      ) : null}
      <form className={styles.askAiComposer} onSubmit={handleSubmit}>
        <label className={styles.askAiLabel} htmlFor="ask-ai-question">
          Ask a question
        </label>
        <div className={styles.askAiInputRow}>
          <input
            aria-label="Ask a question"
            className={styles.askAiInput}
            disabled={!copy.canDraft || isSubmitting}
            id="ask-ai-question"
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="What should I review next?"
            type="text"
            value={question}
          />
          <button
            className={styles.askAiButton}
            disabled={!canSubmit}
            type="submit"
          >
            {isSubmitting ? "Submitting..." : "Submit question"}
          </button>
        </div>
      </form>
      <section className={styles.askAiAnswerShell}>
        <h4 className={styles.askAiAnswerTitle}>{copy.answerTitle}</h4>
        {submitError ? (
          <p className={styles.formFeedback}>{submitError}</p>
        ) : null}
        <p className={styles.tabSectionBody}>
          {answerShell ? answerShell.answer : copy.answerBody}
        </p>
        {answerShell?.references.length ? (
          <div>
            <h5 className={styles.askAiAnswerTitle}>References</h5>
            <ul className={styles.tabHintList}>
              {answerShell.references.map((reference) => (
                <li className={styles.tabHintItem} key={reference}>
                  {reference}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}
