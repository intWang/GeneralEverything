import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import HomePage from "../app/page";
import * as api from "../lib/api";
import * as sse from "../lib/sse";

vi.mock("../lib/api", () => ({
  createJob: vi.fn(),
  getJob: vi.fn(),
  listJobs: vi.fn(),
}));

vi.mock("../lib/sse", () => ({
  subscribeToJobEvents: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState({}, "", "/");
  vi.mocked(sse.subscribeToJobEvents).mockReturnValue(() => undefined);
  vi.mocked(api.listJobs).mockResolvedValue([]);
});

test("renders both input modes as accessible radio options", () => {
  render(<HomePage />);

  const publicVideoOption = screen.getByRole("radio", {
    name: "Public Video URL",
  });
  const ringcentralRecordingOption = screen.getByRole("radio", {
    name: "RingCentral Recording URL",
  });

  expect(publicVideoOption).toBeInTheDocument();
  expect(ringcentralRecordingOption).toBeInTheDocument();
  expect(publicVideoOption).toBeChecked();
  expect(ringcentralRecordingOption).not.toBeChecked();
});

test("switches the selected input mode", () => {
  render(<HomePage />);

  const publicVideoOption = screen.getByRole("radio", {
    name: "Public Video URL",
  });
  const ringcentralRecordingOption = screen.getByRole("radio", {
    name: "RingCentral Recording URL",
  });

  fireEvent.click(ringcentralRecordingOption);

  expect(ringcentralRecordingOption).toBeChecked();
  expect(publicVideoOption).not.toBeChecked();
});

test("reveals the workflow panels after creating a job", async () => {
  const createJob = vi.mocked(api.createJob);
  const getJob = vi.mocked(api.getJob);
  const listJobs = vi.mocked(api.listJobs);

  createJob.mockResolvedValue({
    created_at: "2026-05-04T09:00:00Z",
    id: "11111111-1111-1111-1111-111111111111",
    input_mode: "public_video",
    source_url: "https://example.com/video",
    stage: "queued",
    status: "queued",
  });
  getJob.mockResolvedValue({
    created_at: "2026-05-04T09:00:00Z",
    id: "11111111-1111-1111-1111-111111111111",
    input_mode: "public_video",
    source_url: "https://example.com/video",
    stage: "queued",
    status: "queued",
  });
  listJobs
    .mockResolvedValueOnce([])
    .mockResolvedValue([
      {
        created_at: "2026-05-04T09:00:00Z",
        id: "11111111-1111-1111-1111-111111111111",
        input_mode: "public_video",
        source_url: "https://example.com/video",
        stage: "queued",
        status: "queued",
      },
    ]);

  render(<HomePage />);

  expect(
    screen.queryByRole("heading", { name: "AI output" }),
  ).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("Video source"), {
    target: { value: "https://example.com/video" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Analyze" }));

  await waitFor(() => {
    expect(screen.getByRole("heading", { name: "AI output" })).toBeInTheDocument();
  });

  expect(getJob).toHaveBeenCalledWith("11111111-1111-1111-1111-111111111111");
  expect(screen.getByText("Summary")).toBeInTheDocument();
  expect(screen.getByText("Transcript")).toBeInTheDocument();
  expect(screen.getByText("Mind Map")).toBeInTheDocument();
  expect(screen.getByText("Ask AI")).toBeInTheDocument();
  expect(
    screen.getByText(
      "Job 11111111-1111-1111-1111-111111111111 is queued for analysis.",
    ),
  ).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Recent jobs" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /https:\/\/example.com\/video/i })).toBeInTheDocument();
});

test("shows a RingCentral stub prompt when that mode is selected", () => {
  render(<HomePage />);

  fireEvent.click(
    screen.getByRole("radio", { name: "RingCentral Recording URL" }),
  );

  expect(
    screen.getByText("RingCentral connection will be added in a later task."),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Connect RingCentral (coming soon)" }),
  ).toBeInTheDocument();
});

test("maps backend completed status to a complete timeline state", async () => {
  const createJob = vi.mocked(api.createJob);
  const getJob = vi.mocked(api.getJob);
  const subscribeToJobEvents = vi.mocked(sse.subscribeToJobEvents);

  createJob.mockResolvedValue({
    created_at: "2026-05-04T09:00:00Z",
    id: "11111111-1111-1111-1111-111111111111",
    input_mode: "public_video",
    source_url: "https://example.com/video",
    stage: "queued",
    status: "queued",
  });
  getJob.mockResolvedValue({
    created_at: "2026-05-04T09:00:00Z",
    id: "11111111-1111-1111-1111-111111111111",
    input_mode: "public_video",
    source_url: "https://example.com/video",
    stage: "queued",
    status: "queued",
  });
  subscribeToJobEvents.mockImplementation((_jobId, handlers = {}) => {
    handlers.onEvent?.({
      event: "job.status",
      data: { status: "completed" },
    });

    return () => undefined;
  });

  render(<HomePage />);

  fireEvent.change(screen.getByLabelText("Video source"), {
    target: { value: "https://example.com/video" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Analyze" }));

  await waitFor(() => {
    expect(
      screen.getByText(
        "Job 11111111-1111-1111-1111-111111111111 is completed for analysis.",
      ),
    ).toBeInTheDocument();
  });

  expect(
    screen
      .getByText(
        "Job 11111111-1111-1111-1111-111111111111 is completed for analysis.",
      )
      .closest("li"),
  ).toHaveAttribute("data-state", "complete");
});

test("shows metadata-ready timeline copy for a hydrated job", async () => {
  const getJob = vi.mocked(api.getJob);
  const listJobs = vi.mocked(api.listJobs);

  window.history.replaceState(
    {},
    "",
    "/?job=55555555-5555-5555-5555-555555555555",
  );
  getJob.mockResolvedValue({
    created_at: "2026-05-04T13:00:00Z",
    id: "55555555-5555-5555-5555-555555555555",
    input_mode: "public_video",
    source_url: "https://example.com/metadata-ready",
    stage: "metadata_ready",
    status: "running",
  });
  listJobs.mockResolvedValue([
    {
      created_at: "2026-05-04T13:00:00Z",
      id: "55555555-5555-5555-5555-555555555555",
      input_mode: "public_video",
      source_url: "https://example.com/metadata-ready",
      stage: "metadata_ready",
      status: "running",
    },
  ]);

  render(<HomePage />);

  await waitFor(() => {
    expect(
      screen.getByText(
        "Job 55555555-5555-5555-5555-555555555555 finished metadata probing.",
      ),
    ).toBeInTheDocument();
  });

  expect(
    screen.getByText(
      "Metadata is ready, so the workflow can now transition into download preparation.",
    ),
  ).toBeInTheDocument();
});

test("shows download-ready timeline copy for a hydrated job", async () => {
  const getJob = vi.mocked(api.getJob);
  const listJobs = vi.mocked(api.listJobs);

  window.history.replaceState(
    {},
    "",
    "/?job=66666666-6666-6666-6666-666666666666",
  );
  getJob.mockResolvedValue({
    created_at: "2026-05-04T13:15:00Z",
    id: "66666666-6666-6666-6666-666666666666",
    input_mode: "public_video",
    source_url: "https://example.com/download-ready",
    stage: "download_ready",
    status: "running",
  });
  listJobs.mockResolvedValue([
    {
      created_at: "2026-05-04T13:15:00Z",
      id: "66666666-6666-6666-6666-666666666666",
      input_mode: "public_video",
      source_url: "https://example.com/download-ready",
      stage: "download_ready",
      status: "running",
    },
  ]);

  render(<HomePage />);

  await waitFor(() => {
    expect(
      screen.getByText(
        "Job 66666666-6666-6666-6666-666666666666 is ready for the download step.",
      ),
    ).toBeInTheDocument();
  });

  expect(screen.getByText("Download stage shell")).toBeInTheDocument();
  expect(
    screen.getByText(
      "The download shell is complete, so the job is ready for downstream processing.",
    ),
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      "The job has reached the handoff point for later transcript, summary, mind map, and Ask AI stages.",
    ),
  ).toBeInTheDocument();
});

test("shows transcript-ready timeline and transcript shell details for a hydrated job", async () => {
  const getJob = vi.mocked(api.getJob);
  const listJobs = vi.mocked(api.listJobs);

  window.history.replaceState(
    {},
    "",
    "/?job=88888888-8888-8888-8888-888888888888",
  );
  getJob.mockResolvedValue({
    created_at: "2026-05-04T13:30:00Z",
    id: "88888888-8888-8888-8888-888888888888",
    input_mode: "public_video",
    source_url: "https://example.com/transcript-ready",
    stage: "transcript_ready",
    status: "running",
    transcript_audio_artifact_path:
      "var/transcripts/public-video/88888888-8888-8888-8888-888888888888.wav",
    transcript_extractor: "ffmpeg",
    transcript_status: "ready",
  });
  listJobs.mockResolvedValue([
    {
      created_at: "2026-05-04T13:30:00Z",
      id: "88888888-8888-8888-8888-888888888888",
      input_mode: "public_video",
      source_url: "https://example.com/transcript-ready",
      stage: "transcript_ready",
      status: "running",
      transcript_audio_artifact_path:
        "var/transcripts/public-video/88888888-8888-8888-8888-888888888888.wav",
      transcript_extractor: "ffmpeg",
      transcript_status: "ready",
    },
  ]);

  render(<HomePage />);

  await waitFor(() => {
    expect(
      screen.getByText(
        "Job 88888888-8888-8888-8888-888888888888 is ready for transcript generation.",
      ),
    ).toBeInTheDocument();
  });

  expect(
    screen.getByText(
      "Audio is extracted and the transcript shell is now ready for the next speech-recognition step.",
    ),
  ).toBeInTheDocument();

  fireEvent.click(screen.getByRole("tab", { name: "Transcript" }));

  expect(
    screen.getByText(
      "Audio artifact ready: var/transcripts/public-video/88888888-8888-8888-8888-888888888888.wav",
    ),
  ).toBeInTheDocument();
  expect(screen.getByText("Extractor: ffmpeg")).toBeInTheDocument();
});

test("shows transcript-generated timeline and preview details for a hydrated job", async () => {
  const getJob = vi.mocked(api.getJob);
  const listJobs = vi.mocked(api.listJobs);

  window.history.replaceState(
    {},
    "",
    "/?job=99999999-9999-9999-9999-999999999999",
  );
  getJob.mockResolvedValue({
    created_at: "2026-05-04T13:40:00Z",
    id: "99999999-9999-9999-9999-999999999999",
    input_mode: "public_video",
    source_url: "https://example.com/transcript-generated",
    stage: "transcript_generated",
    status: "running",
    transcript_audio_artifact_path:
      "var/transcripts/public-video/99999999-9999-9999-9999-999999999999.wav",
    transcript_extractor: "ffmpeg",
    transcript_preview_text:
      "Transcript shell generated for 99999999-9999-9999-9999-999999999999.wav. Real speech recognition is not wired in yet.",
    transcript_segment_count: 1,
    transcript_status: "ready",
  });
  listJobs.mockResolvedValue([
    {
      created_at: "2026-05-04T13:40:00Z",
      id: "99999999-9999-9999-9999-999999999999",
      input_mode: "public_video",
      source_url: "https://example.com/transcript-generated",
      stage: "transcript_generated",
      status: "running",
      transcript_audio_artifact_path:
        "var/transcripts/public-video/99999999-9999-9999-9999-999999999999.wav",
      transcript_extractor: "ffmpeg",
      transcript_preview_text:
        "Transcript shell generated for 99999999-9999-9999-9999-999999999999.wav. Real speech recognition is not wired in yet.",
      transcript_segment_count: 1,
      transcript_status: "ready",
    },
  ]);

  render(<HomePage />);

  await waitFor(() => {
    expect(
      screen.getByText(
        "Job 99999999-9999-9999-9999-999999999999 generated a transcript shell preview.",
      ),
    ).toBeInTheDocument();
  });

  expect(
    screen.getByText(
      "A first transcript shell preview is available, while richer transcript generation and downstream summary stages remain in progress.",
    ),
  ).toBeInTheDocument();

  fireEvent.click(screen.getByRole("tab", { name: "Transcript" }));

  expect(screen.getByText("Segment count: 1")).toBeInTheDocument();
  expect(
    screen.getByText(
      "Preview: Transcript shell generated for 99999999-9999-9999-9999-999999999999.wav. Real speech recognition is not wired in yet.",
    ),
  ).toBeInTheDocument();
});

test("shows summary-generated timeline and summary preview details for a hydrated job", async () => {
  const getJob = vi.mocked(api.getJob);
  const listJobs = vi.mocked(api.listJobs);

  window.history.replaceState(
    {},
    "",
    "/?job=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  );
  getJob.mockResolvedValue({
    created_at: "2026-05-04T13:50:00Z",
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    input_mode: "public_video",
    source_url: "https://example.com/summary-generated",
    stage: "summary_generated",
    status: "running",
    summary_key_points_count: 2,
    summary_preview_text: "Summary shell generated from transcript preview.",
    summary_status: "ready",
  });
  listJobs.mockResolvedValue([
    {
      created_at: "2026-05-04T13:50:00Z",
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      input_mode: "public_video",
      source_url: "https://example.com/summary-generated",
      stage: "summary_generated",
      status: "running",
      summary_key_points_count: 2,
      summary_preview_text: "Summary shell generated from transcript preview.",
      summary_status: "ready",
    },
  ]);

  render(<HomePage />);

  await waitFor(() => {
    expect(
      screen.getByText(
        "Job aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa generated a summary shell preview.",
      ),
    ).toBeInTheDocument();
  });

  expect(
    screen.getByText(
      "A first summary shell preview is available, while mind map and Ask AI are still waiting for richer downstream generation.",
    ),
  ).toBeInTheDocument();
  expect(screen.getByText("Key point shells ready: 2")).toBeInTheDocument();
  expect(
    screen.getByText("Preview: Summary shell generated from transcript preview."),
  ).toBeInTheDocument();
});

test("hydrates a revisited job from the URL query", async () => {
  const getJob = vi.mocked(api.getJob);
  const listJobs = vi.mocked(api.listJobs);

  window.history.replaceState(
    {},
    "",
    "/?job=22222222-2222-2222-2222-222222222222",
  );
  getJob.mockResolvedValue({
    created_at: "2026-05-04T10:00:00Z",
    description: "A saved metadata shell from the probe step.",
    duration_seconds: 754,
    id: "22222222-2222-2222-2222-222222222222",
    input_mode: "public_video",
    source_name: "OpenAI Channel",
    source_url: "https://example.com/revisit",
    stage: "queued",
    status: "running",
    thumbnail_url: "https://example.com/revisit-thumb.jpg",
    title: "Revisited metadata shell",
  });
  listJobs.mockResolvedValue([
    {
      created_at: "2026-05-04T10:00:00Z",
      description: "A saved metadata shell from the probe step.",
      duration_seconds: 754,
      id: "22222222-2222-2222-2222-222222222222",
      input_mode: "public_video",
      source_name: "OpenAI Channel",
      source_url: "https://example.com/revisit",
      stage: "queued",
      status: "running",
      thumbnail_url: "https://example.com/revisit-thumb.jpg",
      title: "Revisited metadata shell",
    },
  ]);

  render(<HomePage />);

  await waitFor(() => {
    expect(
      screen.getByText(
        "Job 22222222-2222-2222-2222-222222222222 is running for analysis.",
      ),
    ).toBeInTheDocument();
  });

  expect(getJob).toHaveBeenCalledWith("22222222-2222-2222-2222-222222222222");
  expect(
    screen.getByRole("button", { name: /https:\/\/example.com\/revisit/i }),
  ).toBeInTheDocument();
  expect(screen.getByText("Revisited metadata shell")).toBeInTheDocument();
  expect(screen.getByText("OpenAI Channel")).toBeInTheDocument();
  expect(screen.getByText("Example")).toBeInTheDocument();
  expect(screen.getByText("12:34")).toBeInTheDocument();
  expect(
    screen.getByText("A saved metadata shell from the probe step."),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("img", { name: "Revisited metadata shell" }),
  ).toHaveAttribute("src", "https://example.com/revisit-thumb.jpg");
  fireEvent.click(screen.getByRole("tab", { name: "Transcript" }));
  expect(
    screen.getByText("Transcript is streaming provisional lines"),
  ).toBeInTheDocument();
});

test("surfaces the Ask AI ready shell for a completed revisited job", async () => {
  const getJob = vi.mocked(api.getJob);
  const listJobs = vi.mocked(api.listJobs);

  window.history.replaceState(
    {},
    "",
    "/?job=44444444-4444-4444-4444-444444444444",
  );
  getJob.mockResolvedValue({
    created_at: "2026-05-04T12:00:00Z",
    id: "44444444-4444-4444-4444-444444444444",
    input_mode: "public_video",
    source_url: "https://example.com/completed",
    stage: "building_mindmap",
    status: "completed",
  });
  listJobs.mockResolvedValue([
    {
      created_at: "2026-05-04T12:00:00Z",
      id: "44444444-4444-4444-4444-444444444444",
      input_mode: "public_video",
      source_url: "https://example.com/completed",
      stage: "building_mindmap",
      status: "completed",
    },
  ]);

  render(<HomePage />);

  await waitFor(() => {
    expect(
      screen.getByText(
        "Job 44444444-4444-4444-4444-444444444444 is completed for analysis.",
      ),
    ).toBeInTheDocument();
  });

  fireEvent.click(screen.getByRole("tab", { name: "Ask AI" }));
  fireEvent.change(screen.getByLabelText("Ask a question"), {
    target: { value: "What should I follow up on?" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Submit question" }));

  expect(
    screen.getByText("Grounding source: finalized transcript and summary shells."),
  ).toBeInTheDocument();
  expect(
    screen.getByText('Question staged for the future QA pipeline: "What should I follow up on?"'),
  ).toBeInTheDocument();
});

test("resets Ask AI draft state when switching between jobs", async () => {
  const getJob = vi.mocked(api.getJob);
  const listJobs = vi.mocked(api.listJobs);

  listJobs.mockResolvedValue([
    {
      created_at: "2026-05-04T12:00:00Z",
      id: "44444444-4444-4444-4444-444444444444",
      input_mode: "public_video",
      source_url: "https://example.com/completed-a",
      stage: "building_mindmap",
      status: "completed",
    },
    {
      created_at: "2026-05-04T12:05:00Z",
      id: "77777777-7777-7777-7777-777777777777",
      input_mode: "public_video",
      source_url: "https://example.com/completed-b",
      stage: "building_mindmap",
      status: "completed",
    },
  ]);
  getJob.mockImplementation(async (jobId) => {
    if (jobId === "44444444-4444-4444-4444-444444444444") {
      return {
        created_at: "2026-05-04T12:00:00Z",
        id: jobId,
        input_mode: "public_video",
        source_url: "https://example.com/completed-a",
        stage: "building_mindmap",
        status: "completed",
      };
    }

    return {
      created_at: "2026-05-04T12:05:00Z",
      id: jobId,
      input_mode: "public_video",
      source_url: "https://example.com/completed-b",
      stage: "building_mindmap",
      status: "completed",
    };
  });

  window.history.replaceState(
    {},
    "",
    "/?job=44444444-4444-4444-4444-444444444444",
  );

  render(<HomePage />);

  await waitFor(() => {
    expect(
      screen.getByText(
        "Job 44444444-4444-4444-4444-444444444444 is completed for analysis.",
      ),
    ).toBeInTheDocument();
  });

  fireEvent.click(screen.getByRole("tab", { name: "Ask AI" }));
  fireEvent.change(screen.getByLabelText("Ask a question"), {
    target: { value: "What should I follow up on?" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Submit question" }));

  expect(
    screen.getByText('Question staged for the future QA pipeline: "What should I follow up on?"'),
  ).toBeInTheDocument();

  fireEvent.click(
    screen.getByRole("button", { name: /https:\/\/example.com\/completed-b/i }),
  );

  await waitFor(() => {
    expect(
      screen.getByText(
        "Job 77777777-7777-7777-7777-777777777777 is completed for analysis.",
      ),
    ).toBeInTheDocument();
  });

  expect(
    screen.queryByText('Question staged for the future QA pipeline: "What should I follow up on?"'),
  ).not.toBeInTheDocument();
  expect(screen.getByLabelText("Ask a question")).toHaveValue("");
  expect(screen.getByText("Answer placeholder")).toBeInTheDocument();
});

test("keeps the created job visible when follow-up hydration fails", async () => {
  const createJob = vi.mocked(api.createJob);
  const getJob = vi.mocked(api.getJob);

  createJob.mockResolvedValue({
    created_at: "2026-05-04T11:00:00Z",
    id: "33333333-3333-3333-3333-333333333333",
    input_mode: "public_video",
    source_url: "https://example.com/fallback",
    stage: "queued",
    status: "queued",
  });
  getJob.mockRejectedValue(new Error("boom"));

  render(<HomePage />);

  fireEvent.change(screen.getByLabelText("Video source"), {
    target: { value: "https://example.com/fallback" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Analyze" }));

  await waitFor(() => {
    expect(
      screen.getByText(
        "Job 33333333-3333-3333-3333-333333333333 is queued for analysis.",
      ),
    ).toBeInTheDocument();
  });

  expect(
    screen.getByText("Unable to refresh the saved analysis shell."),
  ).toBeInTheDocument();
  expect(window.location.search).toBe(
    "?job=33333333-3333-3333-3333-333333333333",
  );
});

test("updates the URL and responds to browser navigation for job history", async () => {
  const getJob = vi.mocked(api.getJob);
  const listJobs = vi.mocked(api.listJobs);

  listJobs.mockResolvedValue([
    {
      created_at: "2026-05-04T09:00:00Z",
      id: "11111111-1111-1111-1111-111111111111",
      input_mode: "public_video",
      source_url: "https://example.com/first",
      stage: "queued",
      status: "queued",
    },
    {
      created_at: "2026-05-04T10:00:00Z",
      id: "22222222-2222-2222-2222-222222222222",
      input_mode: "public_video",
      source_url: "https://example.com/second",
      stage: "queued",
      status: "running",
    },
  ]);
  getJob.mockImplementation(async (jobId) => {
    if (jobId === "11111111-1111-1111-1111-111111111111") {
      return {
        created_at: "2026-05-04T09:00:00Z",
        id: jobId,
        input_mode: "public_video",
        source_url: "https://example.com/first",
        stage: "queued",
        status: "queued",
      };
    }

    return {
      created_at: "2026-05-04T10:00:00Z",
      id: jobId,
      input_mode: "public_video",
      source_url: "https://example.com/second",
      stage: "queued",
      status: "running",
    };
  });

  render(<HomePage />);

  fireEvent.click(
    screen.getByRole("button", { name: /https:\/\/example.com\/second/i }),
  );

  await waitFor(() => {
    expect(
      screen.getByText(
        "Job 22222222-2222-2222-2222-222222222222 is running for analysis.",
      ),
    ).toBeInTheDocument();
  });

  expect(window.location.search).toBe(
    "?job=22222222-2222-2222-2222-222222222222",
  );

  window.history.pushState(
    {},
    "",
    "/?job=11111111-1111-1111-1111-111111111111",
  );
  window.dispatchEvent(new PopStateEvent("popstate"));

  await waitFor(() => {
    expect(
      screen.getByText(
        "Job 11111111-1111-1111-1111-111111111111 is queued for analysis.",
      ),
    ).toBeInTheDocument();
  });
});
