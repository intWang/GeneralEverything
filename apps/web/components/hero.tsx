import styles from "../app/homepage.module.css";

export function Hero() {
  return (
    <section className={styles.hero}>
      <p className={styles.eyebrow}>Dual-source analysis</p>
      <div className={styles.heroCopy}>
        <h1 className={styles.heroTitle}>
          Start with a public video or a RingCentral recording.
        </h1>
        <p className={styles.heroDescription}>
          This homepage shell keeps the entry point simple now, with room for
          the analysis workflow and results workspace in later tasks.
        </p>
      </div>
    </section>
  );
}
