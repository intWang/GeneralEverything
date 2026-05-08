import type { Diagnostic, DownloadFormat, DownloadProgress, InputMode } from "../lib/types";
import styles from "../app/homepage.module.css";

type VideoInfoPanelProps = {
  detectedLanguageName?: string | null;
  description?: string | null;
  diagnostics?: Diagnostic[] | null;
  downloadFormats?: DownloadFormat[] | null;
  downloadProgress?: DownloadProgress | null;
  durationSeconds?: number | null;
  inputMode?: InputMode | null;
  jobId?: string;
  sourceName?: string | null;
  sourceUrl?: string | null;
  thumbnailUrl?: string | null;
  title?: string | null;
};

const DIAGNOSTIC_REASON_LABELS: Record<string, string> = {
  ringcentral_auth_required: "Authentication required",
  ringcentral_permission_denied: "Permission denied",
  ringcentral_recording_unavailable: "Recording unavailable",
  ringcentral_session_expired: "Session expired",
  ringcentral_unsupported_page: "Unsupported page",
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

function formatDownloadPercent(downloadProgress?: DownloadProgress | null) {
  if (downloadProgress?.percent == null) {
    return "Pending";
  }

  return `${downloadProgress.percent}%`;
}

function getFormatDetails(format: DownloadFormat) {
  return [format.resolution, format.container, format.kind]
    .filter(Boolean)
    .join(" · ");
}

function getAssetStatus(downloadProgress?: DownloadProgress | null) {
  if (
    downloadProgress?.status === "queued" ||
    downloadProgress?.status === "probing" ||
    downloadProgress?.status === "downloading"
  ) {
    return "Preparing asset";
  }

  return "Not generated yet";
}

function formatDiagnosticReasonLabel(reason: string) {
  const mappedReason = DIAGNOSTIC_REASON_LABELS[reason];
  if (mappedReason) {
    return mappedReason;
  }

  const label = reason
    .replace(/^ringcentral_/, "")
    .split("_")
    .filter(Boolean)
    .join(" ");

  if (!label) {
    return "Diagnostic";
  }

  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function VideoInfoPanel({
  detectedLanguageName,
  description,
  diagnostics,
  downloadFormats,
  downloadProgress,
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
  const formattedDuration = formatDuration(durationSeconds);
  const hasDownloadFormats = Boolean(downloadFormats?.length);
  const hasDiagnostics = Boolean(diagnostics?.length);

  return (
    <section aria-label="Video information" className={styles.panel}>
      <h2 className={styles.panelTitle}>Video info</h2>
      <div className={styles.previewPlayerCard}>
        {thumbnailUrl ? (
          <img
            alt={title || "Video thumbnail"}
            className={styles.previewPlayerImage}
            src={thumbnailUrl}
          />
        ) : (
          <div className={styles.previewPlayerPlaceholder}>
            Preview loads after metadata
          </div>
        )}
        <div className={styles.previewPlayerOverlay}>
          <p className={styles.previewPlayerLabel}>Preview player</p>
          <p className={styles.previewPlayerTitle}>Source preview</p>
          <div className={styles.previewPlayerActions}>
            <span>{formattedDuration} runtime</span>
            <span>Timestamp sync ready</span>
          </div>
        </div>
      </div>
      {sourceUrl ? (
        <a className={styles.previewSourceLink} href={sourceUrl} rel="noreferrer" target="_blank">
          Open source video
        </a>
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
          <dd className={styles.infoValue}>{formattedDuration}</dd>
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
        {downloadProgress ? (
          <div>
            <dt className={styles.infoLabel}>Download progress</dt>
            <dd className={styles.infoValue}>{formatDownloadPercent(downloadProgress)}</dd>
          </div>
        ) : null}
        {hasDownloadFormats ? (
          <div>
            <dt className={styles.infoLabel}>Available asset formats</dt>
            <dd className={styles.infoValue}>
              <ul className={styles.historyList}>
                {downloadFormats?.map((format) => {
                  const details = getFormatDetails(format);

                  return (
                    <li key={format.format_id}>
                      <p className={styles.modeNoticeTitle}>{format.format_label}</p>
                      {details ? (
                        <p className={styles.modeNoticeBody}>{details}</p>
                      ) : null}
                      {format.artifact_path ? (
                        <p className={styles.modeNoticeBody}>
                          <a
                            className={styles.previewSourceLink}
                            download
                            href={format.artifact_path}
                          >
                            Download {format.format_label}
                          </a>
                        </p>
                      ) : (
                        <p className={styles.modeNoticeBody}>
                          {getAssetStatus(downloadProgress)}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </dd>
          </div>
        ) : null}
      </dl>
      {hasDiagnostics ? (
        <section aria-label="Diagnostics" className={styles.workspace}>
          <h3 className={styles.workspaceTitle}>Diagnostics</h3>
          <ul className={styles.historyList}>
            {diagnostics?.map((diagnostic) => (
              <li key={`${diagnostic.stage}-${diagnostic.reason}-${diagnostic.message}`}>
                <p className={styles.modeNoticeStatus}>
                  {formatDiagnosticReasonLabel(diagnostic.reason)}
                </p>
                <p className={styles.modeNoticeTitle}>{diagnostic.message}</p>
                <p className={styles.modeNoticeBody}>{diagnostic.suggestion}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}
