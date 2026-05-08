export type RingCentralRecoverySeverity = "success" | "warning" | "error";

export type RingCentralRecoveryGuidance = {
  detail: string;
  severity: RingCentralRecoverySeverity;
  steps: string[];
  title: string;
};

const GENERIC_GUIDANCE: RingCentralRecoveryGuidance = {
  detail: "GET attempted a safe dry-run metadata check without creating an analysis job.",
  severity: "warning",
  steps: [
    "Retry the access check once in case RingCentral returned a transient response.",
    "Confirm the recording opens in a normal browser tab.",
    "If it still fails, share the sanitized diagnostic reason with the GET maintainer.",
  ],
  title: "RingCentral access could not be confirmed",
};

const GUIDANCE_BY_REASON: Record<string, RingCentralRecoveryGuidance> = {
  ringcentral_auth_required: {
    detail: "GET could not run the dry-run check because server-side RingCentral authentication is missing.",
    severity: "error",
    steps: [
      "Set RINGCENTRAL_COOKIE_FILE or RINGCENTRAL_COOKIES_FROM_BROWSER on the API server.",
      "Restart the API after changing RingCentral auth settings.",
      "Run Check access again before starting analysis.",
    ],
    title: "Server RingCentral auth is not configured",
  },
  ringcentral_session_expired: {
    detail: "GET reached RingCentral with the configured auth method, but the session no longer appears valid.",
    severity: "warning",
    steps: [
      "Open RingCentral in the configured browser profile and sign in again.",
      "Confirm the recording plays normally in that browser profile.",
      "Retry Check access after the recording opens normally in that browser.",
    ],
    title: "RingCentral session needs refresh",
  },
  ringcentral_permission_denied: {
    detail: "GET reached RingCentral, but the configured account does not appear to have access to this recording.",
    severity: "error",
    steps: [
      "Ask the meeting owner to share the recording with the configured RingCentral account.",
      "Confirm the same account can play the recording in a normal browser tab.",
      "Retry Check access after access is granted.",
    ],
    title: "Recording permission is blocked",
  },
  ringcentral_recording_unavailable: {
    detail: "RingCentral did not expose a playable recording during the dry-run check.",
    severity: "warning",
    steps: [
      "Confirm the recording has finished processing in RingCentral.",
      "Check whether the recording was deleted or expired.",
      "Copy the recording URL again from the browser and retry Check access.",
    ],
    title: "Recording is not available",
  },
  ringcentral_unsupported_page: {
    detail: "GET reached a RingCentral page shape that the current downloader cannot parse.",
    severity: "warning",
    steps: [
      "Open the recording with browser-view mode enabled.",
      "Copy the URL from the browser after the recording page fully loads.",
      "Retry Check access with that browser URL.",
    ],
    title: "Recording page is not supported yet",
  },
  ringcentral_download_failed: GENERIC_GUIDANCE,
};

export function getRingCentralRecoveryGuidance(reason?: string | null) {
  if (!reason) {
    return GENERIC_GUIDANCE;
  }

  return GUIDANCE_BY_REASON[reason] ?? GENERIC_GUIDANCE;
}

export const RINGCENTRAL_ACCESS_READY_GUIDANCE: RingCentralRecoveryGuidance = {
  detail: "GET completed a safe dry-run metadata check without creating an analysis job.",
  severity: "success",
  steps: [
    "Start analysis when you are ready.",
    "If analysis later fails, run Check access again to confirm the session is still valid.",
  ],
  title: "RingCentral access ready",
};
