import { useState } from "react";

import styles from "../app/homepage.module.css";
import type { MindMapNode } from "../lib/types";
import type { TabShellState } from "./summary-tab";

type MindMapTabProps = {
  branches?: readonly string[];
  nodes?: MindMapNode | null;
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

function buildMindMapClipboardText({
  centralIdea,
  branches,
}: {
  branches: readonly string[];
  centralIdea: string;
}) {
  return [
    "Central idea",
    centralIdea,
    "",
    "Branches",
    ...branches.map((branch) => `- ${formatBranchLabel(branch)}`),
  ].join("\n");
}

function flattenMindMapLabels(node: MindMapNode | null | undefined): string[] {
  if (!node) {
    return [];
  }

  return [
    node.label,
    ...(node.children ?? []).flatMap((child) => flattenMindMapLabels(child)),
  ];
}

function MindMapTreeNode({
  node,
  expandedNodeIds,
  level = 0,
  toggleNode,
}: {
  expandedNodeIds: ReadonlySet<string>;
  level?: number;
  node: MindMapNode;
  toggleNode: (nodeId: string) => void;
}) {
  const children = node.children ?? [];
  const references = node.references ?? [];
  const hasChildren = children.length > 0;
  const isExpanded = expandedNodeIds.has(node.id);

  return (
    <li className={styles.tabHintItem}>
      <div data-mindmap-level={level}>
        {hasChildren ? (
          <>
            <button
              aria-expanded={isExpanded}
              aria-label={`${isExpanded ? "Collapse" : "Expand"} ${node.label}`}
              className={styles.mindMapCopyButton}
              onClick={() => toggleNode(node.id)}
              type="button"
            >
              {isExpanded ? "Collapse" : "Expand"}
            </button>
            <strong>{node.label}</strong>
          </>
        ) : (
          <strong>{node.label}</strong>
        )}
        {node.summary ? <p className={styles.tabSectionBody}>{node.summary}</p> : null}
        {references.length ? (
          <div className={styles.mindMapActionRow}>
            {references.map((reference, index) => (
              <span className={styles.mindMapCopyStatus} key={`${node.id}-${index}`}>
                {reference.label ?? reference.segment_id ?? "Source reference"}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      {hasChildren && isExpanded ? (
        <ul className={styles.tabHintList}>
          {children.map((child) => (
            <MindMapTreeNode
              expandedNodeIds={expandedNodeIds}
              key={child.id}
              level={level + 1}
              node={child}
              toggleNode={toggleNode}
            />
          ))}
        </ul>
      ) : null}
    </li>
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
  nodes,
  nodeCount,
  previewText,
  shellState = "queued",
}: MindMapTabProps) {
  const copy = SHELL_COPY[shellState];
  const [copyStatus, setCopyStatus] = useState<"copied" | "failed" | "idle">("idle");
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(() => new Set());
  const treeLabels = flattenMindMapLabels(nodes).slice(1);
  const visualBranches = previewText
    ? previewText
        .split(",")
        .map((branch) => branch.trim())
        .filter(Boolean)
        .slice(0, 6)
    : Array.from(branches);
  const copyBranches = treeLabels.length ? treeLabels : visualBranches;
  const centralIdea = nodes?.label ?? (previewText ? "AI analysis" : "Summary backbone");

  function collectExpandedIds(node: MindMapNode | null | undefined, target: Set<string>) {
    if (!node) {
      return;
    }

    if (!collapsedNodeIds.has(node.id)) {
      target.add(node.id);
    }

    (node.children ?? []).forEach((child) => collectExpandedIds(child, target));
  }

  const treeExpandedNodeIds = new Set<string>();
  collectExpandedIds(nodes, treeExpandedNodeIds);

  function toggleNode(nodeId: string) {
    setCollapsedNodeIds((currentIds) => {
      const nextIds = new Set(currentIds);
      if (nextIds.has(nodeId)) {
        nextIds.delete(nodeId);
      } else {
        nextIds.add(nodeId);
      }

      return nextIds;
    });
  }

  async function copyMindMapToClipboard() {
    if (!navigator.clipboard?.writeText) {
      setCopyStatus("failed");
      return;
    }

    try {
      await navigator.clipboard.writeText(
        buildMindMapClipboardText({
          branches: copyBranches,
          centralIdea,
        }),
      );
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  }

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
          {!nodes && previewText ? (
            <li className={styles.tabHintItem}>Preview: {previewText}</li>
          ) : null}
        </ul>
      ) : null}
      {copyBranches.length ? (
        <div className={styles.mindMapActionRow}>
          <button
            className={styles.mindMapCopyButton}
            onClick={() => void copyMindMapToClipboard()}
            type="button"
          >
            Copy mind map
          </button>
          {copyStatus === "copied" ? (
            <span className={styles.mindMapCopyStatus}>Mind map copied</span>
          ) : null}
          {copyStatus === "failed" ? (
            <span className={styles.mindMapCopyStatus}>Copy unavailable</span>
          ) : null}
        </div>
      ) : null}
      {nodes ? (
        <ul aria-label="Structured mind map tree" className={styles.tabHintList}>
          <MindMapTreeNode
            expandedNodeIds={treeExpandedNodeIds}
            node={nodes}
            toggleNode={toggleNode}
          />
        </ul>
      ) : (
        <>
          <div aria-label="Mind map preview" className={styles.mindMapCanvas}>
            <div className={styles.mindMapCore}>
              <span className={styles.mindMapCoreLabel}>Central idea</span>
              <strong>{centralIdea}</strong>
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
        </>
      )}
    </div>
  );
}
