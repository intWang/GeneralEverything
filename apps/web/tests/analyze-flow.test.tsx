import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import { AnalyzeForm } from "../components/analyze-form";
import * as api from "../lib/api";

vi.mock("../lib/api", () => ({
  createJob: vi.fn(),
  getCapabilities: vi.fn(),
  probeRingCentralAccess: vi.fn(),
  submitJobQuestion: vi.fn(),
}));

beforeEach(() => {
  vi.resetAllMocks();
});

function renderReadyRingCentralForm() {
  return render(
    <AnalyzeForm
      inputMode="ringcentral_recording"
      ringCentralCapability={{
        auth_configured: true,
        auth_method: "browser_cookies",
        enabled: true,
        label: "RingCentral Recording URL",
        message: "RingCentral recording downloads can use configured browser cookies.",
        status: "ready",
        suggestion: "Paste an internal recording URL to start.",
      }}
    />,
  );
}

test("submits the source url and reports job creation", async () => {
  const createJob = vi.mocked(api.createJob);
  const onJobCreated = vi.fn();

  createJob.mockResolvedValue({
    created_at: "2026-05-04T09:00:00Z",
    id: "job-123",
    input_mode: "public_video",
    source_url: "https://example.com/video",
    stage: "queued",
    status: "queued",
  });

  render(
    <AnalyzeForm inputMode="public_video" onJobCreated={onJobCreated} />,
  );

  fireEvent.change(screen.getByLabelText("Video source"), {
    target: { value: "https://example.com/video" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Analyze" }));

  await waitFor(() => {
    expect(createJob).toHaveBeenCalledWith("https://example.com/video");
  });

  expect(onJobCreated).toHaveBeenCalledWith({
    created_at: "2026-05-04T09:00:00Z",
    id: "job-123",
    input_mode: "public_video",
    source_url: "https://example.com/video",
    stage: "queued",
    status: "queued",
  });
  expect(
    screen.getByText("Analysis requested. Live status will appear below."),
  ).toBeInTheDocument();
});

test("blocks analysis submission in RingCentral mode until auth exists", () => {
  const createJob = vi.mocked(api.createJob);
  const onJobCreated = vi.fn();

  render(
    <AnalyzeForm
      inputMode="ringcentral_recording"
      ringCentralCapability={{
        auth_configured: false,
        auth_method: null,
        enabled: false,
        label: "RingCentral Recording URL",
        message: "RingCentral server authentication is not configured.",
        status: "requires_server_auth",
        suggestion: "Configure RingCentral cookies on the API server.",
      }}
      onJobCreated={onJobCreated}
    />,
  );

  expect(
    screen.getByRole("button", { name: "Analyze (blocked until RingCentral auth is available)" }),
  ).toBeDisabled();

  fireEvent.change(screen.getByLabelText("Video source"), {
    target: { value: "https://app.ringcentral.com/recording/123" },
  });
  fireEvent.click(
    screen.getByRole("button", {
      name: "Analyze (blocked until RingCentral auth is available)",
    }),
  );

  expect(createJob).not.toHaveBeenCalled();
  expect(onJobCreated).not.toHaveBeenCalled();
  expect(
    screen.getByText("RingCentral server authentication is not configured."),
  ).toBeInTheDocument();
});

test("submits RingCentral recordings when server auth is configured", async () => {
  const createJob = vi.mocked(api.createJob);
  const onJobCreated = vi.fn();

  createJob.mockResolvedValue({
    created_at: "2026-05-04T09:00:00Z",
    id: "job-ringcentral",
    input_mode: "ringcentral_recording",
    source_url: "https://app.ringcentral.com/recording/123",
    stage: "queued",
    status: "queued",
  });

  render(
    <AnalyzeForm
      inputMode="ringcentral_recording"
      ringCentralCapability={{
        auth_configured: true,
        auth_method: "browser_cookies",
        enabled: true,
        label: "RingCentral Recording URL",
        message: "RingCentral recording downloads can use configured browser cookies.",
        status: "ready",
        suggestion: "Paste an internal recording URL to start.",
      }}
      onJobCreated={onJobCreated}
    />,
  );

  expect(screen.getByRole("button", { name: "Analyze RingCentral recording" })).toBeEnabled();

  fireEvent.change(screen.getByLabelText("Video source"), {
    target: { value: "https://app.ringcentral.com/recording/123" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Analyze RingCentral recording" }));

  await waitFor(() => {
    expect(createJob).toHaveBeenCalledWith("https://app.ringcentral.com/recording/123");
  });

  expect(onJobCreated).toHaveBeenCalledWith({
    created_at: "2026-05-04T09:00:00Z",
    id: "job-ringcentral",
    input_mode: "ringcentral_recording",
    source_url: "https://app.ringcentral.com/recording/123",
    stage: "queued",
    status: "queued",
  });
});

test("checks RingCentral access without creating a job", async () => {
  const createJob = vi.mocked(api.createJob);
  const probeRingCentralAccess = vi.mocked(api.probeRingCentralAccess);

  probeRingCentralAccess.mockResolvedValue({
    input_mode: "ringcentral_recording",
    ok: true,
    source_url: "https://app.ringcentral.com/recording/123",
  });

  render(
    <AnalyzeForm
      inputMode="ringcentral_recording"
      ringCentralCapability={{
        auth_configured: true,
        auth_method: "browser_cookies",
        enabled: true,
        label: "RingCentral Recording URL",
        message: "RingCentral recording downloads can use configured browser cookies.",
        status: "ready",
        suggestion: "Paste an internal recording URL to start.",
      }}
    />,
  );

  fireEvent.change(screen.getByLabelText("Video source"), {
    target: { value: "https://app.ringcentral.com/recording/123" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Check access" }));

  await waitFor(() => {
    expect(probeRingCentralAccess).toHaveBeenCalledWith(
      "https://app.ringcentral.com/recording/123",
    );
  });

  expect(createJob).not.toHaveBeenCalled();
  expect(screen.getByText("RingCentral access ready. You can analyze this recording.")).toBeInTheDocument();
});

test("shows RingCentral probe diagnostics without saving the source link", async () => {
  const createJob = vi.mocked(api.createJob);
  const probeRingCentralAccess = vi.mocked(api.probeRingCentralAccess);

  probeRingCentralAccess.mockResolvedValue({
    diagnostic: {
      message: "The recording requires owner permission.",
      suggestion: "Ask the meeting owner to grant access, then check again.",
    },
    input_mode: "ringcentral_recording",
    ok: false,
    source_url: "https://app.ringcentral.com/recording/private",
  });

  render(
    <AnalyzeForm
      inputMode="ringcentral_recording"
      ringCentralCapability={{
        auth_configured: true,
        auth_method: "browser_cookies",
        enabled: true,
        label: "RingCentral Recording URL",
        message: "RingCentral recording downloads can use configured browser cookies.",
        status: "ready",
        suggestion: "Paste an internal recording URL to start.",
      }}
    />,
  );

  fireEvent.change(screen.getByLabelText("Video source"), {
    target: { value: "https://app.ringcentral.com/recording/private" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Check access" }));

  expect(await screen.findByText("The recording requires owner permission.")).toBeInTheDocument();
  expect(
    screen.getByText("Ask the meeting owner to grant access, then check again."),
  ).toBeInTheDocument();
  expect(createJob).not.toHaveBeenCalled();
});

test("shows server-auth setup guidance for RingCentral probe auth-required failures", async () => {
  const createJob = vi.mocked(api.createJob);
  const probeRingCentralAccess = vi.mocked(api.probeRingCentralAccess);

  probeRingCentralAccess.mockResolvedValue({
    diagnostic: {
      message: "RingCentral server authentication is not configured.",
      reason: "ringcentral_auth_required",
      suggestion: "Configure RingCentral cookies on the API server.",
    },
    input_mode: "ringcentral_recording",
    ok: false,
    source_url: "https://app.ringcentral.com/recording/private",
  });

  renderReadyRingCentralForm();

  fireEvent.change(screen.getByLabelText("Video source"), {
    target: { value: "https://app.ringcentral.com/recording/private?code=fixture" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Check access" }));

  expect(await screen.findByText("Server RingCentral auth is not configured")).toBeInTheDocument();
  expect(screen.getByText("Set RINGCENTRAL_COOKIE_FILE or RINGCENTRAL_COOKIES_FROM_BROWSER on the API server.")).toBeInTheDocument();
  expect(screen.getByText("Restart the API after changing RingCentral auth settings.")).toBeInTheDocument();
  expect(screen.queryByText(/code=fixture/)).not.toBeInTheDocument();
  expect(createJob).not.toHaveBeenCalled();
});

test("shows session refresh guidance for expired RingCentral probe sessions", async () => {
  const probeRingCentralAccess = vi.mocked(api.probeRingCentralAccess);

  probeRingCentralAccess.mockResolvedValue({
    diagnostic: {
      message: "The configured RingCentral session appears to be expired.",
      reason: "ringcentral_session_expired",
      suggestion: "Sign in again from the configured browser profile.",
    },
    input_mode: "ringcentral_recording",
    ok: false,
    source_url: "https://app.ringcentral.com/recording/private",
  });

  renderReadyRingCentralForm();

  fireEvent.change(screen.getByLabelText("Video source"), {
    target: { value: "https://app.ringcentral.com/recording/private" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Check access" }));

  expect(await screen.findByText("RingCentral session needs refresh")).toBeInTheDocument();
  expect(screen.getByText("Open RingCentral in the configured browser profile and sign in again.")).toBeInTheDocument();
  expect(screen.getByText("Retry Check access after the recording opens normally in that browser.")).toBeInTheDocument();
});

test("shows owner sharing guidance for RingCentral permission failures", async () => {
  const probeRingCentralAccess = vi.mocked(api.probeRingCentralAccess);

  probeRingCentralAccess.mockResolvedValue({
    diagnostic: {
      message: "The current RingCentral account cannot access this recording.",
      reason: "ringcentral_permission_denied",
      suggestion: "Ask the owner to share the recording.",
    },
    input_mode: "ringcentral_recording",
    ok: false,
    source_url: "https://app.ringcentral.com/recording/private",
  });

  renderReadyRingCentralForm();

  fireEvent.change(screen.getByLabelText("Video source"), {
    target: { value: "https://app.ringcentral.com/recording/private" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Check access" }));

  expect(await screen.findByText("Recording permission is blocked")).toBeInTheDocument();
  expect(screen.getByText("Ask the meeting owner to share the recording with the configured RingCentral account.")).toBeInTheDocument();
  expect(screen.getByText("Confirm the same account can play the recording in a normal browser tab.")).toBeInTheDocument();
});

test("falls back to safe generic RingCentral recovery guidance", async () => {
  const probeRingCentralAccess = vi.mocked(api.probeRingCentralAccess);

  probeRingCentralAccess.mockResolvedValue({
    diagnostic: {
      message: "The recording could not be checked.",
      reason: "ringcentral_future_reason",
      suggestion: "Try again later.",
    },
    input_mode: "ringcentral_recording",
    ok: false,
    source_url: "https://app.ringcentral.com/recording/private",
  });

  renderReadyRingCentralForm();

  fireEvent.change(screen.getByLabelText("Video source"), {
    target: { value: "https://app.ringcentral.com/recording/private" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Check access" }));

  expect(await screen.findByText("RingCentral access could not be confirmed")).toBeInTheDocument();
  expect(screen.getByText("Analysis may fail until this access issue is fixed.")).toBeInTheDocument();
  expect(screen.getByText("Retry the access check once in case RingCentral returned a transient response.")).toBeInTheDocument();
  expect(screen.getByText("If it still fails, share the sanitized diagnostic reason with the GET maintainer.")).toBeInTheDocument();
});

test("does not render raw RingCentral request errors from failed access checks", async () => {
  const probeRingCentralAccess = vi.mocked(api.probeRingCentralAccess);

  probeRingCentralAccess.mockRejectedValue(
    new Error(
      "Request failed for https://app.ringcentral.com/recording/private?code=fixture with stack details",
    ),
  );

  renderReadyRingCentralForm();

  fireEvent.change(screen.getByLabelText("Video source"), {
    target: { value: "https://app.ringcentral.com/recording/private?code=fixture" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Check access" }));

  expect(await screen.findByText("Access check could not complete.")).toBeInTheDocument();
  expect(screen.queryByText(/code=fixture/)).not.toBeInTheDocument();
  expect(screen.queryByText(/stack details/)).not.toBeInTheDocument();
});

test("clears RingCentral access guidance when the source URL changes", async () => {
  const probeRingCentralAccess = vi.mocked(api.probeRingCentralAccess);

  probeRingCentralAccess.mockResolvedValue({
    diagnostic: {
      message: "The recording could not be checked.",
      reason: "ringcentral_future_reason",
    },
    input_mode: "ringcentral_recording",
    ok: false,
    source_url: "https://app.ringcentral.com/recording/private",
  });

  renderReadyRingCentralForm();

  fireEvent.change(screen.getByLabelText("Video source"), {
    target: { value: "https://app.ringcentral.com/recording/private" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Check access" }));

  expect(await screen.findByText("RingCentral access could not be confirmed")).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("Video source"), {
    target: { value: "https://app.ringcentral.com/recording/other" },
  });

  expect(screen.queryByText("RingCentral access could not be confirmed")).not.toBeInTheDocument();
});

test("keeps the RingCentral probe layout stable before a URL is entered", () => {
  const { container } = renderReadyRingCentralForm();

  expect(container.querySelector("form")).toHaveAttribute("data-probe-layout", "true");
  expect(screen.getByRole("button", { name: "Check access" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Analyze RingCentral recording" })).toBeEnabled();
});
