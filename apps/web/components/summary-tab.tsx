import styles from "../app/homepage.module.css";

export type TabShellState =
  | "queued"
  | "processing"
  | "partial"
  | "complete"
  | "failed";

type SummaryTabProps = {
  shellState?: TabShellState;
  items?: readonly string[];
  keyPointsCount?: number | null;
  previewText?: string | null;
};

const DEFAULT_ITEMS = [
  "Rolling highlights appear after transcript segments stabilize.",
  "Each update should tighten the main takeaways instead of replacing the full panel.",
  "Later tasks will wire live summary deltas from the backend event stream.",
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
    title: "Summary is waiting for transcript context",
    body: "Summary stays idle until enough transcript windows are stable enough to condense into trustworthy takeaways.",
  },
  processing: {
    eyebrow: "Processing",
    title: "Summary is preparing its first pass",
    body: "GET is collecting enough transcript context to draft the first set of takeaways without overcommitting too early.",
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
  shellState = "queued",
  items = DEFAULT_ITEMS,
  keyPointsCount,
  previewText,
}: SummaryTabProps) {
  const copy = SHELL_COPY[shellState];

  return (
    <div>
      <p className={styles.tabStateLabel} data-state={shellState}>
        {copy.eyebrow}
      </p>
      <h3 className={styles.tabSectionTitle}>{copy.title}</h3>
      <p className={styles.tabSectionBody}>
        {copy.body}
      </p>
      {keyPointsCount !== null && keyPointsCount !== undefined ? (
        <ul className={styles.tabHintList}>
          <li className={styles.tabHintItem}>Key point shells ready: {keyPointsCount}</li>
          {previewText ? (
            <li className={styles.tabHintItem}>Preview: {previewText}</li>
          ) : null}
        </ul>
      ) : null}
      <ul className={styles.tabHintList}>
        {items.map((item) => (
          <li className={styles.tabHintItem} key={item}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
