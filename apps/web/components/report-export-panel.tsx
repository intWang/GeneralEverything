"use client";

import { useEffect, useRef, useState } from "react";

import styles from "../app/homepage.module.css";
import { exportJobMarkdownReport } from "../lib/api";
import type { MarkdownReportExportResponse } from "../lib/api";

type ReportExportPanelProps = {
  jobId?: string | null;
};

type ExportState = {
  downloadHref: string;
  exportPayload: MarkdownReportExportResponse;
};

function buildMarkdownDataUrl(payload: MarkdownReportExportResponse) {
  return `data:text/markdown;charset=utf-8,${encodeURIComponent(payload.markdown)}`;
}

export function ReportExportPanel({ jobId }: ReportExportPanelProps) {
  const [exportState, setExportState] = useState<ExportState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const requestIdRef = useRef(0);
  const activeJobIdRef = useRef(jobId);

  activeJobIdRef.current = jobId;

  useEffect(() => {
    requestIdRef.current += 1;
    setExportState(null);
    setErrorMessage(null);
    setIsExporting(false);
  }, [jobId]);

  if (!jobId) {
    return null;
  }

  async function handleExportReport() {
    if (!jobId) {
      return;
    }

    const requestedJobId = jobId;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setIsExporting(true);
    setErrorMessage(null);
    try {
      const exportPayload = await exportJobMarkdownReport(requestedJobId);
      if (
        requestIdRef.current !== requestId ||
        activeJobIdRef.current !== requestedJobId
      ) {
        return;
      }

      setExportState({
        downloadHref: buildMarkdownDataUrl(exportPayload),
        exportPayload,
      });
    } catch {
      if (
        requestIdRef.current !== requestId ||
        activeJobIdRef.current !== requestedJobId
      ) {
        return;
      }

      setExportState(null);
      setErrorMessage("Report export is unavailable right now.");
    } finally {
      if (
        requestIdRef.current === requestId &&
        activeJobIdRef.current === requestedJobId
      ) {
        setIsExporting(false);
      }
    }
  }

  return (
    <section aria-label="Report export" className={styles.reportExportPanel}>
      <div>
        <h3 className={styles.reportExportTitle}>Markdown report</h3>
        <p className={styles.reportExportDescription}>
          Generate the full backend analysis report with metadata, source details,
          transcript timestamps, summary citations, mind map references, and Ask AI
          readiness context.
        </p>
      </div>
      <div className={styles.reportExportActions}>
        <button
          className={styles.analysisBundleButton}
          disabled={isExporting}
          onClick={() => void handleExportReport()}
          type="button"
        >
          {isExporting ? "Exporting..." : "Export report"}
        </button>
        {exportState ? (
          <a
            className={styles.analysisBundleDownloadLink}
            download={exportState.exportPayload.filename}
            href={exportState.downloadHref}
            title={`Download ${exportState.exportPayload.filename}`}
          >
            Download report .md
          </a>
        ) : null}
        {exportState ? (
          <span aria-live="polite" className={styles.analysisBundleStatus} role="status">
            Report generated at {exportState.exportPayload.generated_at}
          </span>
        ) : null}
        {errorMessage ? (
          <span aria-live="polite" className={styles.analysisBundleStatus} role="status">
            {errorMessage}
          </span>
        ) : null}
      </div>
    </section>
  );
}
