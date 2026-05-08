import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import HomePage from "../app/page";
import * as api from "../lib/api";
import * as sse from "../lib/sse";

vi.mock("../lib/api", () => ({
  createJob: vi.fn(),
  getCapabilities: vi.fn(),
  getJob: vi.fn(),
  listJobs: vi.fn(),
  submitJobQuestion: vi.fn(),
}));

vi.mock("../lib/sse", () => ({
  subscribeToJobEvents: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState({}, "", "/");
  vi.mocked(sse.subscribeToJobEvents).mockReturnValue(() => undefined);
  vi.mocked(api.getCapabilities).mockResolvedValue({
    input_modes: {
      public_video: {
        auth_configured: true,
        auth_method: null,
        enabled: true,
        label: "Public Video URL",
        message: "Public video analysis is available.",
        status: "ready",
        suggestion: "Paste a public video URL to start.",
      },
      ringcentral_recording: {
        auth_configured: false,
        auth_method: null,
        enabled: false,
        label: "RingCentral Recording URL",
        message: "RingCentral server authentication is not configured.",
        status: "requires_server_auth",
        suggestion: "Configure RingCentral cookies on the API server.",
      },
    },
  });
  vi.mocked(api.listJobs).mockResolvedValue([]);
});

test("smoke: homepage opens the Ask AI shell for a completed job", async () => {
  vi.mocked(api.getJob).mockResolvedValue({
    created_at: "2026-05-04T15:00:00Z",
    id: "88888888-8888-8888-8888-888888888888",
    input_mode: "public_video",
    source_url: "https://example.com/smoke",
    stage: "building_mindmap",
    status: "completed",
  });
  vi.mocked(api.listJobs).mockResolvedValue([
    {
      created_at: "2026-05-04T15:00:00Z",
      id: "88888888-8888-8888-8888-888888888888",
      input_mode: "public_video",
      source_url: "https://example.com/smoke",
      stage: "building_mindmap",
      status: "completed",
    },
  ]);
  window.history.replaceState(
    {},
    "",
    "/?job=88888888-8888-8888-8888-888888888888",
  );

  render(<HomePage />);

  expect(
    screen.getByRole("heading", {
      name: "Paste a video URL. Get transcript, summary, and answers.",
    }),
  ).toBeInTheDocument();

  await waitFor(() => {
    expect(
      screen.getByText(
        "Job 88888888-8888-8888-8888-888888888888 is completed for analysis.",
      ),
    ).toBeInTheDocument();
  });

  fireEvent.click(screen.getByRole("tab", { name: "Ask AI" }));

  expect(screen.getByText("Ask AI shell is ready for grounded follow-ups")).toBeInTheDocument();
  expect(screen.getByLabelText("Ask a question")).toBeEnabled();
  expect(screen.getByRole("button", { name: "Submit question" })).toBeDisabled();
});
