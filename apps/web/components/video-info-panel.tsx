import styles from "../app/homepage.module.css";

type VideoInfoPanelProps = {
  sourceLabel?: string;
};

export function VideoInfoPanel({
  sourceLabel = "No video selected yet",
}: VideoInfoPanelProps) {
  return (
    <section aria-label="Video information" className={styles.panel}>
      <h2 className={styles.panelTitle}>Video info</h2>
      <dl className={styles.infoGrid}>
        <div>
          <dt className={styles.infoLabel}>Source</dt>
          <dd className={styles.infoValue}>{sourceLabel}</dd>
        </div>
        <div>
          <dt className={styles.infoLabel}>Duration</dt>
          <dd className={styles.infoValue}>Pending analysis</dd>
        </div>
        <div>
          <dt className={styles.infoLabel}>Speaker count</dt>
          <dd className={styles.infoValue}>Pending analysis</dd>
        </div>
      </dl>
    </section>
  );
}
