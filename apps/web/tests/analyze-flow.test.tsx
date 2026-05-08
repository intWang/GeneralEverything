import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import { AnalyzeForm } from "../components/analyze-form";
import * as api from "../lib/api";

vi.mock("../lib/api", () => ({
  createJob: vi.fn(),
  getCapabilities: vi.fn(),
  submitJobQuestion: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

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
