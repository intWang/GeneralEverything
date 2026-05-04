import styles from "../app/homepage.module.css";

export function AskAiTab() {
  return (
    <div>
      <h3 className={styles.tabSectionTitle}>Ask AI placeholder</h3>
      <p className={styles.tabSectionBody}>
        Ask AI remains a Task 12 surface. This tab stays visible for product continuity, but the real Q&A workflow and readiness rules are intentionally deferred.
      </p>
      <p className={styles.askAiStatus}>
        Ask AI shell only. Question input, grounding rules, and answer states will land in the next task.
      </p>
    </div>
  );
}
