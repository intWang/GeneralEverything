import styles from "../app/homepage.module.css";

const highlightChips = [
  "Transcript-first",
  "Summary-ready",
  "Ask AI follow-up",
];

export function Hero() {
  return (
    <section className={styles.hero}>
      <div className={styles.heroGrid}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Video analysis for teams</p>
          <h1 className={styles.heroTitle}>
            Turn recordings into transcripts, summaries, and answers.
          </h1>
          <p className={styles.heroDescription}>
            Review meetings, training sessions, and internal video content in a
            workspace designed for faster understanding, clearer recaps, and
            grounded follow-up.
          </p>
          <div className={styles.heroActions}>
            <a
              className={`${styles.primaryButton} ${styles.buttonLink}`}
              href="#analysis-entry"
            >
              Start analysis
            </a>
            <a
              className={`${styles.secondaryButton} ${styles.secondaryButtonInline}`}
              href="#workflow"
            >
              See workflow
            </a>
          </div>
          <ul aria-label="Product highlights" className={styles.chipList}>
            {highlightChips.map((chip) => (
              <li className={styles.chipItem} key={chip}>
                {chip}
              </li>
            ))}
          </ul>
        </div>
        <section
          aria-label="Product preview"
          className={`${styles.panel} ${styles.previewShell}`}
        >
          <div className={styles.previewShellHeader}>
            <div>
              <p className={styles.previewShellEyebrow}>
                Weekly enablement review
              </p>
              <p className={styles.previewShellStatus}>
                Recording processed and ready for review
              </p>
            </div>
            <span className={styles.previewShellBadge}>
              Ready
            </span>
          </div>
          <div className={styles.previewCard}>
            <p className={`${styles.sectionLabel} ${styles.compactLabel}`}>
              Summary draft
            </p>
            <p className={styles.previewCardCopy}>
              The team aligned on rollout timing, flagged the open security
              review, and assigned customer enablement updates before launch.
            </p>
          </div>
          <div className={styles.previewCard}>
            <p className={`${styles.sectionLabel} ${styles.compactLabel}`}>
              Transcript snippet
            </p>
            <p className={styles.previewCardCopy}>
              "Support owns the revised training deck, and Maya will confirm SSO
              validation before the customer-facing recap goes out."
            </p>
          </div>
          <div className={styles.previewCard}>
            <p className={`${styles.sectionLabel} ${styles.compactLabel}`}>
              AI answer preview
            </p>
            <p className={styles.previewCardCopy}>
              Follow-up question: Which team owns the customer-ready update?
            </p>
            <p className={styles.previewCardAnswer}>
              Answer: Support owns the training deck refresh and will share the
              updated version after SSO validation is complete.
            </p>
          </div>
        </section>
      </div>
    </section>
  );
}
