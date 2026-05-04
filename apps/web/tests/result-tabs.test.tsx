import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import { buildAskAiMockReferences } from "./ask-ai-test-helpers";
import { AITabs } from "../components/ai-tabs";
import * as api from "../lib/api";

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../lib/api")>("../lib/api");

  return {
    ...actual,
    submitJobQuestion: vi.fn(),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

test("renders the four AI tabs", () => {
  render(<AITabs />);

  expect(screen.getByRole("tab", { name: "Summary" })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "Transcript" })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "Mind Map" })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "Ask AI" })).toBeInTheDocument();
});

test("shows the progressive summary state by default", () => {
  render(<AITabs />);

  expect(
    screen.getByText("Summary is waiting for transcript context"),
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      "Summary stays idle until enough transcript windows are stable enough to condense into trustworthy takeaways.",
    ),
  ).toBeInTheDocument();
});

test("switches between progressive AI result states", () => {
  render(<AITabs jobStage="generating_transcript" jobStatus="running" />);

  expect(
    screen.getByText("Summary is waiting for transcript context"),
  ).toBeInTheDocument();
  expect(screen.getByText("Queued")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("tab", { name: "Transcript" }));
  expect(
    screen.getByText("Transcript is streaming provisional lines"),
  ).toBeInTheDocument();
  expect(screen.getByText("Partial")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("tab", { name: "Mind Map" }));
  expect(
    screen.getByText("Mind map is waiting for stable summary structure"),
  ).toBeInTheDocument();
  expect(screen.getByText("Queued")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("tab", { name: "Ask AI" }));
  expect(
    screen.getByText(
      "Ask AI is waiting for grounded context",
    ),
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      "Grounding unlocks after transcript coverage and a stable summary shell are available.",
    ),
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Submit question" })).toBeDisabled();
});

test("shows complete-style shells for a completed job", () => {
  vi.mocked(api.submitJobQuestion).mockResolvedValue({
    answer:
      'Grounded answer shell for "What should I review first?" based on the transcript, summary, and mind map shells currently available.',
    grounded: true,
    job_id: "completed-job",
    question: "What should I review first?",
    references: [
      "Transcript: Transcript shell generated for completed.wav.",
      "Summary: Summary shell generated from transcript preview.",
      "Mind map: Mind map shell generated from summary preview.",
    ],
  });

  render(
    <AITabs activeJobId="completed-job" jobStage="building_summary" jobStatus="completed" />,
  );

  expect(
    screen.getByText("Summary shell is ready for finalized takeaways"),
  ).toBeInTheDocument();
  expect(screen.getByText("Complete")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("tab", { name: "Transcript" }));
  expect(
    screen.getByText("Transcript shell is ready for finalized segments"),
  ).toBeInTheDocument();

  fireEvent.click(screen.getByRole("tab", { name: "Mind Map" }));
  expect(
    screen.getByText("Mind map shell is ready for the final topic tree"),
  ).toBeInTheDocument();

  fireEvent.click(screen.getByRole("tab", { name: "Ask AI" }));
  fireEvent.change(screen.getByLabelText("Ask a question"), {
    target: { value: "What should I review first?" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Submit question" }));

  expect(
    screen.getByText("Ask AI shell is ready for grounded follow-ups"),
  ).toBeInTheDocument();
  expect(
    screen.getByText("Grounding source: finalized transcript and summary shells."),
  ).toBeInTheDocument();
  return waitFor(() => {
    expect(
      screen.getByText(
        'Grounded answer shell for "What should I review first?" based on the transcript, summary, and mind map shells currently available.',
      ),
    ).toBeInTheDocument();
  });
});

test("keeps summary queued during transcript-stage running jobs", () => {
  render(<AITabs jobStage="generating_transcript" jobStatus="running" />);

  expect(
    screen.getByText("Summary is waiting for transcript context"),
  ).toBeInTheDocument();
  expect(screen.getByText("Queued")).toBeInTheDocument();
});

test("keeps mind map queued during summary-stage running jobs", () => {
  render(<AITabs jobStage="building_summary" jobStatus="running" />);

  fireEvent.click(screen.getByRole("tab", { name: "Mind Map" }));

  expect(
    screen.getByText("Mind map is waiting for stable summary structure"),
  ).toBeInTheDocument();
  expect(screen.getByText("Queued")).toBeInTheDocument();
});

test("shows blocked shells for failed jobs", () => {
  render(<AITabs jobStage="generating_transcript" jobStatus="failed" />);

  expect(
    screen.getByText("Summary is blocked until the job can resume"),
  ).toBeInTheDocument();
  expect(screen.getByText("Failed")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("tab", { name: "Transcript" }));
  expect(
    screen.getByText("Transcript could not finish processing"),
  ).toBeInTheDocument();

  fireEvent.click(screen.getByRole("tab", { name: "Mind Map" }));
  expect(
    screen.getByText("Mind map is blocked by the failed analysis run"),
  ).toBeInTheDocument();

  fireEvent.click(screen.getByRole("tab", { name: "Ask AI" }));
  expect(
    screen.getByText("Ask AI is blocked by the failed analysis run"),
  ).toBeInTheDocument();
  expect(
    screen.getByText("Grounding is unavailable until this analysis is rerun successfully."),
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Submit question" })).toBeDisabled();
});

test("shows Ask AI in grounding mode while summary context is still stabilizing", () => {
  render(<AITabs jobStage="building_summary" jobStatus="running" />);

  fireEvent.click(screen.getByRole("tab", { name: "Ask AI" }));

  expect(
    screen.getByText("Ask AI is preparing grounded answers"),
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      "Grounding is still shifting, so questions can be drafted but not submitted yet.",
    ),
  ).toBeInTheDocument();
  expect(screen.getByLabelText("Ask a question")).toBeEnabled();
  expect(screen.getByRole("button", { name: "Submit question" })).toBeDisabled();
});

test("unlocks Ask AI once transcript threshold and stable shells are available", () => {
  render(
    <AITabs
      activeJobId="job-123"
      jobStage="mindmap_generated"
      jobStatus="running"
      mindmapStatus="ready"
      summaryStatus="ready"
      transcriptSegmentCount={3}
    />,
  );

  fireEvent.click(screen.getByRole("tab", { name: "Ask AI" }));
  fireEvent.change(screen.getByLabelText("Ask a question"), {
    target: { value: "What should I review next?" },
  });

  expect(
    screen.getByText("Ask AI shell is ready for grounded follow-ups"),
  ).toBeInTheDocument();
  expect(
    screen.getByText("Grounding source: finalized transcript and summary shells."),
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Submit question" })).toBeEnabled();
});

test("submits a grounded Ask AI question and renders the backend answer shell", async () => {
  vi.mocked(api.submitJobQuestion).mockResolvedValue({
    answer:
      'Grounded answer shell for "What should I review next?" based on the transcript, summary, and mind map shells currently available.',
    grounded: true,
    job_id: "job-123",
    question: "What should I review next?",
    references: buildAskAiMockReferences("222.wav"),
  });

  render(
    <AITabs
      activeJobId="job-123"
      jobStage="mindmap_generated"
      jobStatus="running"
      mindmapStatus="ready"
      summaryStatus="ready"
      transcriptSegmentCount={3}
    />,
  );

  fireEvent.click(screen.getByRole("tab", { name: "Ask AI" }));
  fireEvent.change(screen.getByLabelText("Ask a question"), {
    target: { value: "What should I review next?" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Submit question" }));

  await waitFor(() => {
    expect(api.submitJobQuestion).toHaveBeenCalledWith(
      "job-123",
      "What should I review next?",
    );
  });
  expect(
    screen.getByText(
      'Grounded answer shell for "What should I review next?" based on the transcript, summary, and mind map shells currently available.',
    ),
  ).toBeInTheDocument();
  expect(screen.getByText("References")).toBeInTheDocument();
  expect(
    screen.getByText(
      buildAskAiMockReferences("222.wav")[0],
    ),
  ).toBeInTheDocument();
});

test("shows a submitting state while a grounded Ask AI question is in flight", async () => {
  let resolveQuestion: ((value: api.SubmitJobQuestionResponse) => void) | null = null;
  vi.mocked(api.submitJobQuestion).mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveQuestion = resolve;
      }),
  );

  render(
    <AITabs
      activeJobId="job-123"
      jobStage="mindmap_generated"
      jobStatus="running"
      mindmapStatus="ready"
      summaryStatus="ready"
      transcriptSegmentCount={3}
    />,
  );

  fireEvent.click(screen.getByRole("tab", { name: "Ask AI" }));
  fireEvent.change(screen.getByLabelText("Ask a question"), {
    target: { value: "What should I review next?" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Submit question" }));

  expect(screen.getByLabelText("Ask a question")).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "Submitting..." }),
  ).toBeDisabled();
  expect(
    screen.getByText(
      "Submit a question to reserve this panel for the grounded answer shell that a later task will hydrate.",
    ),
  ).toBeInTheDocument();
  expect(
    screen.queryByText(
      'Grounded answer shell for "What should I review next?" based on the transcript, summary, and mind map shells currently available.',
    ),
  ).not.toBeInTheDocument();
  expect(screen.queryByText("References")).not.toBeInTheDocument();

  resolveQuestion?.({
    answer:
      'Grounded answer shell for "What should I review next?" based on the transcript, summary, and mind map shells currently available.',
    grounded: true,
    job_id: "job-123",
    question: "What should I review next?",
    references: buildAskAiMockReferences("222.wav"),
  });

  await waitFor(() => {
    expect(
      screen.getByText(
        'Grounded answer shell for "What should I review next?" based on the transcript, summary, and mind map shells currently available.',
      ),
    ).toBeInTheDocument();
  });
});

test("shows a grounded-specific error when the backend rejects a question as not ready", async () => {
  vi.mocked(api.submitJobQuestion).mockRejectedValue(
    new api.ApiError(
      "Request failed: 409",
      409,
      "Ask AI is not ready for grounded questions yet",
    ),
  );

  render(
    <AITabs
      activeJobId="job-123"
      jobStage="mindmap_generated"
      jobStatus="running"
      mindmapStatus="ready"
      summaryStatus="ready"
      transcriptSegmentCount={3}
    />,
  );

  fireEvent.click(screen.getByRole("tab", { name: "Ask AI" }));
  fireEvent.change(screen.getByLabelText("Ask a question"), {
    target: { value: "What should I review next?" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Submit question" }));

  await waitFor(() => {
    expect(
      screen.getByText(
        "Grounded context is still settling. Try again after more transcript and summary data land.",
      ),
    ).toBeInTheDocument();
  });
});

test("clears the previous Ask AI answer when the active job changes", async () => {
  vi.mocked(api.submitJobQuestion).mockResolvedValue({
    answer:
      'Grounded answer shell for "What should I review next?" based on the transcript, summary, and mind map shells currently available.',
    grounded: true,
    job_id: "job-123",
    question: "What should I review next?",
    references: buildAskAiMockReferences("222.wav"),
  });

  const { rerender } = render(
    <AITabs
      activeJobId="job-123"
      jobStage="mindmap_generated"
      jobStatus="running"
      mindmapStatus="ready"
      summaryStatus="ready"
      transcriptSegmentCount={3}
    />,
  );

  fireEvent.click(screen.getByRole("tab", { name: "Ask AI" }));
  fireEvent.change(screen.getByLabelText("Ask a question"), {
    target: { value: "What should I review next?" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Submit question" }));

  await waitFor(() => {
    expect(
      screen.getByText(
        'Grounded answer shell for "What should I review next?" based on the transcript, summary, and mind map shells currently available.',
      ),
    ).toBeInTheDocument();
  });

  rerender(
    <AITabs
      activeJobId="job-456"
      jobStage="mindmap_generated"
      jobStatus="running"
      mindmapStatus="ready"
      summaryStatus="ready"
      transcriptSegmentCount={3}
    />,
  );

  expect(
    screen.queryByText(
      'Grounded answer shell for "What should I review next?" based on the transcript, summary, and mind map shells currently available.',
    ),
  ).not.toBeInTheDocument();
  expect(screen.getByLabelText("Ask a question")).toHaveValue("");
});

test("preserves the drafted question when Ask AI shell state progresses", () => {
  const { rerender } = render(
    <AITabs activeJobId="job-123" jobStage="generating_transcript" jobStatus="running" />,
  );

  fireEvent.click(screen.getByRole("tab", { name: "Ask AI" }));
  fireEvent.change(screen.getByLabelText("Ask a question"), {
    target: { value: "Hold this draft for later" },
  });

  rerender(
    <AITabs
      activeJobId="job-123"
      jobStage="mindmap_generated"
      jobStatus="running"
      mindmapStatus="ready"
      summaryStatus="ready"
      transcriptSegmentCount={3}
    />,
  );

  expect(screen.getByLabelText("Ask a question")).toHaveValue("Hold this draft for later");
});

test("ignores stale Ask AI responses after the shell state changes", async () => {
  let resolveQuestion: ((value: api.SubmitJobQuestionResponse) => void) | null = null;
  vi.mocked(api.submitJobQuestion).mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveQuestion = resolve;
      }),
  );

  const { rerender } = render(
    <AITabs
      activeJobId="job-123"
      jobStage="mindmap_generated"
      jobStatus="running"
      mindmapStatus="ready"
      summaryStatus="ready"
      transcriptSegmentCount={3}
    />,
  );

  fireEvent.click(screen.getByRole("tab", { name: "Ask AI" }));
  fireEvent.change(screen.getByLabelText("Ask a question"), {
    target: { value: "What should I review next?" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Submit question" }));

  rerender(
    <AITabs activeJobId="job-123" jobStage="building_summary" jobStatus="running" />,
  );

  resolveQuestion?.({
    answer:
      'Grounded answer shell for "What should I review next?" based on the transcript, summary, and mind map shells currently available.',
    grounded: true,
    job_id: "job-123",
    question: "What should I review next?",
    references: buildAskAiMockReferences("222.wav"),
  });

  await waitFor(() => {
    expect(screen.getByText("Ask AI is preparing grounded answers")).toBeInTheDocument();
  });
  expect(
    screen.queryByText(
      'Grounded answer shell for "What should I review next?" based on the transcript, summary, and mind map shells currently available.',
    ),
  ).not.toBeInTheDocument();
});

test("prevents overlapping Ask AI submissions while a question is in flight", async () => {
  let resolveQuestion: ((value: api.SubmitJobQuestionResponse) => void) | null = null;
  vi.mocked(api.submitJobQuestion).mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveQuestion = resolve;
      }),
  );

  render(
    <AITabs
      activeJobId="job-123"
      jobStage="mindmap_generated"
      jobStatus="running"
      mindmapStatus="ready"
      summaryStatus="ready"
      transcriptSegmentCount={3}
    />,
  );

  fireEvent.click(screen.getByRole("tab", { name: "Ask AI" }));
  fireEvent.change(screen.getByLabelText("Ask a question"), {
    target: { value: "What should I review next?" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Submit question" }));

  await waitFor(() => {
    expect(screen.getByRole("button", { name: "Submitting..." })).toBeDisabled();
  });

  expect(api.submitJobQuestion).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText("Ask a question")).toBeDisabled();

  fireEvent.click(screen.getByRole("button", { name: "Submitting..." }));

  expect(api.submitJobQuestion).toHaveBeenCalledTimes(1);

  resolveQuestion?.({
    answer:
      'Grounded answer shell for "What should I review next?" based on the transcript, summary, and mind map shells currently available.',
    grounded: true,
    job_id: "job-123",
    question: "What should I review next?",
    references: buildAskAiMockReferences("222.wav"),
  });

  await waitFor(() => {
    expect(screen.getByRole("button", { name: "Submit question" })).toBeEnabled();
  });
});

test("shows transcript-ready shell details when audio extraction is complete", () => {
  render(
    <AITabs
      jobStage="transcript_ready"
      jobStatus="running"
      transcriptAudioArtifactPath="var/transcripts/public-video/111.wav"
      transcriptExtractor="ffmpeg"
    />,
  );

  fireEvent.click(screen.getByRole("tab", { name: "Transcript" }));

  expect(
    screen.getByText("Transcript is preparing its first lines"),
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      "Audio extraction finished and the transcript worker shell is ready for speech recognition.",
    ),
  ).toBeInTheDocument();
  expect(
    screen.getByText("Audio artifact ready: var/transcripts/public-video/111.wav"),
  ).toBeInTheDocument();
  expect(screen.getByText("Extractor: ffmpeg")).toBeInTheDocument();
});

test("shows transcript-generated shell preview details", () => {
  render(
    <AITabs
      jobStage="transcript_generated"
      jobStatus="running"
      transcriptAudioArtifactPath="var/transcripts/public-video/222.wav"
      transcriptExtractor="ffmpeg"
      transcriptPreviewText="Transcript shell generated for 222.wav. Real speech recognition is not wired in yet."
      transcriptSegmentCount={1}
    />,
  );

  fireEvent.click(screen.getByRole("tab", { name: "Transcript" }));

  expect(
    screen.getByText("Transcript is streaming provisional lines"),
  ).toBeInTheDocument();
  expect(
    screen.getByText("A transcript shell preview is now available from the backend pipeline."),
  ).toBeInTheDocument();
  expect(screen.getByText("Segment count: 1")).toBeInTheDocument();
  expect(
    screen.getByText(
      "Preview: Transcript shell generated for 222.wav. Real speech recognition is not wired in yet.",
    ),
  ).toBeInTheDocument();
});

test("shows summary-generated shell preview details", () => {
  render(
    <AITabs
      jobStage="summary_generated"
      jobStatus="running"
      summaryKeyPointsCount={2}
      summaryPreviewText="Summary shell generated from transcript preview."
      summaryStatus="ready"
    />,
  );

  expect(
    screen.getByText("Summary is growing with each stable transcript window"),
  ).toBeInTheDocument();
  expect(
    screen.getByText("Key point shells ready: 2"),
  ).toBeInTheDocument();
  expect(
    screen.getByText("Preview: Summary shell generated from transcript preview."),
  ).toBeInTheDocument();
});
