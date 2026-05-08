import styles from "../app/homepage.module.css";
import {
  RINGCENTRAL_ACCESS_READY_GUIDANCE,
  getRingCentralRecoveryGuidance,
} from "../lib/ringcentral-diagnostics";
import type { RingCentralProbeDiagnostic } from "../lib/api";

type RingCentralAccessGuidanceProps = {
  diagnostic?: RingCentralProbeDiagnostic | null;
  errorMessage?: string | null;
  ok: boolean;
};

export function RingCentralAccessGuidance({
  diagnostic = null,
  errorMessage = null,
  ok,
}: RingCentralAccessGuidanceProps) {
  const guidance = ok
    ? RINGCENTRAL_ACCESS_READY_GUIDANCE
    : getRingCentralRecoveryGuidance(diagnostic?.reason);
  const diagnosticMessage =
    errorMessage ??
    diagnostic?.message ??
    (ok
      ? "RingCentral access ready. You can analyze this recording."
      : "RingCentral access could not be confirmed.");
  const diagnosticSuggestion = diagnostic?.suggestion;

  return (
    <section
      aria-live="polite"
      className={styles.probeGuidancePanel}
      data-severity={guidance.severity}
    >
      <div className={styles.probeGuidanceHeader}>
        <p className={styles.probeGuidanceEyebrow}>RingCentral access check</p>
        <h3 className={styles.probeGuidanceTitle}>{guidance.title}</h3>
      </div>
      <p className={styles.probeFeedbackMessage}>{diagnosticMessage}</p>
      {diagnosticSuggestion ? (
        <p className={styles.probeFeedbackSuggestion}>{diagnosticSuggestion}</p>
      ) : null}
      <p className={styles.probeGuidanceDetail}>{guidance.detail}</p>
      {!ok ? (
        <p className={styles.probeGuidanceWarning}>
          Analysis may fail until this access issue is fixed.
        </p>
      ) : null}
      <ul className={styles.probeGuidanceSteps}>
        {guidance.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ul>
    </section>
  );
}
