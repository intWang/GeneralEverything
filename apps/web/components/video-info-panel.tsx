import styles from "../app/homepage.module.css";

type VideoInfoPanelProps = {
  jobId?: string;
  sourceLabel?: string;
};

export function VideoInfoPanel({
  jobId,
  sourceLabel = "No video selected yet",
}: VideoInfoPanelProps) {
  return (
    <section aria-label="Video information" className={styles.panel}>
      <h2 className={styles.panelTitle}>Video info</h2>
      <dl className={styles.infoGrid}>
        {jobId ? (
          <div>
            <dt className={styles.infoLabel}>Job</dt>
            <dd className={styles.infoValue}>{jobId}</dd>
          </div>
        ) : null}
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
