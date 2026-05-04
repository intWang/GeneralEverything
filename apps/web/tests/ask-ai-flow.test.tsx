import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import HomePage from "../app/page";
import { buildAskAiMockReferences } from "./ask-ai-test-helpers";
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

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState({}, "", "/");
  vi.mocked(sse.subscribeToJobEvents).mockReturnValue(() => undefined);
  vi.mocked(api.listJobs).mockResolvedValue([]);
});

test("renders the backend Ask AI response from the homepage workspace after submission resolves", async () => {
  const getJob = vi.mocked(api.getJob);
  const listJobs = vi.mocked(api.listJobs);
  const submitJobQuestion = vi.mocked(api.submitJobQuestion);
  let resolveQuestion:
    | ((value: api.SubmitJobQuestionResponse) => void)
    | undefined;

  submitJobQuestion.mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveQuestion = resolve;
      }),
  );

  window.history.replaceState(
    {},
    "",
    "/?job=55555555-5555-5555-5555-555555555555",
  );
  getJob.mockResolvedValue({
    created_at: "2026-05-04T13:00:00Z",
    id: "55555555-5555-5555-5555-555555555555",
    input_mode: "public_video",
    mindmap_status: "ready",
    source_url: "https://example.com/ask-ai-ready",
    stage: "mindmap_generated",
    status: "running",
    summary_status: "ready",
    transcript_segment_count: 3,
  });
  listJobs.mockResolvedValue([
    {
      created_at: "2026-05-04T13:00:00Z",
      id: "55555555-5555-5555-5555-555555555555",
      input_mode: "public_video",
      mindmap_status: "ready",
      source_url: "https://example.com/ask-ai-ready",
      stage: "mindmap_generated",
      status: "running",
      summary_status: "ready",
      transcript_segment_count: 3,
    },
  ]);

  render(<HomePage />);

  await waitFor(() => {
    expect(
      screen.getByText(
        "Job 55555555-5555-5555-5555-555555555555 generated a mind map shell preview.",
      ),
    ).toBeInTheDocument();
  });

  fireEvent.click(screen.getByRole("tab", { name: "Ask AI" }));
  fireEvent.change(screen.getByLabelText("Ask a question"), {
    target: { value: "What should I review next?" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Submit question" }));

  expect(
    screen.getByText("Ask AI shell is ready for grounded follow-ups"),
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Submitting..." })).toBeDisabled();
  expect(
    screen.getByText(
      "Submit a question to reserve this panel for the grounded answer shell that a later task will hydrate.",
    ),
  ).toBeInTheDocument();
  expect(screen.queryByText("References")).not.toBeInTheDocument();

  resolveQuestion?.({
    answer:
      'Grounded answer shell for "What should I review next?" based on the transcript, summary, and mind map shells currently available.',
    grounded: true,
    job_id: "55555555-5555-5555-5555-555555555555",
    question: "What should I review next?",
    references: buildAskAiMockReferences("homepage.wav"),
  });

  await waitFor(() => {
    expect(
      screen.getByText(
        'Grounded answer shell for "What should I review next?" based on the transcript, summary, and mind map shells currently available.',
      ),
    ).toBeInTheDocument();
  });
  await waitFor(() => {
    expect(screen.getByText("References")).toBeInTheDocument();
    expect(
      screen.getByText(
        buildAskAiMockReferences("homepage.wav")[0],
      ),
    ).toBeInTheDocument();
  });
});

test("keeps Ask AI submission blocked while grounding is still stabilizing", async () => {
  const getJob = vi.mocked(api.getJob);
  const listJobs = vi.mocked(api.listJobs);

  window.history.replaceState(
    {},
    "",
    "/?job=66666666-6666-6666-6666-666666666666",
  );
  getJob.mockResolvedValue({
    created_at: "2026-05-04T14:00:00Z",
    id: "66666666-6666-6666-6666-666666666666",
    input_mode: "public_video",
    source_url: "https://example.com/ask-ai-processing",
    stage: "building_summary",
    status: "running",
  });
  listJobs.mockResolvedValue([
    {
      created_at: "2026-05-04T14:00:00Z",
      id: "66666666-6666-6666-6666-666666666666",
      input_mode: "public_video",
      source_url: "https://example.com/ask-ai-processing",
      stage: "building_summary",
      status: "running",
    },
  ]);

  render(<HomePage />);

  await waitFor(() => {
    expect(
      screen.getByText(
        "Job 66666666-6666-6666-6666-666666666666 is running for analysis.",
      ),
    ).toBeInTheDocument();
  });

  fireEvent.click(screen.getByRole("tab", { name: "Ask AI" }));
  fireEvent.change(screen.getByLabelText("Ask a question"), {
    target: { value: "Can I ask yet?" },
  });

  expect(
    screen.getByText("Ask AI is preparing grounded answers"),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Submit question" }),
  ).toBeDisabled();
  expect(screen.queryByText('Answer placeholder for "Can I ask yet?"')).not.toBeInTheDocument();
});
