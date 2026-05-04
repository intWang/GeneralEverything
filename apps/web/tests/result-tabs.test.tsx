import { fireEvent, render, screen } from "@testing-library/react";

import { AITabs } from "../components/ai-tabs";

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
  render(<AITabs jobStage="building_summary" jobStatus="completed" />);

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
  expect(
    screen.getByText('Question staged for the future QA pipeline: "What should I review first?"'),
  ).toBeInTheDocument();
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
