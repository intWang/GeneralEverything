import styles from "../app/homepage.module.css";
import type { TabShellState } from "./summary-tab";

type MindMapTabProps = {
  branches?: readonly string[];
  nodeCount?: number | null;
  previewText?: string | null;
  shellState?: TabShellState;
};

const DEFAULT_BRANCHES = [
  "Video intent",
  "Key topics",
  "Important references",
  "Open questions",
] as const;

function formatBranchLabel(branch: string) {
  if (!branch) {
    return branch;
  }

  return branch.charAt(0).toUpperCase() + branch.slice(1);
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
    title: "Mind map is waiting for stable summary structure",
    body: "The mind map stays empty until transcript and summary output settle enough to build a meaningful topic tree.",
  },
  processing: {
    eyebrow: "Processing",
    title: "Mind map is organizing stable themes",
    body: "GET is clustering the latest summary structure into a read-only topic tree, but the branch layout is still in flux.",
  },
  partial: {
    eyebrow: "Partial",
    title: "Mind map is revealing its first topic branches",
    body: "This shell shows the earliest stable branches while later tasks keep expanding the final tree.",
  },
  complete: {
    eyebrow: "Complete",
    title: "Mind map shell is ready for the final topic tree",
    body: "The completed job state unlocks the final read-only topic structure, which will be hydrated with real backend output later.",
  },
  failed: {
    eyebrow: "Failed",
    title: "Mind map is blocked by the failed analysis run",
    body: "This shell stays blocked because the upstream transcript and summary pipeline did not reach a stable enough state to organize topic branches.",
  },
};

export function MindMapTab({
  branches = DEFAULT_BRANCHES,
  nodeCount,
  previewText,
  shellState = "queued",
}: MindMapTabProps) {
  const copy = SHELL_COPY[shellState];
  const visualBranches = previewText
    ? previewText
        .split(",")
        .map((branch) => branch.trim())
        .filter(Boolean)
        .slice(0, 6)
    : Array.from(branches);

  return (
    <div>
      <p className={styles.tabStateLabel} data-state={shellState}>
        {copy.eyebrow}
      </p>
      <h3 className={styles.tabSectionTitle}>{copy.title}</h3>
      <p className={styles.tabSectionBody}>
        {copy.body}
      </p>
      {nodeCount !== null && nodeCount !== undefined ? (
        <ul className={styles.tabHintList}>
          <li className={styles.tabHintItem}>Mind map nodes ready: {nodeCount}</li>
          {previewText ? (
            <li className={styles.tabHintItem}>Preview: {previewText}</li>
          ) : null}
        </ul>
      ) : null}
      <div aria-label="Mind map preview" className={styles.mindMapCanvas}>
        <div className={styles.mindMapCore}>
          <span className={styles.mindMapCoreLabel}>Central idea</span>
          <strong>{previewText ? "AI analysis" : "Summary backbone"}</strong>
        </div>
        <div className={styles.mindMapBranchGrid}>
          {visualBranches.map((branch, index) => (
            <div className={styles.mindMapNode} data-node-index={index} key={branch}>
              <span className={styles.mindMapConnector} aria-hidden="true" />
              {formatBranchLabel(branch)}
            </div>
          ))}
        </div>
      </div>
      <ul className={styles.tabHintList}>
        {branches.map((branch) => (
          <li className={styles.tabHintItem} key={branch}>
            {branch}
          </li>
        ))}
      </ul>
    </div>
  );
}
