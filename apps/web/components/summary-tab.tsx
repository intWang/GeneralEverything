import { useEffect, useState, type ReactNode } from "react";

import styles from "../app/homepage.module.css";

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
  translationStatusLabel?: string | null;
};

const DEFAULT_ITEMS = [
  "Rolling highlights appear after transcript segments stabilize.",
  "Each update should tighten the main takeaways instead of replacing the full panel.",
  "Later tasks will wire live summary deltas from the backend event stream.",
] as const;

const ACTION_PATTERN =
  /(将|將|安排|进行|進行|完成|准备|準備|同步|跟进|跟進|follow-up|next step|will|prepare|complete)/i;

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
  translationStatusLabel,
}: SummaryTabProps) {
  const copy = SHELL_COPY[shellState];
  const [recentBulletItems, setRecentBulletItems] = useState<string[]>([]);
  const [showRecentRefresh, setShowRecentRefresh] = useState(false);
  const hasSourceText = Boolean(sourceText);
  const hasSourceBullets = Boolean(sourceBullets?.length);
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
          <div className={styles.summaryCard}>
            <h4 className={styles.summaryCardTitle}>Summary</h4>
            <p className={styles.tabSectionBody}>{sourceText}</p>
          </div>
          {hasSourceBullets ? (
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
