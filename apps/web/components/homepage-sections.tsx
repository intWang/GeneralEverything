import styles from "../app/homepage.module.css";

const workflowSteps = [
  {
    description: "Paste a public video link to begin the analysis flow.",
    title: "Paste URL",
  },
  {
    description: "Create a job and start live processing in one click.",
    title: "Analyze",
  },
  {
    description: "Read the output workspace for transcript, summary, and QA.",
    title: "Review",
  },
];

const outputBlocks = [
  {
    description: "Searchable spoken content you can revisit without replaying the full video.",
    title: "Transcript",
  },
  {
    description: "A concise set of takeaways to speed up understanding.",
    title: "Summary",
  },
  {
    description:
      "Follow up with grounded questions after the first pass is complete.",
    title: "Ask AI",
  },
];

export function HomepageSections() {
  return (
    <section className={`${styles.content} ${styles.supportSections}`}>
      <div className={styles.supportGrid}>
        <section className={styles.supportSection} id="how-it-works">
          <h2 className={styles.supportHeading}>How it works</h2>
          <ol className={styles.supportList}>
            {workflowSteps.map((step) => (
              <li className={styles.supportItem} key={step.title}>
                <h3 className={styles.supportItemTitle}>{step.title}</h3>
                <p className={styles.supportCopy}>{step.description}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.supportSection} id="what-you-get">
          <h2 className={styles.supportHeading}>What you get</h2>
          <div className={styles.supportCards}>
            {outputBlocks.map((block) => (
              <article className={styles.supportCard} key={block.title}>
                <h3 className={styles.supportItemTitle}>{block.title}</h3>
                <p className={styles.supportCopy}>{block.description}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
