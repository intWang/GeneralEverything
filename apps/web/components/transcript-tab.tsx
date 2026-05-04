import styles from "../app/homepage.module.css";
import type { TabShellState } from "./summary-tab";

type TranscriptTabProps = {
  audioArtifactPath?: string | null;
  extractor?: string | null;
  previewLines?: readonly string[];
  shellState?: TabShellState;
};

const DEFAULT_PREVIEW_LINES = [
  "[00:00] Transcript chunks will stream in after audio extraction starts.",
  "[00:18] Early lines may be refined as more context becomes available.",
  "[00:42] Finalized transcript segments will replace provisional text in a later task.",
] as const;

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
    title: "Transcript is waiting for audio extraction",
    body: "Transcript stays empty until GET confirms the source, fetches the stream, and begins preparing audio for speech recognition.",
  },
  processing: {
    eyebrow: "Processing",
    title: "Transcript is preparing its first lines",
    body: "GET is extracting audio and warming up the transcript pipeline, but no stable lines are ready to surface yet.",
  },
  partial: {
    eyebrow: "Partial",
    title: "Transcript is streaming provisional lines",
    body: "Early transcript lines can still be refined as more neighboring context becomes available from the recording.",
  },
  complete: {
    eyebrow: "Complete",
    title: "Transcript shell is ready for finalized segments",
    body: "This placeholder now reflects a finished transcript state and is ready for the real segment list in the next task.",
  },
  failed: {
    eyebrow: "Failed",
    title: "Transcript could not finish processing",
    body: "The transcript shell stays in a blocked state so the UI does not imply that stable lines are still on the way.",
  },
};

export function TranscriptTab({
  audioArtifactPath,
  extractor,
  previewLines = DEFAULT_PREVIEW_LINES,
  shellState = "queued",
}: TranscriptTabProps) {
  const copy = SHELL_COPY[shellState];

  return (
    <div>
      <p className={styles.tabStateLabel} data-state={shellState}>
        {copy.eyebrow}
      </p>
      <h3 className={styles.tabSectionTitle}>{copy.title}</h3>
      <p className={styles.tabSectionBody}>
        {copy.body}
      </p>
      {audioArtifactPath ? (
        <div className={styles.transcriptPreview}>
          <p className={styles.transcriptLine}>
            Audio artifact ready: {audioArtifactPath}
          </p>
          <p className={styles.transcriptLine}>
            Extractor: {extractor || "Pending extractor"}
          </p>
        </div>
      ) : null}
      <div className={styles.transcriptPreview}>
        {previewLines.map((line) => (
          <p className={styles.transcriptLine} key={line}>
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}
