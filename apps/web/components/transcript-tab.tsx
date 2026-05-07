import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import styles from "../app/homepage.module.css";
import type { TabShellState } from "./summary-tab";

type TranscriptTabProps = {
  audioArtifactPath?: string | null;
  currentLanguageLabel?: string | null;
  detectedLanguageName?: string | null;
  extractor?: string | null;
  languageControl?: ReactNode;
  previewText?: string | null;
  sourceText?: string | null;
  segmentCount?: number | null;
  previewLines?: readonly string[];
  shellState?: TabShellState;
  translationStatusLabel?: string | null;
};

const DEFAULT_PREVIEW_LINES = [
  "[00:00] Transcript chunks will stream in after audio extraction starts.",
  "[00:18] Early lines may be refined as more context becomes available.",
  "[00:42] Finalized transcript segments will replace provisional text in a later task.",
] as const;

const SHELL_COPY: Record<
  TabShellState,
  {
    body: string;
    eyebrow: string;
    title: string;
  }
> = {
  queued: {
    eyebrow: "Queued",
    title: "Transcript is waiting for audio extraction",
    body: "Transcript stays empty until GET confirms the source, fetches the stream, and begins preparing audio for speech recognition.",
  },
  processing: {
    eyebrow: "Processing",
    title: "Transcript is decoding the first lines",
    body: "Audio has been extracted and the model is working through the first chunk. On longer videos, the first stable lines can take 30 to 90 seconds to appear.",
  },
  partial: {
    eyebrow: "Streaming",
    title: "Transcript is streaming live lines",
    body: "The first transcript segments are already available. New lines will continue to append while the rest of the recording is decoded.",
  },
  complete: {
    eyebrow: "Complete",
    title: "Transcript shell is ready for finalized segments",
    body: "This placeholder now reflects a finished transcript state and is ready for the real segment list in the next task.",
  },
  failed: {
    eyebrow: "Failed",
    title: "Transcript could not finish processing",
    body: "The transcript shell stays in a blocked state so the UI does not imply that stable lines are still on the way.",
  },
};

export function TranscriptTab({
  audioArtifactPath,
  currentLanguageLabel,
  detectedLanguageName,
  extractor,
  languageControl,
  previewText,
  sourceText,
  segmentCount,
  previewLines = DEFAULT_PREVIEW_LINES,
  shellState = "queued",
  translationStatusLabel,
}: TranscriptTabProps) {
  const copy = SHELL_COPY[shellState];
  const hasSourceText = Boolean(sourceText);
  const hasSegmentCount = segmentCount !== null && segmentCount !== undefined;
  const transcriptViewportRef = useRef<HTMLDivElement | null>(null);
  const transcriptTailRef = useRef<HTMLDivElement | null>(null);
  const previousLineCountRef = useRef(0);
  const highlightResetTimerRef = useRef<number | null>(null);
  const [autoScrollPaused, setAutoScrollPaused] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"copied" | "failed" | "idle">("idle");
  const [highlightedLineIndexes, setHighlightedLineIndexes] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const segmentStatusLabel = hasSegmentCount
    ? `${segmentCount} transcript segment${segmentCount === 1 ? "" : "s"} captured so far`
    : shellState === "processing"
      ? "Waiting for the first transcript segment"
      : null;
  const transcriptLines = sourceText ? sourceText.split("\n").filter(Boolean) : [];
  const indexedTranscriptLines = transcriptLines.map((line, index) => ({ index, line }));
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const visibleTranscriptLines = normalizedSearchQuery
    ? indexedTranscriptLines.filter(({ line }) =>
        line.toLowerCase().includes(normalizedSearchQuery),
      )
    : indexedTranscriptLines;
  const matchingLineCount = normalizedSearchQuery ? visibleTranscriptLines.length : null;

  useEffect(() => {
    if (shellState !== "partial" || !sourceText) {
      return;
    }

    if (autoScrollPaused) {
      return;
    }

    if (typeof transcriptTailRef.current?.scrollIntoView !== "function") {
      return;
    }

    transcriptTailRef.current.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [autoScrollPaused, segmentCount, shellState, sourceText]);

  useEffect(() => {
    const currentLineCount = transcriptLines.length;

    if (shellState !== "partial" || currentLineCount === 0) {
      previousLineCountRef.current = currentLineCount;
      setHighlightedLineIndexes([]);
      return;
    }

    const previousCount = previousLineCountRef.current;
    if (currentLineCount <= previousCount) {
      previousLineCountRef.current = currentLineCount;
      return;
    }

    const nextIndexes = Array.from(
      { length: Math.min(2, currentLineCount - previousCount) },
      (_, index) => currentLineCount - Math.min(2, currentLineCount - previousCount) + index,
    );
    previousLineCountRef.current = currentLineCount;
    setHighlightedLineIndexes(nextIndexes);

    if (highlightResetTimerRef.current !== null) {
      window.clearTimeout(highlightResetTimerRef.current);
    }

    highlightResetTimerRef.current = window.setTimeout(() => {
      setHighlightedLineIndexes([]);
      highlightResetTimerRef.current = null;
    }, 1800);
  }, [shellState, sourceText]);

  useEffect(() => {
    return () => {
      if (highlightResetTimerRef.current !== null) {
        window.clearTimeout(highlightResetTimerRef.current);
      }
    };
  }, []);

  function handleTranscriptScroll() {
    const viewport = transcriptViewportRef.current;
    if (!viewport) {
      return;
    }

    const distanceFromBottom =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    setAutoScrollPaused(distanceFromBottom > 32);
  }

  function jumpToLatest() {
    setAutoScrollPaused(false);
    if (typeof transcriptTailRef.current?.scrollIntoView === "function") {
      transcriptTailRef.current.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }
  }

  async function copyTranscriptToClipboard() {
    if (!sourceText || !navigator.clipboard?.writeText) {
      setCopyStatus("failed");
      return;
    }

    try {
      await navigator.clipboard.writeText(sourceText);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  }

  return (
    <div>
      {hasSourceText ? (
        <>
          <p className={styles.tabStateLabel} data-state={shellState}>
            {shellState === "partial" ? "Streaming transcript" : "Source transcript"}
          </p>
          <h3 className={styles.tabSectionTitle}>Transcript in the detected audio language</h3>
          {detectedLanguageName ? (
            <p className={styles.tabSectionBody}>Detected language: {detectedLanguageName}</p>
          ) : null}
          {segmentStatusLabel ? (
            <div className={styles.transcriptProgressCard}>
              <div className={styles.transcriptProgressHeader}>
                <span className={styles.transcriptProgressEyebrow}>Live progress</span>
                <span className={styles.transcriptProgressCount}>{segmentStatusLabel}</span>
              </div>
              <div className={styles.transcriptProgressTrack} aria-hidden="true">
                <span
                  className={styles.transcriptProgressFill}
                  style={{ width: `${Math.min(100, Math.max(14, (segmentCount ?? 0) * 6))}%` }}
                />
              </div>
            </div>
          ) : null}
          {languageControl}
          {currentLanguageLabel ? (
            <p className={styles.tabSectionBody}>Current language: {currentLanguageLabel}</p>
          ) : null}
          {translationStatusLabel ? (
            <p className={styles.tabSectionBody}>{translationStatusLabel}</p>
          ) : null}
          <div className={styles.transcriptActionRow}>
            <button
              className={styles.transcriptCopyButton}
              onClick={() => void copyTranscriptToClipboard()}
              type="button"
            >
              Copy transcript
            </button>
            {copyStatus === "copied" ? (
              <span className={styles.transcriptCopyStatus}>
                Transcript copied
              </span>
            ) : null}
            {copyStatus === "failed" ? (
              <span className={styles.transcriptCopyStatus}>
                Copy unavailable
              </span>
            ) : null}
          </div>
          <div className={styles.transcriptSearchRow}>
            <label className={styles.transcriptSearchLabel}>
              Search transcript
              <input
                aria-label="Search transcript"
                className={styles.transcriptSearchInput}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search transcript lines"
                type="search"
                value={searchQuery}
              />
            </label>
            {matchingLineCount !== null ? (
              <span className={styles.transcriptSearchMeta}>
                {matchingLineCount} matching line{matchingLineCount === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>
          {autoScrollPaused ? (
            <div className={styles.transcriptControls}>
              <p className={styles.transcriptPauseNote}>
                Auto-scroll paused while you read earlier transcript lines.
              </p>
              <button
                className={styles.transcriptJumpButton}
                onClick={jumpToLatest}
                type="button"
              >
                Jump to latest
              </button>
            </div>
          ) : null}
          <div
            className={styles.transcriptPreview}
            onScroll={handleTranscriptScroll}
            ref={transcriptViewportRef}
          >
            {visibleTranscriptLines.map(({ index, line }) => (
              <p
                className={styles.transcriptLine}
                data-recent={highlightedLineIndexes.includes(index) ? "true" : "false"}
                data-search-match={normalizedSearchQuery ? "true" : "false"}
                key={`${index}-${line}`}
              >
                {line}
              </p>
            ))}
            <div ref={transcriptTailRef} />
          </div>
        </>
      ) : (
        <>
          <p className={styles.tabStateLabel} data-state={shellState}>
            {copy.eyebrow}
          </p>
          <h3 className={styles.tabSectionTitle}>{copy.title}</h3>
          <p className={styles.tabSectionBody}>
            {copy.body}
          </p>
          {segmentStatusLabel ? (
            <div className={styles.transcriptProgressCard}>
              <div className={styles.transcriptProgressHeader}>
                <span className={styles.transcriptProgressEyebrow}>Live progress</span>
                <span className={styles.transcriptProgressCount}>{segmentStatusLabel}</span>
              </div>
              <div className={styles.transcriptProgressTrack} aria-hidden="true">
                <span
                  className={styles.transcriptProgressFill}
                  style={{ width: `${Math.min(100, Math.max(14, (segmentCount ?? 0) * 6))}%` }}
                />
              </div>
            </div>
          ) : null}
        </>
      )}
      {audioArtifactPath ? (
        <div className={styles.transcriptPreview}>
          <p className={styles.transcriptLine}>
            Audio artifact ready: {audioArtifactPath}
          </p>
          <p className={styles.transcriptLine}>
            Extractor: {extractor || "Pending extractor"}
          </p>
          {segmentCount !== null && segmentCount !== undefined ? (
            <p className={styles.transcriptLine}>
              Segment count: {segmentCount}
            </p>
          ) : null}
          {previewText ? (
            <p className={styles.transcriptLine}>
              Preview: {previewText}
            </p>
          ) : null}
        </div>
      ) : null}
      {!hasSourceText ? (
        <div className={styles.transcriptPreview}>
          {previewLines.map((line) => (
            <p className={styles.transcriptLine} key={line}>
              {line}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
