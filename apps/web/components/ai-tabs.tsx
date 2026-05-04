import styles from "../app/homepage.module.css";

const DEFAULT_TABS = ["Summary", "Chapters", "Action Items"] as const;

type AITabsProps = {
  tabs?: readonly string[];
};

export function AITabs({ tabs = DEFAULT_TABS }: AITabsProps) {
  return (
    <section aria-label="AI analysis panels" className={styles.panel}>
      <h2 className={styles.panelTitle}>AI output</h2>
      <div aria-label="Analysis tabs" className={styles.tabList} role="tablist">
        {tabs.map((tab, index) => (
          <button
            aria-selected={index === 0}
            className={styles.tabButton}
            key={tab}
            role="tab"
            type="button"
          >
            {tab}
          </button>
        ))}
      </div>
      <div className={styles.tabPanel} role="tabpanel">
        Summaries, chaptering, and follow-up actions will appear here in Task 10.
      </div>
    </section>
  );
}
