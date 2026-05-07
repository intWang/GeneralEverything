"use client";

import { useEffect, useState } from "react";

import styles from "../app/homepage.module.css";
import { AskAiTab, type AskAiShellState } from "./ask-ai-tab";
import { MindMapTab } from "./mindmap-tab";
import { SummaryTab } from "./summary-tab";
import { TranscriptTab } from "./transcript-tab";
import { translateJobContent } from "../lib/api";
import { SUPPORTED_TRANSLATION_LANGUAGES } from "../lib/translation-languages";
import type { JobRecord, JobStatus } from "../lib/types";
import type { TabShellState } from "./summary-tab";

const DEFAULT_TABS = ["Summary", "Transcript", "Mind Map", "Ask AI"] as const;
const LANGUAGE_NAME_BY_CODE = Object.fromEntries(
  SUPPORTED_TRANSLATION_LANGUAGES.map((language) => [language.code, language.name]),
) as Record<string, string>;

type AITab = (typeof DEFAULT_TABS)[number];
type AnalysisCopyStatus = "copied" | "failed" | "idle";
type ReadinessState = "blocked" | "building" | "live" | "ready" | "waiting";

type AITabsProps = {
  activeJobId?: string;
  detectedLanguageName?: JobRecord["detected_language_name"];
  jobStage?: string;
  jobStatus?: JobStatus;
  mindmapNodeCount?: JobRecord["mindmap_node_count"];
  mindmapPreviewText?: JobRecord["mindmap_preview_text"];
  mindmapStatus?: JobRecord["mindmap_status"];
  summaryKeyPointsCount?: JobRecord["summary_key_points_count"];
  summaryPreviewText?: JobRecord["summary_preview_text"];
  summarySourceBullets?: JobRecord["summary_source_bullets"];
  summarySourceText?: JobRecord["summary_source_text"];
  summaryTranslations?: JobRecord["summary_translations"];
  summaryStatus?: JobRecord["summary_status"];
  transcriptAudioArtifactPath?: JobRecord["transcript_audio_artifact_path"];
  transcriptExtractor?: JobRecord["transcript_extractor"];
  transcriptPreviewText?: JobRecord["transcript_preview_text"];
  transcriptSourceText?: JobRecord["transcript_source_text"];
  transcriptTranslations?: JobRecord["transcript_translations"];
  transcriptSegmentCount?: JobRecord["transcript_segment_count"];
  transcriptStatus?: JobRecord["transcript_status"];
  tabs?: readonly AITab[];
};

type ProvisionalSummary = {
  keyPointsCount: number;
  sourceBullets: string[];
  sourceText: string;
};

function isLikelyCjkText(text: string): boolean {
  const cjkCharacterCount = Array.from(text).filter(
    (character) => character >= "\u4e00" && character <= "\u9fff",
  ).length;

  return cjkCharacterCount >= Math.max(2, Math.floor(text.length / 12));
}

function extractSummaryCandidates(transcriptSourceText: string): string[] {
  const candidates = transcriptSourceText
    .split(/\n+|(?<=[。！？.!?])\s*/)
    .map((item) => item.trim().replace(/[。！？.!?]+$/u, ""))
    .filter(Boolean);

  const uniqueCandidates: string[] = [];
  for (const candidate of candidates) {
    if (!uniqueCandidates.includes(candidate)) {
      uniqueCandidates.push(candidate);
    }

    if (uniqueCandidates.length === 3) {
      break;
    }
  }

  return uniqueCandidates;
}

function buildProvisionalSummary(
  transcriptSourceText?: string | null,
  transcriptSegmentCount?: number | null,
): ProvisionalSummary | null {
  if (!transcriptSourceText || (transcriptSegmentCount ?? 0) < 3) {
    return null;
  }

  const bullets = extractSummaryCandidates(transcriptSourceText);
  if (!bullets.length) {
    return null;
  }

  const cjkText = isLikelyCjkText(transcriptSourceText);
  const sourceText =
    bullets.length === 1
      ? cjkText
        ? `目前已经稳定识别到一条关键内容：${bullets[0]}。`
        : `A first stable takeaway is emerging: ${bullets[0]}.`
      : cjkText
        ? `目前已经稳定识别到这些早期要点：${bullets.slice(0, 2).join("；")}。`
        : `Early takeaways are emerging: ${bullets.slice(0, 2).join("; ")}.`;

  return {
    keyPointsCount: bullets.length,
    sourceBullets: bullets,
    sourceText,
  };
}

function deriveTabShellStates(
  jobStatus: JobStatus,
  jobStage?: string,
  transcriptSegmentCount?: number | null,
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

    if (jobStage === "transcript_generated") {
      return {
        summary: "queued",
        transcript: "partial",
        mindmap: "queued",
      };
    }

    if (jobStage === "summary_generated") {
      return {
        summary: "partial",
        transcript: "complete",
        mindmap: "queued",
      };
    }

    if (jobStage?.includes("transcript")) {
      return {
        summary: transcriptSegmentCount === 0 ? "processing" : "queued",
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
  transcriptSegmentCount?: JobRecord["transcript_segment_count"],
  summaryStatus?: JobRecord["summary_status"],
  mindmapStatus?: JobRecord["mindmap_status"],
): AskAiShellState {
  if (jobStatus === "completed") {
    return "complete";
  }

  if (jobStatus === "failed") {
    return "failed";
  }

  const qaIsReady =
    (transcriptSegmentCount ?? 0) >= 3 &&
    summaryStatus === "ready" &&
    mindmapStatus === "ready";

  if (qaIsReady) {
    return "complete";
  }

  if (jobStatus === "running") {
    if (jobStage?.includes("transcript")) {
      return "queued";
    }

    return "processing";
  }

  return "queued";
}

function toReadinessState(
  shellState: AskAiShellState | TabShellState,
): ReadinessState {
  if (shellState === "complete") {
    return "ready";
  }

  if (shellState === "partial") {
    return "live";
  }

  if (shellState === "processing") {
    return "building";
  }

  if (shellState === "failed") {
    return "blocked";
  }

  return "waiting";
}

function formatReadinessState(state: ReadinessState): string {
  return state[0].toUpperCase() + state.slice(1);
}

function formatMindMapBranchLabel(branch: string): string {
  if (!branch) {
    return branch;
  }

  return branch.charAt(0).toUpperCase() + branch.slice(1);
}

function extractMindMapBranches(previewText?: string | null): string[] {
  return previewText
    ? previewText
        .split(",")
        .map((branch) => branch.trim())
        .filter(Boolean)
        .slice(0, 6)
    : [];
}

function buildAnalysisBundleText({
  mindmapBranches,
  summaryBullets,
  summaryText,
  transcriptText,
}: {
  mindmapBranches?: readonly string[] | null;
  summaryBullets?: readonly string[] | null;
  summaryText?: string | null;
  transcriptText?: string | null;
}): string | null {
  const sections: string[] = [];

  if (summaryText) {
    const summaryLines = ["## Summary", summaryText];
    if (summaryBullets?.length) {
      summaryLines.push(
        "",
        "### Key points",
        ...summaryBullets.map((bullet) => `- ${bullet}`),
      );
    }
    sections.push(summaryLines.join("\n"));
  }

  if (transcriptText) {
    sections.push(["## Transcript", transcriptText].join("\n"));
  }

  const branches = mindmapBranches ?? [];
  if (branches.length) {
    sections.push(
      [
        "## Mind Map",
        ...branches.map((branch) => `- ${formatMindMapBranchLabel(branch)}`),
      ].join("\n"),
    );
  }

  return sections.length ? sections.join("\n\n") : null;
}

function buildAnalysisBundleDownloadHref(bundleText: string | null): string | null {
  return bundleText
    ? `data:text/markdown;charset=utf-8,${encodeURIComponent(bundleText)}`
    : null;
}

function buildAnalysisBundleFilename(activeJobId?: string): string {
  const safeJobId = activeJobId?.replace(/[^a-z0-9_-]/gi, "-").replace(/-+/g, "-");

  return safeJobId ? `get-analysis-${safeJobId}.md` : "get-analysis.md";
}

export function AITabs({
  activeJobId,
  detectedLanguageName,
  jobStage,
  jobStatus = "queued",
  mindmapNodeCount,
  mindmapPreviewText,
  mindmapStatus,
  summaryKeyPointsCount,
  summaryPreviewText,
  summarySourceBullets,
  summarySourceText,
  summaryTranslations: initialSummaryTranslations,
  summaryStatus,
  transcriptAudioArtifactPath,
  transcriptExtractor,
  transcriptPreviewText,
  transcriptSourceText,
  transcriptTranslations: initialTranscriptTranslations,
  transcriptSegmentCount,
  transcriptStatus,
  tabs = DEFAULT_TABS,
}: AITabsProps) {
  const [activeTab, setActiveTab] = useState<AITab>(tabs[0] ?? "Summary");
  const [summaryLanguage, setSummaryLanguage] = useState("original");
  const [transcriptLanguage, setTranscriptLanguage] = useState("original");
  const [summaryTranslations, setSummaryTranslations] = useState<Record<string, string>>(
    initialSummaryTranslations ?? {},
  );
  const [transcriptTranslations, setTranscriptTranslations] = useState<Record<string, string>>(
    initialTranscriptTranslations ?? {},
  );
  const [summaryIsTranslating, setSummaryIsTranslating] = useState(false);
  const [transcriptIsTranslating, setTranscriptIsTranslating] = useState(false);
  const [summaryBadgePulse, setSummaryBadgePulse] = useState(false);
  const [analysisCopyStatus, setAnalysisCopyStatus] =
    useState<AnalysisCopyStatus>("idle");
  const shellStates = deriveTabShellStates(jobStatus, jobStage, transcriptSegmentCount);
  const hasBackendPartialSummary = Boolean(summarySourceText && summaryStatus === "processing");
  const provisionalSummary = buildProvisionalSummary(
    summarySourceText ? null : transcriptSourceText,
    transcriptSegmentCount,
  );
  const effectiveSummarySourceText = summarySourceText ?? provisionalSummary?.sourceText ?? null;
  const effectiveSummarySourceBullets =
    summarySourceBullets ?? provisionalSummary?.sourceBullets ?? null;
  const effectiveSummaryKeyPointsCount =
    summaryKeyPointsCount ?? provisionalSummary?.keyPointsCount ?? null;
  const effectiveSummaryShellState =
    summaryStatus === "failed"
      ? "failed"
      : hasBackendPartialSummary
        ? "partial"
      : summarySourceText
        ? shellStates.summary
        : provisionalSummary
          ? "partial"
          : shellStates.summary;
  const hasLiveSummaryActivity =
    effectiveSummaryShellState === "processing" ||
    hasBackendPartialSummary ||
    Boolean(provisionalSummary && !summarySourceText);
  const askAiShellState = deriveAskAiShellState(
    jobStatus,
    jobStage,
    transcriptSegmentCount,
    summaryStatus,
    mindmapStatus,
  );
  const readinessItems = [
    {
      label: "Summary",
      state: toReadinessState(effectiveSummaryShellState),
    },
    {
      label: "Transcript",
      state: toReadinessState(
        transcriptStatus === "failed" ? "failed" : shellStates.transcript,
      ),
    },
    {
      label: "Mind Map",
      state: toReadinessState(
        mindmapStatus === "failed" ? "failed" : shellStates.mindmap,
      ),
    },
    {
      label: "Ask AI",
      state: toReadinessState(askAiShellState),
    },
  ];

  useEffect(() => {
    setSummaryLanguage("original");
    setTranscriptLanguage("original");
    setSummaryTranslations(initialSummaryTranslations ?? {});
    setTranscriptTranslations(initialTranscriptTranslations ?? {});
    setSummaryIsTranslating(false);
    setTranscriptIsTranslating(false);
  }, [activeJobId, initialSummaryTranslations, initialTranscriptTranslations]);

  async function handleTranslationChange(
    contentType: "summary" | "transcript",
    targetLanguageCode: string,
  ) {
    if (!activeJobId) {
      return;
    }

    if (contentType === "summary") {
      setSummaryLanguage(targetLanguageCode);
      if (targetLanguageCode === "original" || summaryTranslations[targetLanguageCode]) {
        return;
      }

      setSummaryIsTranslating(true);
      try {
        const response = await translateJobContent(activeJobId, "summary", targetLanguageCode);
        setSummaryTranslations((currentTranslations) => ({
          ...currentTranslations,
          [targetLanguageCode]: response.translated_text,
        }));
      } finally {
        setSummaryIsTranslating(false);
      }
      return;
    }

    setTranscriptLanguage(targetLanguageCode);
    if (targetLanguageCode === "original" || transcriptTranslations[targetLanguageCode]) {
      return;
    }

    setTranscriptIsTranslating(true);
    try {
      const response = await translateJobContent(activeJobId, "transcript", targetLanguageCode);
      setTranscriptTranslations((currentTranslations) => ({
        ...currentTranslations,
        [targetLanguageCode]: response.translated_text,
      }));
    } finally {
      setTranscriptIsTranslating(false);
    }
  }

  const summaryDisplayText =
    !effectiveSummarySourceText || summaryLanguage === "original"
      ? effectiveSummarySourceText
      : summaryTranslations[summaryLanguage] ??
        (summaryIsTranslating ? "Translating..." : effectiveSummarySourceText);
  const transcriptDisplayText =
    !transcriptSourceText || transcriptLanguage === "original"
      ? transcriptSourceText
      : transcriptTranslations[transcriptLanguage] ??
        (transcriptIsTranslating ? "Translating..." : transcriptSourceText);
  const summaryLanguageLabel =
    summaryLanguage === "original"
      ? detectedLanguageName || "Original"
      : LANGUAGE_NAME_BY_CODE[summaryLanguage] || summaryLanguage;
  const transcriptLanguageLabel =
    transcriptLanguage === "original"
      ? detectedLanguageName || "Original"
      : LANGUAGE_NAME_BY_CODE[transcriptLanguage] || transcriptLanguage;
  const analysisBundleText = buildAnalysisBundleText({
    mindmapBranches: extractMindMapBranches(mindmapPreviewText),
    summaryBullets: effectiveSummarySourceBullets,
    summaryText: summaryDisplayText,
    transcriptText: transcriptDisplayText,
  });
  const analysisBundleDownloadHref =
    buildAnalysisBundleDownloadHref(analysisBundleText);
  const analysisBundleFilename = buildAnalysisBundleFilename(activeJobId);

  useEffect(() => {
    setAnalysisCopyStatus("idle");
  }, [activeJobId, analysisBundleText]);

  async function copyAnalysisBundleToClipboard() {
    if (!analysisBundleText || !navigator.clipboard?.writeText) {
      setAnalysisCopyStatus("failed");
      return;
    }

    try {
      await navigator.clipboard.writeText(analysisBundleText);
      setAnalysisCopyStatus("copied");
    } catch {
      setAnalysisCopyStatus("failed");
    }
  }

  useEffect(() => {
    if (
      (!provisionalSummary && !hasBackendPartialSummary) ||
      summaryStatus === "ready" ||
      activeTab === "Summary"
    ) {
      setSummaryBadgePulse(false);
      return;
    }

    setSummaryBadgePulse(true);
    const timer = window.setTimeout(() => {
      setSummaryBadgePulse(false);
    }, 1800);

    return () => window.clearTimeout(timer);
  }, [
    activeTab,
    hasBackendPartialSummary,
    provisionalSummary,
    summarySourceText,
    summaryStatus,
    transcriptSegmentCount,
  ]);

  return (
    <section aria-label="AI analysis panels" className={styles.panel}>
      <h2 className={styles.panelTitle}>AI output</h2>
      <div aria-label="AI output readiness" className={styles.readinessGrid}>
        {readinessItems.map((item) => {
          const formattedState = formatReadinessState(item.state);

          return (
            <article
              aria-label={`${item.label} is ${item.state}`}
              className={styles.readinessCard}
              data-state={item.state}
              key={item.label}
            >
              <span className={styles.readinessLabel}>{item.label}</span>
              <strong className={styles.readinessState}>{formattedState}</strong>
            </article>
          );
        })}
      </div>
      {analysisBundleText ? (
        <div className={styles.analysisBundleRow}>
          <button
            className={styles.analysisBundleButton}
            onClick={() => void copyAnalysisBundleToClipboard()}
            type="button"
          >
            Copy analysis bundle
          </button>
          {analysisBundleDownloadHref ? (
            <a
              className={styles.analysisBundleDownloadLink}
              download={analysisBundleFilename}
              href={analysisBundleDownloadHref}
            >
              Download .md
            </a>
          ) : null}
          {analysisCopyStatus === "copied" ? (
            <span className={styles.analysisBundleStatus}>
              Analysis bundle copied
            </span>
          ) : null}
          {analysisCopyStatus === "failed" ? (
            <span className={styles.analysisBundleStatus}>Copy unavailable</span>
          ) : null}
        </div>
      ) : null}
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
              <span className={styles.tabButtonLabel}>
                {tab}
                {tab === "Summary" && hasLiveSummaryActivity ? (
                  <span
                    aria-label="Summary live badge"
                    className={styles.tabLiveBadge}
                    data-pulse={summaryBadgePulse ? "true" : "false"}
                  >
                    Live
                  </span>
                ) : null}
              </span>
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
          <SummaryTab
            items={
              jobStage === "summary_generated"
                ? [
                    "A summary shell preview is now available from the backend pipeline.",
                    "The current output is still lightweight and will later expand into richer summary sections and live updates.",
                    "Mind map and Ask AI can now build on persisted transcript and summary shells.",
                  ]
                : undefined
            }
            currentLanguageLabel={summaryLanguageLabel}
            isProvisional={Boolean(hasBackendPartialSummary || (provisionalSummary && !summarySourceText))}
            keyPointsCount={effectiveSummaryKeyPointsCount}
            languageControl={
              summarySourceText && !hasBackendPartialSummary ? (
                <label className={styles.infoLabel}>
                  Summary language
                  <select
                    aria-label="Summary language"
                    className={styles.historyButton}
                    onChange={(event) =>
                      void handleTranslationChange("summary", event.target.value)
                    }
                    value={summaryLanguage}
                  >
                    <option value="original">Original</option>
                    {SUPPORTED_TRANSLATION_LANGUAGES.map((language) => (
                      <option key={language.code} value={language.code}>
                        {language.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null
            }
            previewText={summaryPreviewText}
            provisionalLabel={
              hasBackendPartialSummary
                ? "This live summary is streaming from the backend and will hand off to the finalized summary when generation completes."
                : provisionalSummary && !summarySourceText
                ? "This early draft refreshes as transcript coverage grows, then hands off to the finalized summary."
                : null
            }
            provisionalMetaLabel={
              (hasBackendPartialSummary || (provisionalSummary && !summarySourceText)) &&
              transcriptSegmentCount
                ? `Based on ${transcriptSegmentCount} transcript segments captured so far.`
                : null
            }
            provisionalRefreshKey={
              hasBackendPartialSummary || (provisionalSummary && !summarySourceText)
                ? transcriptSegmentCount ?? null
                : null
            }
            sourceBullets={effectiveSummarySourceBullets}
            sourceText={summaryDisplayText}
            shellState={effectiveSummaryShellState}
            translationStatusLabel={
              summaryLanguage !== "original" && summaryIsTranslating
                ? "Translation in progress."
                : null
            }
          />
        ) : null}
        {activeTab === "Transcript" ? (
          <TranscriptTab
            audioArtifactPath={transcriptAudioArtifactPath}
            currentLanguageLabel={transcriptLanguageLabel}
            detectedLanguageName={detectedLanguageName}
            extractor={transcriptExtractor}
            languageControl={
              transcriptSourceText ? (
                <label className={styles.infoLabel}>
                  Transcript language
                  <select
                    aria-label="Transcript language"
                    className={styles.historyButton}
                    onChange={(event) =>
                      void handleTranslationChange("transcript", event.target.value)
                    }
                    value={transcriptLanguage}
                  >
                    <option value="original">Original</option>
                    {SUPPORTED_TRANSLATION_LANGUAGES.map((language) => (
                      <option key={language.code} value={language.code}>
                        {language.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null
            }
            previewLines={
              jobStage === "transcript_ready"
                ? [
                    "Audio extraction finished and the transcript worker shell is ready for speech recognition.",
                    "Transcript text has not been generated yet, but the audio artifact is now available to the next stage.",
                    "Summary and mind map remain queued until transcript generation starts.",
                  ]
                : jobStage === "transcript_generated"
                  ? [
                      "A transcript shell preview is now available from the backend pipeline.",
                      "The current output is still lightweight and will later grow into real segment-by-segment transcript content.",
                      "Summary and mind map can begin once richer transcript generation is wired in.",
                    ]
                : undefined
            }
            previewText={transcriptPreviewText}
            sourceText={transcriptDisplayText}
            segmentCount={transcriptSegmentCount}
            shellState={
              transcriptStatus === "failed" ? "failed" : shellStates.transcript
            }
            translationStatusLabel={
              transcriptLanguage !== "original" && transcriptIsTranslating
                ? "Translation in progress."
                : null
            }
          />
        ) : null}
        {activeTab === "Mind Map" ? (
          <MindMapTab
            branches={
              jobStage === "mindmap_generated"
                ? [
                    "Summary backbone",
                    "Key evidence clusters",
                    "Actionable takeaways",
                    "Follow-up questions",
                  ]
                : undefined
            }
            nodeCount={mindmapNodeCount}
            previewText={mindmapPreviewText}
            shellState={mindmapStatus === "failed" ? "failed" : shellStates.mindmap}
          />
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
