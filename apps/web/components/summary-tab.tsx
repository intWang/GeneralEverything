import { useEffect, useState, type ReactNode } from "react";

import styles from "../app/homepage.module.css";
import type { StructuredSummary, StructuredSummaryItem } from "../lib/types";

export type TabShellState =
  | "queued"
  | "processing"
  | "partial"
  | "complete"
  | "failed";

type SummaryTabProps = {
  currentLanguageLabel?: string | null;
  isProvisional?: boolean;
  provisionalMetaLabel?: string | null;
  shellState?: TabShellState;
  items?: readonly string[];
  keyPointsCount?: number | null;
  languageControl?: ReactNode;
  previewText?: string | null;
  provisionalLabel?: string | null;
  provisionalRefreshKey?: number | string | null;
  sourceBullets?: readonly string[] | null;
  sourceText?: string | null;
  structuredSummary?: StructuredSummary | null;
  translationStatusLabel?: string | null;
};

const DEFAULT_ITEMS = [
  "Rolling highlights appear after transcript segments stabilize.",
  "Each update should tighten the main takeaways instead of replacing the full panel.",
  "Later tasks will wire live summary deltas from the backend event stream.",
] as const;

const ACTION_PATTERN =
  /(将|將|安排|进行|進行|完成|准备|準備|同步|跟进|跟進|follow-up|next step|will|prepare|complete)/i;

function buildSummaryClipboardText({
  actions,
  decisions,
  other,
  sourceText,
}: {
  actions: string[];
  decisions: string[];
  other: string[];
  sourceText: string;
}) {
  const sections = [["Brief", sourceText]];

  if (decisions.length) {
    sections.push(["Decisions", ...decisions.map((item) => `- ${item}`)]);
  }

  if (actions.length) {
    sections.push(["Actions", ...actions.map((item) => `- ${item}`)]);
  }

  if (!decisions.length && !actions.length && other.length) {
    sections.push(["Key points", ...other.map((item) => `- ${item}`)]);
  }

  return sections.map((section) => section.join("\n")).join("\n\n");
}

function formatTimestamp(totalSeconds?: number | null) {
  if (typeof totalSeconds !== "number") {
    return null;
  }

  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

function getCitationLabel(
  citationId: string,
  structuredSummary?: StructuredSummary | null,
) {
  const citation = structuredSummary?.citations?.find((item) => item.id === citationId);

  return citation?.label ?? formatTimestamp(citation?.start_seconds) ?? citationId;
}

function SummaryItemWithCitations({
  item,
  structuredSummary,
}: {
  item: StructuredSummaryItem;
  structuredSummary?: StructuredSummary | null;
}) {
  const citationIds = item.citation_ids ?? [];

  return (
    <>
      <span>{item.text}</span>
      {citationIds.length ? (
        <span className={styles.summaryRefreshRow}>
          {citationIds.map((citationId) => (
            <span
              aria-label={`Citation ${getCitationLabel(citationId, structuredSummary)}`}
              className={styles.summaryRefreshBadge}
              key={citationId}
            >
              {getCitationLabel(citationId, structuredSummary)}
            </span>
          ))}
        </span>
      ) : null}
    </>
  );
}

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
    title: "Summary is waiting for transcript context",
    body: "Summary stays idle until enough transcript windows are stable enough to condense into trustworthy takeaways.",
  },
  processing: {
    eyebrow: "Processing",
    title: "Summary is waiting for the first transcript segments",
    body: "The first stable transcript lines will unlock the live summary draft.",
  },
  partial: {
    eyebrow: "Partial",
    title: "Summary is growing with each stable transcript window",
    body: "These summary shells represent provisional highlights that will keep tightening as more of the recording becomes reliable.",
  },
  complete: {
    eyebrow: "Complete",
    title: "Summary shell is ready for finalized takeaways",
    body: "The full summary view will be filled by live backend output in the next task, but this shell now reflects a completed job state.",
  },
  failed: {
    eyebrow: "Failed",
    title: "Summary is blocked until the job can resume",
    body: "GET could not safely reach the summary stage, so this shell stays blocked instead of pretending that downstream takeaways are queued normally.",
  },
};

export function SummaryTab({
  currentLanguageLabel,
  isProvisional = false,
  provisionalMetaLabel,
  shellState = "queued",
  items = DEFAULT_ITEMS,
  keyPointsCount,
  languageControl,
  previewText,
  provisionalLabel,
  provisionalRefreshKey,
  sourceBullets,
  sourceText,
  structuredSummary,
  translationStatusLabel,
}: SummaryTabProps) {
  const copy = SHELL_COPY[shellState];
  const [recentBulletItems, setRecentBulletItems] = useState<string[]>([]);
  const [showRecentRefresh, setShowRecentRefresh] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"copied" | "failed" | "idle">("idle");
  const effectiveSourceText = sourceText ?? structuredSummary?.abstract;
  const hasStructuredSummary = Boolean(
    structuredSummary &&
      (structuredSummary.abstract ||
        structuredSummary.action_items?.length ||
        structuredSummary.decisions?.length ||
        structuredSummary.key_points?.length ||
        structuredSummary.risks?.length),
  );
  const hasSourceText = Boolean(effectiveSourceText);
  const hasSourceBullets = Boolean(sourceBullets?.length);
  const structuredActionItems = structuredSummary?.action_items ?? [];
  const structuredDecisions = structuredSummary?.decisions ?? [];
  const structuredRisks = structuredSummary?.risks ?? [];
  const structuredKeyPoints = structuredSummary?.key_points ?? [];
  const trackedPointCount =
    keyPointsCount ??
    (hasStructuredSummary ? structuredKeyPoints.length : sourceBullets?.length ?? 0);
  const groupedBullets = (sourceBullets ?? []).reduce<{
    actions: string[];
    decisions: string[];
    other: string[];
  }>(
    (groups, item) => {
      if (ACTION_PATTERN.test(item)) {
        groups.actions.push(item);
        return groups;
      }

      if (item) {
        groups.decisions.push(item);
        return groups;
      }

      groups.other.push(item);
      return groups;
    },
    { actions: [], decisions: [], other: [] },
  );

  useEffect(() => {
    if (!isProvisional || !provisionalRefreshKey) {
      setShowRecentRefresh(false);
      return;
    }

    setShowRecentRefresh(true);
    const timer = window.setTimeout(() => {
      setShowRecentRefresh(false);
    }, 2200);

    return () => window.clearTimeout(timer);
  }, [isProvisional, provisionalRefreshKey]);

  useEffect(() => {
    if (!isProvisional || !sourceBullets?.length) {
      setRecentBulletItems([]);
      return;
    }

    const newestBulletItems = sourceBullets.slice(-2);
    setRecentBulletItems(newestBulletItems);

    const timer = window.setTimeout(() => {
      setRecentBulletItems([]);
    }, 2200);

    return () => window.clearTimeout(timer);
  }, [isProvisional, provisionalRefreshKey, sourceBullets]);

  async function copySummaryToClipboard() {
    if (!effectiveSourceText || !navigator.clipboard?.writeText) {
      setCopyStatus("failed");
      return;
    }

    const clipboardText = buildSummaryClipboardText({
      actions: hasStructuredSummary
        ? structuredActionItems.map((item) => item.text)
        : groupedBullets.actions,
      decisions: hasStructuredSummary
        ? structuredDecisions.map((item) => item.text)
        : groupedBullets.decisions,
      other: hasStructuredSummary
        ? structuredKeyPoints.map((item) => item.text)
        : groupedBullets.other,
      sourceText: effectiveSourceText,
    });

    try {
      await navigator.clipboard.writeText(clipboardText);
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
            {isProvisional ? "Live summary draft" : "Source summary"}
          </p>
          <h3 className={styles.tabSectionTitle}>
            {isProvisional
              ? "Summary is tightening as transcript lines arrive"
              : "Summary in the detected audio language"}
          </h3>
          {languageControl}
          {currentLanguageLabel ? (
            <p className={styles.tabSectionBody}>Current language: {currentLanguageLabel}</p>
          ) : null}
          {translationStatusLabel ? (
            <p className={styles.tabSectionBody}>{translationStatusLabel}</p>
          ) : null}
          <div className={styles.summaryActionRow}>
            <button
              className={styles.summaryCopyButton}
              onClick={() => void copySummaryToClipboard()}
              type="button"
            >
              Copy summary
            </button>
            {copyStatus === "copied" ? (
              <span className={styles.summaryCopyStatus}>Summary copied</span>
            ) : null}
            {copyStatus === "failed" ? (
              <span className={styles.summaryCopyStatus}>
                Copy unavailable
              </span>
            ) : null}
          </div>
          {provisionalLabel ? (
            <p className={styles.tabSectionBody}>{provisionalLabel}</p>
          ) : null}
          {isProvisional && (provisionalMetaLabel || showRecentRefresh) ? (
            <div className={styles.summaryRefreshRow}>
              {provisionalMetaLabel ? (
                <p className={styles.summaryRefreshMeta}>{provisionalMetaLabel}</p>
              ) : null}
              {showRecentRefresh ? (
                <span className={styles.summaryRefreshBadge}>Updated just now</span>
              ) : null}
            </div>
          ) : null}
          <div className={styles.summaryInsightGrid} aria-label="Structured summary">
            <article className={styles.summaryInsightCard}>
              <span className={styles.summaryInsightKicker}>Brief</span>
              <p className={styles.summaryInsightMetric}>{trackedPointCount}</p>
              <p className={styles.summaryInsightText}>tracked points</p>
            </article>
            <article className={styles.summaryInsightCard}>
              <span className={styles.summaryInsightKicker}>Key takeaways</span>
              <p className={styles.summaryInsightMetric}>
                {hasStructuredSummary ? structuredDecisions.length : groupedBullets.decisions.length}
              </p>
              <p className={styles.summaryInsightText}>decisions and facts</p>
            </article>
            <article className={styles.summaryInsightCard}>
              <span className={styles.summaryInsightKicker}>Action items</span>
              <p className={styles.summaryInsightMetric}>
                {hasStructuredSummary ? structuredActionItems.length : groupedBullets.actions.length}
              </p>
              <p className={styles.summaryInsightText}>follow-ups detected</p>
            </article>
          </div>
          <div className={styles.summaryCard}>
            <h4 className={styles.summaryCardTitle}>Brief</h4>
            <p className={styles.tabSectionBody}>{effectiveSourceText}</p>
          </div>
          {hasStructuredSummary ? (
            <div className={styles.summaryCard}>
              {structuredDecisions.length ? (
                <div className={styles.summaryGroup}>
                  <h4 className={styles.summaryCardTitle}>Decisions</h4>
                  <ul className={styles.tabHintList}>
                    {structuredDecisions.map((item) => (
                      <li className={styles.tabHintItem} key={item.text}>
                        <SummaryItemWithCitations
                          item={item}
                          structuredSummary={structuredSummary}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {structuredActionItems.length ? (
                <div className={styles.summaryGroup}>
                  <h4 className={styles.summaryCardTitle}>Action items</h4>
                  <ul className={styles.tabHintList}>
                    {structuredActionItems.map((item) => (
                      <li className={styles.tabHintItem} key={item.text}>
                        <SummaryItemWithCitations
                          item={item}
                          structuredSummary={structuredSummary}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {structuredRisks.length ? (
                <div className={styles.summaryGroup}>
                  <h4 className={styles.summaryCardTitle}>Risks</h4>
                  <ul className={styles.tabHintList}>
                    {structuredRisks.map((item) => (
                      <li className={styles.tabHintItem} key={item.text}>
                        <SummaryItemWithCitations
                          item={item}
                          structuredSummary={structuredSummary}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {!structuredDecisions.length &&
              !structuredActionItems.length &&
              !structuredRisks.length &&
              structuredKeyPoints.length ? (
                <div className={styles.summaryGroup}>
                  <h4 className={styles.summaryCardTitle}>Key points</h4>
                  <ul className={styles.tabHintList}>
                    {structuredKeyPoints.map((item) => (
                      <li className={styles.tabHintItem} key={item.text}>
                        <SummaryItemWithCitations
                          item={item}
                          structuredSummary={structuredSummary}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : hasSourceBullets ? (
            <div className={styles.summaryCard}>
              {groupedBullets.decisions.length ? (
                <div className={styles.summaryGroup}>
                  <h4 className={styles.summaryCardTitle}>Decisions</h4>
                  <ul className={styles.tabHintList}>
                    {groupedBullets.decisions.map((item) => (
                      <li
                        className={styles.tabHintItem}
                        data-recent={recentBulletItems.includes(item) ? "true" : "false"}
                        key={item}
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {groupedBullets.actions.length ? (
                <div className={styles.summaryGroup}>
                  <h4 className={styles.summaryCardTitle}>Actions</h4>
                  <ul className={styles.tabHintList}>
                    {groupedBullets.actions.map((item) => (
                      <li
                        className={styles.tabHintItem}
                        data-recent={recentBulletItems.includes(item) ? "true" : "false"}
                        key={item}
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {!groupedBullets.decisions.length && !groupedBullets.actions.length ? (
                <div className={styles.summaryGroup}>
                  <h4 className={styles.summaryCardTitle}>Key points</h4>
                  <ul className={styles.tabHintList}>
                    {groupedBullets.other.map((item) => (
                      <li
                        className={styles.tabHintItem}
                        data-recent={recentBulletItems.includes(item) ? "true" : "false"}
                        key={item}
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
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
          {shellState === "processing" ? (
            <div className={styles.summaryProgressCard}>
              <div className={styles.summaryProgressHeader}>
                <span className={styles.summaryProgressEyebrow}>Live progress</span>
                <span className={styles.summaryProgressCount}>
                  Waiting for the first transcript segments
                </span>
              </div>
            </div>
          ) : null}
        </>
      )}
      {keyPointsCount !== null && keyPointsCount !== undefined ? (
        <ul className={styles.tabHintList}>
          <li className={styles.tabHintItem}>Key point shells ready: {keyPointsCount}</li>
          {previewText && !hasSourceText ? (
            <li className={styles.tabHintItem}>Preview: {previewText}</li>
          ) : null}
        </ul>
      ) : null}
      {!hasSourceText ? (
        <ul className={styles.tabHintList}>
          {items.map((item) => (
            <li className={styles.tabHintItem} key={item}>
              {item}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
