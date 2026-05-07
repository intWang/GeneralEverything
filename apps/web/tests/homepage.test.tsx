import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { act } from "@testing-library/react";
import { vi } from "vitest";

import HomePage from "../app/page";
import * as api from "../lib/api";
import * as sse from "../lib/sse";

vi.mock("../lib/api", () => ({
  createJob: vi.fn(),
  getJob: vi.fn(),
  listJobs: vi.fn(),
  submitJobQuestion: vi.fn(),
}));

vi.mock("../lib/sse", () => ({
  subscribeToJobEvents: vi.fn(),
}));

const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState({}, "", "/");
  vi.mocked(sse.subscribeToJobEvents).mockReturnValue(() => undefined);
  vi.mocked(api.listJobs).mockResolvedValue([]);
  vi.useRealTimers();
});

afterEach(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: originalScrollIntoView,
  });
});

test("renders a url-first homepage with lightweight supporting sections", () => {
  render(<HomePage />);
  const howItWorksSection = document.getElementById("how-it-works")!;
  const whatYouGetSection = document.getElementById("what-you-get")!;

  expect(
    screen.getByRole("heading", {
      name: "Paste a video URL. Get transcript, summary, and answers.",
    }),
  ).toBeInTheDocument();
  expect(screen.getByText("Fast video analysis")).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "Start analysis" }),
  ).toHaveAttribute("href", "#analysis-entry");
  expect(screen.getByText("YouTube")).toBeInTheDocument();
  expect(screen.getByText("Instagram")).toBeInTheDocument();
  expect(screen.getByText("TikTok")).toBeInTheDocument();
  expect(screen.getByText("Facebook")).toBeInTheDocument();
  expect(within(howItWorksSection).getByText("Paste URL")).toBeInTheDocument();
  expect(within(howItWorksSection).getByText("Analyze")).toBeInTheDocument();
  expect(within(howItWorksSection).getByText("Review")).toBeInTheDocument();
  expect(within(whatYouGetSection).getByText("Transcript")).toBeInTheDocument();
  expect(within(whatYouGetSection).getByText("Summary")).toBeInTheDocument();
  expect(within(whatYouGetSection).getByText("Ask AI")).toBeInTheDocument();
});

test("keeps the url input as the main above-the-fold action", () => {
  render(<HomePage />);

  expect(
    screen.getByRole("link", { name: "Start analysis" }),
  ).toHaveAttribute("href", "#analysis-entry");
  expect(screen.getByLabelText("Video source")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Analyze" })).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "How it works" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "What you get" }),
  ).toBeInTheDocument();
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
  expect(screen.getByRole("heading", { name: "Video info" })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "Summary" })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "Transcript" })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "Mind Map" })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "Ask AI" })).toBeInTheDocument();
  expect(
    screen.getByText(
      "Job 11111111-1111-1111-1111-111111111111 is queued for analysis.",
    ),
  ).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Recent jobs" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /https:\/\/example.com\/video/i })).toBeInTheDocument();
  expect(
    document
      .getElementById("results-workspace")
      ?.compareDocumentPosition(document.getElementById("how-it-works") ?? document.body) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});

test("scrolls the user into the results workspace after starting analysis", async () => {
  const createJob = vi.mocked(api.createJob);
  const getJob = vi.mocked(api.getJob);
  const scrollIntoView = vi.fn();

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

  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: scrollIntoView,
  });

  render(<HomePage />);

  fireEvent.change(screen.getByLabelText("Video source"), {
    target: { value: "https://example.com/video" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Analyze" }));

  await waitFor(() => {
    expect(scrollIntoView).toHaveBeenCalled();
  });
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

test("polls the active job while it is still running", async () => {
  const getJob = vi.mocked(api.getJob);
  const listJobs = vi.mocked(api.listJobs);
  const clearIntervalSpy = vi.spyOn(window, "clearInterval");
  let intervalCallback: (() => void) | null = null;
  const setIntervalSpy = vi
    .spyOn(window, "setInterval")
    .mockImplementation((callback: TimerHandler) => {
      intervalCallback = callback as () => void;
      return 1;
    });

  window.history.replaceState({}, "", "/?job=12121212-1212-1212-1212-121212121212");
  getJob
    .mockResolvedValueOnce({
      created_at: "2026-05-04T17:00:00Z",
      id: "12121212-1212-1212-1212-121212121212",
      input_mode: "public_video",
      source_url: "https://example.com/polling",
      stage: "queued",
      status: "queued",
    })
    .mockResolvedValueOnce({
      created_at: "2026-05-04T17:00:00Z",
      id: "12121212-1212-1212-1212-121212121212",
      input_mode: "public_video",
      source_url: "https://example.com/polling",
      stage: "summary_generated",
      status: "running",
      summary_preview_text: "Polled summary preview.",
      summary_status: "ready",
      title: "Polled update",
    });
  listJobs.mockResolvedValue([
    {
      created_at: "2026-05-04T17:00:00Z",
      id: "12121212-1212-1212-1212-121212121212",
      input_mode: "public_video",
      source_url: "https://example.com/polling",
      stage: "queued",
      status: "queued",
    },
  ]);

  render(<HomePage />);

  await waitFor(() => {
    expect(
      screen.getByText(
        "Job 12121212-1212-1212-1212-121212121212 is queued for analysis.",
      ),
    ).toBeInTheDocument();
  });

  await act(async () => {
    intervalCallback?.();
  });

  await waitFor(() => {
    expect(screen.getByText("Polled update")).toBeInTheDocument();
  });
  expect(
    screen.getByText(
      "Job 12121212-1212-1212-1212-121212121212 generated a summary shell preview.",
    ),
  ).toBeInTheDocument();
  expect(getJob).toHaveBeenCalledTimes(2);
  expect(setIntervalSpy).toHaveBeenCalled();

  setIntervalSpy.mockRestore();
  clearIntervalSpy.mockRestore();
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

test("refreshes the active job snapshot when a status event arrives", async () => {
  const getJob = vi.mocked(api.getJob);
  const listJobs = vi.mocked(api.listJobs);
  const subscribeToJobEvents = vi.mocked(sse.subscribeToJobEvents);
  let handlers:
    | {
        onEvent?: (event: { data: unknown; event: string }) => void;
      }
    | undefined;

  window.history.replaceState(
    {},
    "",
    "/?job=77777777-7777-7777-7777-777777777777",
  );
  getJob
    .mockResolvedValueOnce({
      created_at: "2026-05-04T16:00:00Z",
      id: "77777777-7777-7777-7777-777777777777",
      input_mode: "public_video",
      source_url: "https://example.com/live-refresh",
      stage: "queued",
      status: "queued",
      title: null,
    })
    .mockResolvedValueOnce({
      created_at: "2026-05-04T16:00:00Z",
      id: "77777777-7777-7777-7777-777777777777",
      input_mode: "public_video",
      source_url: "https://example.com/live-refresh",
      stage: "summary_generated",
      status: "running",
      summary_key_points_count: 2,
      summary_preview_text: "Summary shell generated from transcript preview.",
      summary_status: "ready",
      title: "Live refresh title",
    });
  listJobs.mockResolvedValue([
    {
      created_at: "2026-05-04T16:00:00Z",
      id: "77777777-7777-7777-7777-777777777777",
      input_mode: "public_video",
      source_url: "https://example.com/live-refresh",
      stage: "queued",
      status: "queued",
      title: null,
    },
  ]);
  subscribeToJobEvents.mockImplementation((_jobId, nextHandlers = {}) => {
    handlers = nextHandlers;
    return () => undefined;
  });

  render(<HomePage />);

  await waitFor(() => {
    expect(
      screen.getByText(
        "Job 77777777-7777-7777-7777-777777777777 is queued for analysis.",
      ),
    ).toBeInTheDocument();
  });

  handlers?.onEvent?.({
    event: "job.status",
    data: {
      job_id: "77777777-7777-7777-7777-777777777777",
      stage: "summary_generated",
      status: "running",
    },
  });

  await waitFor(() => {
    expect(screen.getByText("Live refresh title")).toBeInTheDocument();
  });

  expect(
    screen.getByText("Key point shells ready: 2"),
  ).toBeInTheDocument();
  expect(
    screen.getByText("Preview: Summary shell generated from transcript preview."),
  ).toBeInTheDocument();
  expect(getJob).toHaveBeenCalledTimes(2);
});

test("streams transcript text into the transcript tab as segment events arrive", async () => {
  const getJob = vi.mocked(api.getJob);
  const listJobs = vi.mocked(api.listJobs);
  const subscribeToJobEvents = vi.mocked(sse.subscribeToJobEvents);
  let handlers:
    | {
        onEvent?: (event: { data: unknown; event: string }) => void;
      }
    | undefined;

  window.history.replaceState(
    {},
    "",
    "/?job=17171717-1717-1717-1717-171717171717",
  );
  getJob.mockResolvedValue({
    created_at: "2026-05-04T16:05:00Z",
    id: "17171717-1717-1717-1717-171717171717",
    input_mode: "public_video",
    source_url: "https://example.com/live-transcript",
    stage: "transcript_ready",
    status: "running",
    transcript_audio_artifact_path:
      "var/transcripts/public-video/17171717-1717-1717-1717-171717171717.wav",
    transcript_extractor: "ffmpeg",
    transcript_status: "ready",
  });
  listJobs.mockResolvedValue([
    {
      created_at: "2026-05-04T16:05:00Z",
      id: "17171717-1717-1717-1717-171717171717",
      input_mode: "public_video",
      source_url: "https://example.com/live-transcript",
      stage: "transcript_ready",
      status: "running",
      transcript_audio_artifact_path:
        "var/transcripts/public-video/17171717-1717-1717-1717-171717171717.wav",
      transcript_extractor: "ffmpeg",
      transcript_status: "ready",
    },
  ]);
  subscribeToJobEvents.mockImplementation((_jobId, nextHandlers = {}) => {
    handlers = nextHandlers;
    return () => undefined;
  });

  render(<HomePage />);

  await waitFor(() => {
    expect(
      screen.getByText(
        "Job 17171717-1717-1717-1717-171717171717 is ready for transcript generation.",
      ),
    ).toBeInTheDocument();
  });

  fireEvent.click(screen.getByRole("tab", { name: "Transcript" }));

  handlers?.onEvent?.({
    event: "transcript.segment",
    data: {
      job_id: "17171717-1717-1717-1717-171717171717",
      transcript: {
        detected_language_code: "zh",
        detected_language_name: "Chinese",
        preview_text: "大家好，欢迎来到今天的会议。",
        segment_count: 1,
        source_segments: [
          {
            start: 3,
            end: 5.25,
            text: "大家好，欢迎来到今天的会议。",
          },
        ],
        source_text: "大家好，欢迎来到今天的会议。",
      },
    },
  });

  await waitFor(() => {
    expect(screen.getByText("Streaming transcript")).toBeInTheDocument();
  });

  expect(
    screen.getByText("大家好，欢迎来到今天的会议。"),
  ).toBeInTheDocument();
  expect(screen.getByText("00:03")).toBeInTheDocument();
  expect(screen.getByText("Detected language: Chinese")).toBeInTheDocument();
  expect(screen.getByText("Current language: Chinese")).toBeInTheDocument();
  expect(screen.getByText("Segment count: 1")).toBeInTheDocument();
  expect(
    screen.getByText("Preview: 大家好，欢迎来到今天的会议。"),
  ).toBeInTheDocument();
  expect(getJob).toHaveBeenCalledTimes(1);
});

test("renders persisted transcript segments from the hydrated job snapshot", async () => {
  const getJob = vi.mocked(api.getJob);
  const listJobs = vi.mocked(api.listJobs);

  window.history.replaceState(
    {},
    "",
    "/?job=18181818-1818-1818-1818-181818181818",
  );
  getJob.mockResolvedValue({
    created_at: "2026-05-04T16:15:00Z",
    detected_language_name: "English",
    id: "18181818-1818-1818-1818-181818181818",
    input_mode: "public_video",
    source_url: "https://example.com/persisted-transcript",
    stage: "transcript_generated",
    status: "running",
    transcript_segment_count: 1,
    transcript_source_segments: [
      {
        id: "seg-a",
        start_seconds: 3,
        end_seconds: 5.25,
        text: "Structured segment text.",
      },
    ],
    transcript_source_text: "Legacy fallback text.",
    transcript_status: "ready",
  });
  listJobs.mockResolvedValue([]);

  render(<HomePage />);

  await waitFor(() => {
    expect(screen.getByRole("heading", { name: "AI output" })).toBeInTheDocument();
  });

  fireEvent.click(screen.getByRole("tab", { name: "Transcript" }));

  expect(screen.getByText("00:03")).toBeInTheDocument();
  expect(screen.getByText("Structured segment text.")).toBeInTheDocument();
  expect(screen.queryByText("Legacy fallback text.")).not.toBeInTheDocument();
});

test("streams partial summary updates into the summary tab as events arrive", async () => {
  const getJob = vi.mocked(api.getJob);
  const listJobs = vi.mocked(api.listJobs);
  const subscribeToJobEvents = vi.mocked(sse.subscribeToJobEvents);
  let handlers:
    | {
        onEvent?: (event: { data: unknown; event: string }) => void;
      }
    | undefined;

  window.history.replaceState(
    {},
    "",
    "/?job=27272727-2727-2727-2727-272727272727",
  );
  getJob.mockResolvedValueOnce({
    created_at: "2026-05-04T16:20:00Z",
    id: "27272727-2727-2727-2727-272727272727",
    input_mode: "public_video",
    source_url: "https://example.com/live-summary",
    stage: "generating_transcript",
    status: "running",
    transcript_segment_count: 2,
    transcript_status: "processing",
  });
  listJobs.mockResolvedValue([
    {
      created_at: "2026-05-04T16:20:00Z",
      id: "27272727-2727-2727-2727-272727272727",
      input_mode: "public_video",
      source_url: "https://example.com/live-summary",
      stage: "generating_transcript",
      status: "running",
      transcript_segment_count: 2,
      transcript_status: "processing",
    },
  ]);
  subscribeToJobEvents.mockImplementation((_jobId, nextHandlers = {}) => {
    handlers = nextHandlers;
    return () => undefined;
  });

  render(<HomePage />);

  await waitFor(() => {
    expect(screen.getByRole("heading", { name: "AI output" })).toBeInTheDocument();
  });

  handlers?.onEvent?.({
    event: "summary.partial",
    data: {
      job_id: "27272727-2727-2727-2727-272727272727",
      summary: {
        key_points_count: 2,
        preview_text: "早期总结",
        source_bullets: ["产品发布时间已确认", "下周将进行团队培训"],
        source_text: "录音正在收敛到发布时间和培训安排。",
        stage: "generating_transcript",
        status: "processing",
      },
    },
  });

  await waitFor(() => {
    expect(
      screen.getByText("录音正在收敛到发布时间和培训安排。"),
    ).toBeInTheDocument();
  });

  expect(screen.getByText("Live summary draft")).toBeInTheDocument();
  expect(screen.getByText("产品发布时间已确认")).toBeInTheDocument();
  expect(screen.getByText("下周将进行团队培训")).toBeInTheDocument();
});

test("streams download progress into the active video info panel only", async () => {
  const getJob = vi.mocked(api.getJob);
  const listJobs = vi.mocked(api.listJobs);
  const subscribeToJobEvents = vi.mocked(sse.subscribeToJobEvents);
  let handlers:
    | {
        onEvent?: (event: { data: unknown; event: string }) => void;
      }
    | undefined;

  window.history.replaceState(
    {},
    "",
    "/?job=37373737-3737-3737-3737-373737373737",
  );
  getJob.mockResolvedValue({
    created_at: "2026-05-04T16:25:00Z",
    id: "37373737-3737-3737-3737-373737373737",
    input_mode: "public_video",
    source_url: "https://example.com/live-download",
    stage: "queued_download",
    status: "running",
  });
  listJobs.mockResolvedValue([
    {
      created_at: "2026-05-04T16:25:00Z",
      id: "37373737-3737-3737-3737-373737373737",
      input_mode: "public_video",
      source_url: "https://example.com/live-download",
      stage: "queued_download",
      status: "running",
    },
  ]);
  subscribeToJobEvents.mockImplementation((_jobId, nextHandlers = {}) => {
    handlers = nextHandlers;
    return () => undefined;
  });

  render(<HomePage />);

  await waitFor(() => {
    expect(
      screen.getByText(
        "Job 37373737-3737-3737-3737-373737373737 is queued for download preparation.",
      ),
    ).toBeInTheDocument();
  });

  handlers?.onEvent?.({
    event: "video.download.progress",
    data: {
      job_id: "48484848-4848-4848-4848-484848484848",
      progress: {
        downloaded_bytes: 750,
        eta_seconds: 2,
        percent: 75,
        speed_bytes_per_second: 300,
        status: "downloading",
        total_bytes: 1000,
      },
    },
  });

  expect(screen.queryByText("Download progress")).not.toBeInTheDocument();
  expect(screen.queryByText("75%")).not.toBeInTheDocument();

  handlers?.onEvent?.({
    event: "video.download.progress",
    data: {
      job_id: "37373737-3737-3737-3737-373737373737",
      progress: {
        downloaded_bytes: 500,
        eta_seconds: 5,
        percent: 50,
        speed_bytes_per_second: 100,
        status: "downloading",
        total_bytes: 1000,
      },
    },
  });

  await waitFor(() => {
    expect(screen.getByText("Download progress")).toBeInTheDocument();
  });

  expect(screen.getByText("50%")).toBeInTheDocument();
  expect(
    screen.getByText(
      "Job 37373737-3737-3737-3737-373737373737 is progressing through the download shell.",
    ),
  ).toBeInTheDocument();
});

test("keeps later stages when late download progress arrives", async () => {
  const getJob = vi.mocked(api.getJob);
  const listJobs = vi.mocked(api.listJobs);
  const subscribeToJobEvents = vi.mocked(sse.subscribeToJobEvents);
  let handlers:
    | {
        onEvent?: (event: { data: unknown; event: string }) => void;
      }
    | undefined;

  window.history.replaceState(
    {},
    "",
    "/?job=38383838-3838-3838-3838-383838383838",
  );
  getJob.mockResolvedValue({
    created_at: "2026-05-04T16:30:00Z",
    id: "38383838-3838-3838-3838-383838383838",
    input_mode: "public_video",
    source_url: "https://example.com/late-download-progress",
    stage: "download_ready",
    status: "running",
  });
  listJobs.mockResolvedValue([
    {
      created_at: "2026-05-04T16:30:00Z",
      id: "38383838-3838-3838-3838-383838383838",
      input_mode: "public_video",
      source_url: "https://example.com/late-download-progress",
      stage: "download_ready",
      status: "running",
    },
  ]);
  subscribeToJobEvents.mockImplementation((_jobId, nextHandlers = {}) => {
    handlers = nextHandlers;
    return () => undefined;
  });

  render(<HomePage />);

  await waitFor(() => {
    expect(
      screen.getByText(
        "Job 38383838-3838-3838-3838-383838383838 is ready for the download step.",
      ),
    ).toBeInTheDocument();
  });

  await act(async () => {
    handlers?.onEvent?.({
      event: "video.download.progress",
      data: {
        job_id: "38383838-3838-3838-3838-383838383838",
        progress: {
          percent: 50,
          status: "downloading",
        },
      },
    });
  });

  expect(screen.getByText("Download progress")).toBeInTheDocument();
  expect(screen.getByText("50%")).toBeInTheDocument();
  expect(
    screen.getByText(
      "Job 38383838-3838-3838-3838-383838383838 is ready for the download step.",
    ),
  ).toBeInTheDocument();
  expect(
    screen.queryByText(
      "Job 38383838-3838-3838-3838-383838383838 is progressing through the download shell.",
    ),
  ).not.toBeInTheDocument();
});

test("clears nullable download progress fields from later events", async () => {
  const getJob = vi.mocked(api.getJob);
  const listJobs = vi.mocked(api.listJobs);
  const subscribeToJobEvents = vi.mocked(sse.subscribeToJobEvents);
  let handlers:
    | {
        onEvent?: (event: { data: unknown; event: string }) => void;
      }
    | undefined;

  window.history.replaceState(
    {},
    "",
    "/?job=39393939-3939-3939-3939-393939393939",
  );
  getJob.mockResolvedValue({
    created_at: "2026-05-04T16:35:00Z",
    download_progress: {
      percent: 50,
      status: "downloading",
    },
    id: "39393939-3939-3939-3939-393939393939",
    input_mode: "public_video",
    source_url: "https://example.com/null-progress",
    stage: "downloading",
    status: "running",
  });
  listJobs.mockResolvedValue([
    {
      created_at: "2026-05-04T16:35:00Z",
      download_progress: {
        percent: 50,
        status: "downloading",
      },
      id: "39393939-3939-3939-3939-393939393939",
      input_mode: "public_video",
      source_url: "https://example.com/null-progress",
      stage: "downloading",
      status: "running",
    },
  ]);
  subscribeToJobEvents.mockImplementation((_jobId, nextHandlers = {}) => {
    handlers = nextHandlers;
    return () => undefined;
  });

  render(<HomePage />);

  await waitFor(() => {
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  await act(async () => {
    handlers?.onEvent?.({
      event: "video.download.progress",
      data: {
        job_id: "39393939-3939-3939-3939-393939393939",
        progress: {
          percent: null,
          status: "downloading",
        },
      },
    });
  });

  expect(screen.getByText("Download progress")).toBeInTheDocument();
  expect(screen.getByText("Pending")).toBeInTheDocument();
  expect(screen.queryByText("50%")).not.toBeInTheDocument();
});

test("ignores out-of-order status events for the same active job when refresh fails", async () => {
  const getJob = vi.mocked(api.getJob);
  const listJobs = vi.mocked(api.listJobs);
  const subscribeToJobEvents = vi.mocked(sse.subscribeToJobEvents);
  let handlers:
    | {
        onEvent?: (event: { data: unknown; event: string }) => void;
      }
    | undefined;

  window.history.replaceState(
    {},
    "",
    "/?job=91919191-9191-9191-9191-919191919191",
  );
  getJob
    .mockResolvedValueOnce({
      created_at: "2026-05-04T16:20:00Z",
      id: "91919191-9191-9191-9191-919191919191",
      input_mode: "public_video",
      source_url: "https://example.com/monotonic",
      stage: "summary_generated",
      status: "running",
      summary_key_points_count: 2,
      summary_preview_text: "Summary shell generated from transcript preview.",
      summary_status: "ready",
      title: "Newest active snapshot",
    })
    .mockRejectedValueOnce(new Error("stale refresh failed"));
  listJobs.mockResolvedValue([
    {
      created_at: "2026-05-04T16:20:00Z",
      id: "91919191-9191-9191-9191-919191919191",
      input_mode: "public_video",
      source_url: "https://example.com/monotonic",
      stage: "summary_generated",
      status: "running",
      summary_key_points_count: 2,
      summary_preview_text: "Summary shell generated from transcript preview.",
      summary_status: "ready",
      title: "Newest active snapshot",
    },
  ]);
  subscribeToJobEvents.mockImplementation((_jobId, nextHandlers = {}) => {
    handlers = nextHandlers;
    return () => undefined;
  });

  render(<HomePage />);

  await waitFor(() => {
    expect(screen.getByText("Newest active snapshot")).toBeInTheDocument();
  });

  handlers?.onEvent?.({
    event: "job.status",
    data: {
      job_id: "91919191-9191-9191-9191-919191919191",
      stage: "queued",
      status: "queued",
    },
  });

  await waitFor(() => {
    expect(getJob).toHaveBeenCalledTimes(2);
  });

  expect(screen.getByText("Newest active snapshot")).toBeInTheDocument();
  expect(
    screen.getByText(
      "Job 91919191-9191-9191-9191-919191919191 generated a summary shell preview.",
    ),
  ).toBeInTheDocument();
  expect(screen.getByText("Key point shells ready: 2")).toBeInTheDocument();
  expect(
    screen.queryByText(
      "Job 91919191-9191-9191-9191-919191919191 is queued for analysis.",
    ),
  ).not.toBeInTheDocument();
});

test("prefers completed over failed for same-stage terminal events", async () => {
  const getJob = vi.mocked(api.getJob);
  const listJobs = vi.mocked(api.listJobs);
  const subscribeToJobEvents = vi.mocked(sse.subscribeToJobEvents);
  let handlers:
    | {
        onEvent?: (event: { data: unknown; event: string }) => void;
      }
    | undefined;

  window.history.replaceState(
    {},
    "",
    "/?job=92929292-9292-9292-9292-929292929292",
  );
  getJob
    .mockResolvedValueOnce({
      created_at: "2026-05-04T16:25:00Z",
      id: "92929292-9292-9292-9292-929292929292",
      input_mode: "public_video",
      source_url: "https://example.com/terminal-order",
      stage: "mindmap_generated",
      status: "completed",
      title: "Completed terminal state",
    })
    .mockRejectedValueOnce(new Error("late failed refresh"));
  listJobs.mockResolvedValue([
    {
      created_at: "2026-05-04T16:25:00Z",
      id: "92929292-9292-9292-9292-929292929292",
      input_mode: "public_video",
      source_url: "https://example.com/terminal-order",
      stage: "mindmap_generated",
      status: "completed",
      title: "Completed terminal state",
    },
  ]);
  subscribeToJobEvents.mockImplementation((_jobId, nextHandlers = {}) => {
    handlers = nextHandlers;
    return () => undefined;
  });

  render(<HomePage />);

  await waitFor(() => {
    expect(
      screen.getByText(
        "Job 92929292-9292-9292-9292-929292929292 is completed for analysis.",
      ),
    ).toBeInTheDocument();
  });

  handlers?.onEvent?.({
    event: "job.status",
    data: {
      job_id: "92929292-9292-9292-9292-929292929292",
      stage: "mindmap_generated",
      status: "failed",
    },
  });

  await waitFor(() => {
    expect(getJob).toHaveBeenCalledTimes(2);
  });

  expect(
    screen.getByText(
      "Job 92929292-9292-9292-9292-929292929292 is completed for analysis.",
    ),
  ).toBeInTheDocument();
  expect(
    screen.queryByText(
      "Job 92929292-9292-9292-9292-929292929292 is failed for analysis.",
    ),
  ).not.toBeInTheDocument();
});

test("preserves newer fields when a stale successful refresh loses to current state", async () => {
  const getJob = vi.mocked(api.getJob);
  const listJobs = vi.mocked(api.listJobs);
  const subscribeToJobEvents = vi.mocked(sse.subscribeToJobEvents);
  let handlers:
    | {
        onEvent?: (event: { data: unknown; event: string }) => void;
      }
    | undefined;

  window.history.replaceState(
    {},
    "",
    "/?job=93939393-9393-9393-9393-939393939393",
  );
  getJob
    .mockResolvedValueOnce({
      created_at: "2026-05-04T16:30:00Z",
      id: "93939393-9393-9393-9393-939393939393",
      input_mode: "public_video",
      source_url: "https://example.com/stale-success",
      stage: "summary_generated",
      status: "running",
      summary_key_points_count: 2,
      summary_preview_text: "Newest summary preview should survive.",
      summary_status: "ready",
      title: "Newest hydrated title",
    })
    .mockResolvedValueOnce({
      created_at: "2026-05-04T16:30:00Z",
      id: "93939393-9393-9393-9393-939393939393",
      input_mode: "public_video",
      source_url: "https://example.com/stale-success",
      stage: "queued",
      status: "running",
      summary_key_points_count: null,
      summary_preview_text: null,
      summary_status: null,
      title: null,
    });
  listJobs.mockResolvedValue([
    {
      created_at: "2026-05-04T16:30:00Z",
      id: "93939393-9393-9393-9393-939393939393",
      input_mode: "public_video",
      source_url: "https://example.com/stale-success",
      stage: "summary_generated",
      status: "running",
      summary_key_points_count: 2,
      summary_preview_text: "Newest summary preview should survive.",
      summary_status: "ready",
      title: "Newest hydrated title",
    },
  ]);
  subscribeToJobEvents.mockImplementation((_jobId, nextHandlers = {}) => {
    handlers = nextHandlers;
    return () => undefined;
  });

  render(<HomePage />);

  await waitFor(() => {
    expect(screen.getByText("Newest hydrated title")).toBeInTheDocument();
  });

  handlers?.onEvent?.({
    event: "job.status",
    data: {
      job_id: "93939393-9393-9393-9393-939393939393",
      stage: "queued",
      status: "running",
    },
  });

  await waitFor(() => {
    expect(getJob).toHaveBeenCalledTimes(2);
  });

  expect(screen.getByText("Newest hydrated title")).toBeInTheDocument();
  expect(screen.getByText("Key point shells ready: 2")).toBeInTheDocument();
  expect(
    screen.getByText("Preview: Newest summary preview should survive."),
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      "Job 93939393-9393-9393-9393-939393939393 generated a summary shell preview.",
    ),
  ).toBeInTheDocument();
});

test("refreshes the active job snapshot when a qa.ready event arrives", async () => {
  const getJob = vi.mocked(api.getJob);
  const listJobs = vi.mocked(api.listJobs);
  const subscribeToJobEvents = vi.mocked(sse.subscribeToJobEvents);
  let handlers:
    | {
        onEvent?: (event: { data: unknown; event: string }) => void;
      }
    | undefined;

  window.history.replaceState(
    {},
    "",
    "/?job=78787878-7878-7878-7878-787878787878",
  );
  getJob
    .mockResolvedValueOnce({
      created_at: "2026-05-04T16:10:00Z",
      id: "78787878-7878-7878-7878-787878787878",
      input_mode: "public_video",
      source_url: "https://example.com/qa-ready",
      stage: "mindmap_generated",
      status: "running",
      summary_status: "ready",
      mindmap_status: "ready",
      transcript_segment_count: 2,
      title: "Before qa.ready",
    })
    .mockResolvedValueOnce({
      created_at: "2026-05-04T16:10:00Z",
      id: "78787878-7878-7878-7878-787878787878",
      input_mode: "public_video",
      source_url: "https://example.com/qa-ready",
      stage: "mindmap_generated",
      status: "running",
      summary_status: "ready",
      mindmap_status: "ready",
      transcript_segment_count: 3,
      title: "After qa.ready",
    });
  listJobs.mockResolvedValue([
    {
      created_at: "2026-05-04T16:10:00Z",
      id: "78787878-7878-7878-7878-787878787878",
      input_mode: "public_video",
      source_url: "https://example.com/qa-ready",
      stage: "mindmap_generated",
      status: "running",
      summary_status: "ready",
      mindmap_status: "ready",
      transcript_segment_count: 2,
      title: "Before qa.ready",
    },
  ]);
  subscribeToJobEvents.mockImplementation((_jobId, nextHandlers = {}) => {
    handlers = nextHandlers;
    return () => undefined;
  });

  render(<HomePage />);

  await waitFor(() => {
    expect(screen.getByText("Before qa.ready")).toBeInTheDocument();
  });

  handlers?.onEvent?.({
    event: "qa.ready",
    data: {
      job_id: "78787878-7878-7878-7878-787878787878",
      can_submit: true,
      transcript_segment_count: 3,
    },
  });

  await waitFor(() => {
    expect(screen.getByText("After qa.ready")).toBeInTheDocument();
  });

  fireEvent.click(screen.getByRole("tab", { name: "Ask AI" }));
  fireEvent.change(screen.getByLabelText("Ask a question"), {
    target: { value: "Can I ask now?" },
  });

  expect(
    screen.getByText("Ask AI shell is ready for grounded follow-ups"),
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Submit question" })).toBeEnabled();
  expect(getJob).toHaveBeenCalledTimes(2);
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

test("shows generating-transcript progress copy before the first transcript lines arrive", async () => {
  const getJob = vi.mocked(api.getJob);
  const listJobs = vi.mocked(api.listJobs);

  window.history.replaceState(
    {},
    "",
    "/?job=18181818-1818-1818-1818-181818181818",
  );
  getJob.mockResolvedValue({
    created_at: "2026-05-04T13:35:00Z",
    id: "18181818-1818-1818-1818-181818181818",
    input_mode: "public_video",
    source_url: "https://example.com/generating-transcript",
    stage: "generating_transcript",
    status: "running",
    transcript_audio_artifact_path:
      "var/transcripts/public-video/18181818-1818-1818-1818-181818181818.wav",
    transcript_extractor: "ffmpeg",
    transcript_status: "processing",
  });
  listJobs.mockResolvedValue([
    {
      created_at: "2026-05-04T13:35:00Z",
      id: "18181818-1818-1818-1818-181818181818",
      input_mode: "public_video",
      source_url: "https://example.com/generating-transcript",
      stage: "generating_transcript",
      status: "running",
      transcript_audio_artifact_path:
        "var/transcripts/public-video/18181818-1818-1818-1818-181818181818.wav",
      transcript_extractor: "ffmpeg",
      transcript_status: "processing",
    },
  ]);

  render(<HomePage />);

  await waitFor(() => {
    expect(
      screen.getByText(
        "Job 18181818-1818-1818-1818-181818181818 is decoding the first transcript lines.",
      ),
    ).toBeInTheDocument();
  });

  expect(
    screen.getByText(
      "Audio has been extracted and decoding is underway. The first transcript lines may take 30 to 90 seconds on longer videos.",
    ),
  ).toBeInTheDocument();

  fireEvent.click(screen.getByRole("tab", { name: "Transcript" }));

  expect(
    screen.getByText(
      "Audio artifact ready: var/transcripts/public-video/18181818-1818-1818-1818-181818181818.wav",
    ),
  ).toBeInTheDocument();
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

test("shows detected audio language in the video info panel after hydration", async () => {
  const getJob = vi.mocked(api.getJob);
  const listJobs = vi.mocked(api.listJobs);

  window.history.replaceState(
    {},
    "",
    "/?job=bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  );
  getJob.mockResolvedValue({
    created_at: "2026-05-04T14:00:00Z",
    detected_language_code: "zh",
    detected_language_name: "Chinese",
    id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    input_mode: "public_video",
    source_url: "https://example.com/chinese-video",
    stage: "summary_generated",
    status: "completed",
    summary_source_text: "会议确定了发布时间。",
    transcript_source_text: "大家好，欢迎来到今天的会议。",
  });
  listJobs.mockResolvedValue([
    {
      created_at: "2026-05-04T14:00:00Z",
      detected_language_code: "zh",
      detected_language_name: "Chinese",
      id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      input_mode: "public_video",
      source_url: "https://example.com/chinese-video",
      stage: "summary_generated",
      status: "completed",
      summary_source_text: "会议确定了发布时间。",
      transcript_source_text: "大家好，欢迎来到今天的会议。",
    },
  ]);

  render(<HomePage />);

  await waitFor(() => {
    expect(screen.getByText("Chinese")).toBeInTheDocument();
  });
});

test("hydrates cached summary translations and lets the user switch to them", async () => {
  const getJob = vi.mocked(api.getJob);
  const listJobs = vi.mocked(api.listJobs);

  window.history.replaceState(
    {},
    "",
    "/?job=cccccccc-cccc-cccc-cccc-cccccccccccc",
  );
  getJob.mockResolvedValue({
    created_at: "2026-05-04T14:30:00Z",
    detected_language_code: "zh",
    detected_language_name: "Chinese",
    id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
    input_mode: "public_video",
    source_url: "https://example.com/chinese-video",
    stage: "summary_generated",
    status: "completed",
    summary_source_text: "会议确定了发布时间。",
    summary_translations: { en: "The meeting confirmed the release date." },
    transcript_source_text: "大家好，欢迎来到今天的会议。",
  });
  listJobs.mockResolvedValue([
    {
      created_at: "2026-05-04T14:30:00Z",
      detected_language_code: "zh",
      detected_language_name: "Chinese",
      id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
      input_mode: "public_video",
      source_url: "https://example.com/chinese-video",
      stage: "summary_generated",
      status: "completed",
      summary_source_text: "会议确定了发布时间。",
      summary_translations: { en: "The meeting confirmed the release date." },
      transcript_source_text: "大家好，欢迎来到今天的会议。",
    },
  ]);

  render(<HomePage />);

  await waitFor(() => {
    expect(screen.getByRole("tab", { name: "Summary" })).toBeInTheDocument();
  });

  fireEvent.click(screen.getByRole("tab", { name: "Summary" }));

  expect(screen.getByText("会议确定了发布时间。")).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("Summary language"), {
    target: { value: "en" },
  });

  expect(screen.getByText("The meeting confirmed the release date.")).toBeInTheDocument();
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
    screen.getByText("Transcript is streaming live lines"),
  ).toBeInTheDocument();
});

test("surfaces the Ask AI ready shell for a completed revisited job", async () => {
  const getJob = vi.mocked(api.getJob);
  const listJobs = vi.mocked(api.listJobs);
  const submitJobQuestion = vi.mocked(api.submitJobQuestion);

  submitJobQuestion.mockResolvedValue({
    answer:
      'Grounded answer shell for "What should I follow up on?" based on the transcript, summary, and mind map shells currently available.',
    grounded: true,
    job_id: "44444444-4444-4444-4444-444444444444",
    question: "What should I follow up on?",
    references: ["Transcript shell", "Summary shell", "Mind map shell"],
  });

  window.history.replaceState(
    {},
    "",
    "/?job=44444444-4444-4444-4444-444444444444",
  );
  getJob.mockResolvedValue({
    created_at: "2026-05-04T12:00:00Z",
    id: "44444444-4444-4444-4444-444444444444",
    input_mode: "public_video",
    mindmap_status: "ready",
    source_url: "https://example.com/completed",
    stage: "building_mindmap",
    status: "completed",
    summary_status: "ready",
    transcript_segment_count: 3,
  });
  listJobs.mockResolvedValue([
    {
      created_at: "2026-05-04T12:00:00Z",
      id: "44444444-4444-4444-4444-444444444444",
      input_mode: "public_video",
      mindmap_status: "ready",
      source_url: "https://example.com/completed",
      stage: "building_mindmap",
      status: "completed",
      summary_status: "ready",
      transcript_segment_count: 3,
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
  await waitFor(() => {
    expect(
      screen.getByText(
        'Grounded answer shell for "What should I follow up on?" based on the transcript, summary, and mind map shells currently available.',
      ),
    ).toBeInTheDocument();
  });
});

test("resets Ask AI draft state when switching between jobs", async () => {
  const getJob = vi.mocked(api.getJob);
  const listJobs = vi.mocked(api.listJobs);
  const submitJobQuestion = vi.mocked(api.submitJobQuestion);

  submitJobQuestion.mockResolvedValue({
    answer:
      'Grounded answer shell for "What should I follow up on?" based on the transcript, summary, and mind map shells currently available.',
    grounded: true,
    job_id: "44444444-4444-4444-4444-444444444444",
    question: "What should I follow up on?",
    references: ["Transcript shell", "Summary shell", "Mind map shell"],
  });

  listJobs.mockResolvedValue([
    {
      created_at: "2026-05-04T12:00:00Z",
      id: "44444444-4444-4444-4444-444444444444",
      input_mode: "public_video",
      mindmap_status: "ready",
      source_url: "https://example.com/completed-a",
      stage: "building_mindmap",
      status: "completed",
      summary_status: "ready",
      transcript_segment_count: 3,
    },
    {
      created_at: "2026-05-04T12:05:00Z",
      id: "77777777-7777-7777-7777-777777777777",
      input_mode: "public_video",
      mindmap_status: "ready",
      source_url: "https://example.com/completed-b",
      stage: "building_mindmap",
      status: "completed",
      summary_status: "ready",
      transcript_segment_count: 3,
    },
  ]);
  getJob.mockImplementation(async (jobId) => {
    if (jobId === "44444444-4444-4444-4444-444444444444") {
      return {
        created_at: "2026-05-04T12:00:00Z",
        id: jobId,
        input_mode: "public_video",
        mindmap_status: "ready",
        source_url: "https://example.com/completed-a",
        stage: "building_mindmap",
        status: "completed",
        summary_status: "ready",
        transcript_segment_count: 3,
      };
    }

    return {
      created_at: "2026-05-04T12:05:00Z",
      id: jobId,
      input_mode: "public_video",
      mindmap_status: "ready",
      source_url: "https://example.com/completed-b",
      stage: "building_mindmap",
      status: "completed",
      summary_status: "ready",
      transcript_segment_count: 3,
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

  await waitFor(() => {
    expect(
      screen.getByText(
        'Grounded answer shell for "What should I follow up on?" based on the transcript, summary, and mind map shells currently available.',
      ),
    ).toBeInTheDocument();
  });

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
    screen.queryByText(
      'Grounded answer shell for "What should I follow up on?" based on the transcript, summary, and mind map shells currently available.',
    ),
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

  const secondJobButton = await screen.findByRole("button", {
    name: /https:\/\/example.com\/second/i,
  });
  fireEvent.click(
    secondJobButton,
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

test("ignores stale hydration responses when a newer history selection resolves first", async () => {
  const getJob = vi.mocked(api.getJob);
  const listJobs = vi.mocked(api.listJobs);
  let resolveFirstSelection:
    | ((value: Awaited<ReturnType<typeof api.getJob>>) => void)
    | undefined;
  let resolveSecondSelection:
    | ((value: Awaited<ReturnType<typeof api.getJob>>) => void)
    | undefined;

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
  getJob.mockImplementation(
    (jobId) =>
      new Promise((resolve) => {
        if (jobId === "11111111-1111-1111-1111-111111111111") {
          resolveFirstSelection = resolve;
          return;
        }

        resolveSecondSelection = resolve;
      }),
  );

  render(<HomePage />);

  fireEvent.click(
    await screen.findByRole("button", {
      name: /https:\/\/example.com\/first/i,
    }),
  );
  fireEvent.click(
    screen.getByRole("button", {
      name: /https:\/\/example.com\/second/i,
    }),
  );

  resolveSecondSelection?.({
    created_at: "2026-05-04T10:00:00Z",
    id: "22222222-2222-2222-2222-222222222222",
    input_mode: "public_video",
    source_url: "https://example.com/second",
    stage: "queued",
    status: "running",
    title: "Second selection wins",
  });

  await waitFor(() => {
    expect(
      screen.getByText(
        "Job 22222222-2222-2222-2222-222222222222 is running for analysis.",
      ),
    ).toBeInTheDocument();
  });
  expect(screen.getByText("Second selection wins")).toBeInTheDocument();
  expect(window.location.search).toBe(
    "?job=22222222-2222-2222-2222-222222222222",
  );

  resolveFirstSelection?.({
    created_at: "2026-05-04T09:00:00Z",
    id: "11111111-1111-1111-1111-111111111111",
    input_mode: "public_video",
    source_url: "https://example.com/first",
    stage: "queued",
    status: "queued",
    title: "Late first selection",
  });

  await waitFor(() => {
    expect(screen.getByText("Second selection wins")).toBeInTheDocument();
  });
  expect(screen.queryByText("Late first selection")).not.toBeInTheDocument();
  expect(
    screen.queryByText(
      "Job 11111111-1111-1111-1111-111111111111 is queued for analysis.",
    ),
  ).not.toBeInTheDocument();
});

test("makes a history selection active immediately before hydration resolves", async () => {
  const getJob = vi.mocked(api.getJob);
  const listJobs = vi.mocked(api.listJobs);
  const subscribeToJobEvents = vi.mocked(sse.subscribeToJobEvents);
  const handlersByJobId = new Map<
    string,
    {
      onEvent?: (event: { data: unknown; event: string }) => void;
    }
  >();
  let resolveSecondHydration:
    | ((value: Awaited<ReturnType<typeof api.getJob>>) => void)
    | undefined;

  listJobs.mockResolvedValue([
    {
      created_at: "2026-05-04T09:00:00Z",
      id: "11111111-1111-1111-1111-111111111111",
      input_mode: "public_video",
      source_url: "https://example.com/first",
      stage: "queued",
      status: "queued",
      title: "First job",
    },
    {
      created_at: "2026-05-04T10:00:00Z",
      id: "22222222-2222-2222-2222-222222222222",
      input_mode: "public_video",
      source_url: "https://example.com/second",
      stage: "queued",
      status: "queued",
      title: "Second history snapshot",
    },
  ]);
  getJob.mockImplementation((jobId) => {
    if (jobId === "11111111-1111-1111-1111-111111111111") {
      return Promise.resolve({
        created_at: "2026-05-04T09:00:00Z",
        id: jobId,
        input_mode: "public_video",
        source_url: "https://example.com/first",
        stage: "queued",
        status: "queued",
        title: "First hydrated job",
      });
    }

    return new Promise((resolve) => {
      resolveSecondHydration = resolve;
    });
  });
  subscribeToJobEvents.mockImplementation((jobId, handlers = {}) => {
    handlersByJobId.set(jobId, handlers);
    return () => undefined;
  });

  window.history.replaceState(
    {},
    "",
    "/?job=11111111-1111-1111-1111-111111111111",
  );

  render(<HomePage />);

  await waitFor(() => {
    expect(screen.getByText("First hydrated job")).toBeInTheDocument();
  });

  fireEvent.click(
    screen.getByRole("button", { name: /https:\/\/example.com\/second/i }),
  );

  expect(
    screen.getByText("Job 22222222-2222-2222-2222-222222222222 is queued for analysis."),
  ).toBeInTheDocument();
  expect(screen.getByText("Second history snapshot")).toBeInTheDocument();

  handlersByJobId.get("11111111-1111-1111-1111-111111111111")?.onEvent?.({
    event: "job.status",
    data: {
      job_id: "11111111-1111-1111-1111-111111111111",
      stage: "summary_generated",
      status: "completed",
    },
  });

  expect(
    screen.getByText(
      "Job 22222222-2222-2222-2222-222222222222 is queued for analysis.",
    ),
  ).toBeInTheDocument();
  expect(getJob).toHaveBeenCalledTimes(2);

  resolveSecondHydration?.({
    created_at: "2026-05-04T10:00:00Z",
    id: "22222222-2222-2222-2222-222222222222",
    input_mode: "public_video",
    source_url: "https://example.com/second",
    stage: "queued",
    status: "queued",
    title: "Second hydrated job",
  });

  await waitFor(() => {
    expect(screen.getByText("Second hydrated job")).toBeInTheDocument();
  });

  expect(screen.queryByText("First hydrated job")).not.toBeInTheDocument();
  expect(
    screen.queryByText(
      "Job 22222222-2222-2222-2222-222222222222 is completed for analysis.",
    ),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("radio", { name: "Public Video URL" }),
  ).toBeChecked();
  expect(
    screen.getByRole("radio", { name: "RingCentral Recording URL" }),
  ).not.toBeChecked();
});
