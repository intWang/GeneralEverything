import type { InputMode } from "../lib/types";
import styles from "../app/homepage.module.css";

type VideoInfoPanelProps = {
  detectedLanguageName?: string | null;
  description?: string | null;
  durationSeconds?: number | null;
  inputMode?: InputMode | null;
  jobId?: string;
  sourceName?: string | null;
  sourceUrl?: string | null;
  thumbnailUrl?: string | null;
  title?: string | null;
};

function formatDuration(durationSeconds?: number | null) {
  if (!durationSeconds || durationSeconds < 0) {
    return "Pending analysis";
  }

  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatPlatformLabel(sourceUrl?: string | null, inputMode?: InputMode | null) {
  if (inputMode === "ringcentral_recording") {
    return "RingCentral";
  }

  if (!sourceUrl) {
    return "Pending analysis";
  }

  try {
    const hostname = new URL(sourceUrl).hostname.replace(/^www\./, "");
    const [label] = hostname.split(".");
    if (!label) {
      return hostname;
    }

    return label.charAt(0).toUpperCase() + label.slice(1);
  } catch {
    return "Pending analysis";
  }
}

export function VideoInfoPanel({
  detectedLanguageName,
  description,
  durationSeconds,
  inputMode,
  jobId,
  sourceName,
  sourceUrl,
  thumbnailUrl,
  title,
}: VideoInfoPanelProps) {
  const sourceLabel = sourceName || sourceUrl || "Pending analysis";
  const platformLabel = formatPlatformLabel(sourceUrl, inputMode);

  return (
    <section aria-label="Video information" className={styles.panel}>
      <h2 className={styles.panelTitle}>Video info</h2>
      {thumbnailUrl ? (
        <img
          alt={title || "Video thumbnail"}
          src={thumbnailUrl}
          style={{
            borderRadius: "1rem",
            display: "block",
            marginBottom: "1rem",
            maxHeight: "12rem",
            objectFit: "cover",
            width: "100%",
          }}
        />
      ) : null}
      <dl className={styles.infoGrid}>
        {jobId ? (
          <div>
            <dt className={styles.infoLabel}>Job</dt>
            <dd className={styles.infoValue}>{jobId}</dd>
          </div>
        ) : null}
        <div>
          <dt className={styles.infoLabel}>Title</dt>
          <dd className={styles.infoValue}>{title || "Pending analysis"}</dd>
        </div>
        <div>
          <dt className={styles.infoLabel}>Source</dt>
          <dd className={styles.infoValue}>{sourceLabel}</dd>
        </div>
        <div>
          <dt className={styles.infoLabel}>Platform</dt>
          <dd className={styles.infoValue}>{platformLabel}</dd>
        </div>
        <div>
          <dt className={styles.infoLabel}>Duration</dt>
          <dd className={styles.infoValue}>{formatDuration(durationSeconds)}</dd>
        </div>
        <div>
          <dt className={styles.infoLabel}>Audio language</dt>
          <dd className={styles.infoValue}>
            {detectedLanguageName || "Detecting after transcription"}
          </dd>
        </div>
        <div>
          <dt className={styles.infoLabel}>Description</dt>
          <dd className={styles.infoValue}>{description || "Pending analysis"}</dd>
        </div>
      </dl>
    </section>
  );
}
