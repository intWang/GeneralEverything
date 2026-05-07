import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { vi } from "vitest";

import { buildAskAiMockReferences } from "./ask-ai-test-helpers";
import { AITabs } from "../components/ai-tabs";
import * as api from "../lib/api";

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../lib/api")>("../lib/api");

  return {
    ...actual,
    submitJobQuestion: vi.fn(),
    translateJobContent: vi.fn(),
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

test("summarizes AI output readiness across all result areas", () => {
  render(
    <AITabs
      activeJobId="job-123"
      jobStage="mindmap_generated"
      jobStatus="running"
      mindmapStatus="ready"
      summaryStatus="ready"
      transcriptSegmentCount={3}
      transcriptStatus="ready"
    />,
  );

  expect(screen.getByLabelText("AI output readiness")).toBeInTheDocument();
  expect(screen.getByLabelText("Summary is ready")).toHaveTextContent("Ready");
  expect(screen.getByLabelText("Transcript is ready")).toHaveTextContent("Ready");
  expect(screen.getByLabelText("Mind Map is live")).toHaveTextContent("Live");
  expect(screen.getByLabelText("Ask AI is ready")).toHaveTextContent("Ready");
});

test("shows a live summary warmup state before the first transcript segments arrive", () => {
  render(
    <AITabs
      jobStage="generating_transcript"
      jobStatus="running"
      transcriptPreviewText="Preparing the speech model. First transcript lines may take a moment."
      transcriptSegmentCount={0}
      transcriptStatus="processing"
    />,
  );

  expect(screen.getByText("Processing")).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: /Summary/i })).toHaveTextContent("Live");
  expect(
    screen.getByText("Summary is waiting for the first transcript segments"),
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      "The first stable transcript lines will unlock the live summary draft.",
    ),
  ).toBeInTheDocument();
  expect(screen.getByText("Live progress")).toBeInTheDocument();
  expect(
    screen.getByText("Waiting for the first transcript segments"),
  ).toBeInTheDocument();
});

test("builds a provisional summary once enough transcript segments have arrived", () => {
  render(
    <AITabs
      detectedLanguageName="Chinese"
      jobStage="generating_transcript"
      jobStatus="running"
      transcriptSegmentCount={4}
      transcriptSourceText={
        "我们确认了产品发布时间。\n下周将进行团队培训。\n销售团队会同步客户名单。"
      }
    />,
  );

  expect(screen.getByText("Live summary draft")).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: /Summary/i })).toHaveTextContent("Live");
  expect(
    screen.getByText("Summary is tightening as transcript lines arrive"),
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      "This early draft refreshes as transcript coverage grows, then hands off to the finalized summary.",
    ),
  ).toBeInTheDocument();
  expect(
    screen.getByText("Based on 4 transcript segments captured so far."),
  ).toBeInTheDocument();
  expect(screen.getByText("Updated just now")).toBeInTheDocument();
  expect(
    screen.getByText("目前已经稳定识别到这些早期要点：我们确认了产品发布时间；下周将进行团队培训。"),
  ).toBeInTheDocument();
  expect(screen.getByText("我们确认了产品发布时间")).toBeInTheDocument();
  expect(screen.getByText("下周将进行团队培训")).toBeInTheDocument();
});

test("organizes summary output into brief, takeaways, and action groups", () => {
  render(
    <AITabs
      detectedLanguageName="Chinese"
      jobStage="summary_generated"
      jobStatus="running"
      summarySourceBullets={[
        "产品发布时间已确认在下周",
        "客户成功团队将在周四前完成培训材料准备",
      ]}
      summarySourceText="录音确认了产品发布时间，并安排了培训准备。"
      summaryStatus="ready"
      transcriptSegmentCount={6}
    />,
  );

  expect(screen.getAllByText("Brief").length).toBeGreaterThan(0);
  expect(screen.getByText("Key takeaways")).toBeInTheDocument();
  expect(screen.getByText("Action items")).toBeInTheDocument();
});

test("renders mind map branches as a visual node map", () => {
  render(
    <AITabs
      jobStage="mindmap_generated"
      jobStatus="running"
      mindmapNodeCount={4}
      mindmapPreviewText="Product launch, training, customer follow-up"
      mindmapStatus="ready"
    />,
  );

  fireEvent.click(screen.getByRole("tab", { name: "Mind Map" }));

  expect(screen.getByLabelText("Mind map preview")).toBeInTheDocument();
  expect(screen.getByText("Central idea")).toBeInTheDocument();
  expect(screen.getByText("Product launch")).toBeInTheDocument();
  expect(screen.getByText("Customer follow-up")).toBeInTheDocument();
});

test("replaces the provisional summary with the finalized backend summary when it arrives", () => {
  const { rerender } = render(
    <AITabs
      detectedLanguageName="Chinese"
      jobStage="generating_transcript"
      jobStatus="running"
      transcriptSegmentCount={4}
      transcriptSourceText={
        "我们确认了产品发布时间。\n下周将进行团队培训。\n销售团队会同步客户名单。"
      }
    />,
  );

  expect(screen.getByText("Live summary draft")).toBeInTheDocument();

  rerender(
    <AITabs
      detectedLanguageName="Chinese"
      jobStage="summary_generated"
      jobStatus="running"
      summaryKeyPointsCount={2}
      summarySourceBullets={["产品发布时间已确认", "下周将进行团队培训"]}
      summarySourceText="录音确认了产品发布时间，并安排了团队培训。"
      summaryStatus="ready"
      transcriptSegmentCount={6}
      transcriptSourceText={
        "我们确认了产品发布时间。\n下周将进行团队培训。\n销售团队会同步客户名单。"
      }
    />,
  );

  expect(screen.getByText("Source summary")).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: /Summary/i })).not.toHaveTextContent("Live");
  expect(
    screen.getByText("Summary in the detected audio language"),
  ).toBeInTheDocument();
  expect(
    screen.getByText("录音确认了产品发布时间，并安排了团队培训。"),
  ).toBeInTheDocument();
  expect(screen.queryByText("Live summary draft")).not.toBeInTheDocument();
});

test("refreshes the provisional summary metadata as transcript coverage grows", () => {
  const { rerender } = render(
    <AITabs
      detectedLanguageName="Chinese"
      jobStage="generating_transcript"
      jobStatus="running"
      transcriptSegmentCount={4}
      transcriptSourceText={
        "我们确认了产品发布时间。\n下周将进行团队培训。\n销售团队会同步客户名单。"
      }
    />,
  );

  expect(
    screen.getByText("Based on 4 transcript segments captured so far."),
  ).toBeInTheDocument();

  rerender(
    <AITabs
      detectedLanguageName="Chinese"
      jobStage="generating_transcript"
      jobStatus="running"
      transcriptSegmentCount={7}
      transcriptSourceText={
        "我们确认了产品发布时间。\n下周将进行团队培训。\n销售团队会同步客户名单。\n客服团队会继续跟进。"
      }
    />,
  );

  expect(
    screen.getByText("Based on 7 transcript segments captured so far."),
  ).toBeInTheDocument();
  expect(screen.getByText("Updated just now")).toBeInTheDocument();
});

test("pulses the Summary live badge when early summary updates arrive off-tab", () => {
  const { rerender } = render(
    <AITabs
      detectedLanguageName="Chinese"
      jobStage="generating_transcript"
      jobStatus="running"
      transcriptSegmentCount={4}
      transcriptSourceText={
        "我们确认了产品发布时间。\n下周将进行团队培训。\n销售团队会同步客户名单。"
      }
    />,
  );

  fireEvent.click(screen.getByRole("tab", { name: "Transcript" }));

  rerender(
    <AITabs
      detectedLanguageName="Chinese"
      jobStage="generating_transcript"
      jobStatus="running"
      transcriptSegmentCount={7}
      transcriptSourceText={
        "我们确认了产品发布时间。\n下周将进行团队培训。\n销售团队会同步客户名单。\n客服团队会继续跟进。"
      }
    />,
  );

  expect(screen.getByLabelText("Summary live badge")).toHaveAttribute(
    "data-pulse",
    "true",
  );
});

test("keeps the Summary live badge steady while the Summary tab is open", () => {
  const { rerender } = render(
    <AITabs
      detectedLanguageName="Chinese"
      jobStage="generating_transcript"
      jobStatus="running"
      transcriptSegmentCount={4}
      transcriptSourceText={
        "我们确认了产品发布时间。\n下周将进行团队培训。\n销售团队会同步客户名单。"
      }
    />,
  );

  expect(screen.getByRole("tab", { name: /Summary/i })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  rerender(
    <AITabs
      detectedLanguageName="Chinese"
      jobStage="generating_transcript"
      jobStatus="running"
      transcriptSegmentCount={7}
      transcriptSourceText={
        "我们确认了产品发布时间。\n下周将进行团队培训。\n销售团队会同步客户名单。\n客服团队会继续跟进。"
      }
    />,
  );

  expect(screen.getByLabelText("Summary live badge")).toHaveAttribute(
    "data-pulse",
    "false",
  );
});

test("briefly highlights the newest provisional summary bullets", () => {
  const { rerender } = render(
    <AITabs
      detectedLanguageName="Chinese"
      jobStage="generating_transcript"
      jobStatus="running"
      transcriptSegmentCount={4}
      transcriptSourceText={
        "我们确认了产品发布时间。\n下周将进行团队培训。\n销售团队会同步客户名单。"
      }
    />,
  );

  rerender(
    <AITabs
      detectedLanguageName="Chinese"
      jobStage="generating_transcript"
      jobStatus="running"
      transcriptSegmentCount={7}
      transcriptSourceText={
        "我们确认了产品发布时间。\n下周将进行团队培训。\n销售团队会同步客户名单。\n客服团队会继续跟进。"
      }
    />,
  );

  expect(screen.getByText("下周将进行团队培训")).toHaveAttribute(
    "data-recent",
    "true",
  );
  expect(screen.getByText("销售团队会同步客户名单")).toHaveAttribute(
    "data-recent",
    "true",
  );
});

test("switches between progressive AI result states", () => {
  render(<AITabs jobStage="generating_transcript" jobStatus="running" />);

  expect(
    screen.getByText("Summary is waiting for transcript context"),
  ).toBeInTheDocument();
  expect(screen.getByText("Queued")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("tab", { name: "Transcript" }));
  expect(
    screen.getByText("Transcript is streaming live lines"),
  ).toBeInTheDocument();
  expect(screen.getByText("Streaming")).toBeInTheDocument();

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

test("shows a clearer warm-up message before the first transcript segment arrives", () => {
  render(
    <AITabs
      jobStage="transcript_ready"
      jobStatus="running"
      transcriptAudioArtifactPath="var/transcripts/public-video/demo.wav"
      transcriptExtractor="ffmpeg"
    />,
  );

  fireEvent.click(screen.getByRole("tab", { name: "Transcript" }));

  expect(
    screen.getByText("Transcript is decoding the first lines"),
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      "Audio has been extracted and the model is working through the first chunk. On longer videos, the first stable lines can take 30 to 90 seconds to appear.",
    ),
  ).toBeInTheDocument();
  expect(
    screen.getByText("Waiting for the first transcript segment"),
  ).toBeInTheDocument();
});

test("shows a live segment counter while transcript lines are streaming", () => {
  render(
    <AITabs
      detectedLanguageName="Chinese"
      jobStage="generating_transcript"
      jobStatus="running"
      transcriptSegmentCount={6}
      transcriptSourceText="第一行字幕\n第二行字幕"
    />,
  );

  fireEvent.click(screen.getByRole("tab", { name: "Transcript" }));

  expect(screen.getByText("Streaming transcript")).toBeInTheDocument();
  expect(
    screen.getByText("6 transcript segments captured so far"),
  ).toBeInTheDocument();
  expect(screen.getByText("Live progress")).toBeInTheDocument();
});

test("filters transcript lines by search query", () => {
  render(
    <AITabs
      detectedLanguageName="English"
      jobStage="generating_transcript"
      jobStatus="running"
      transcriptSegmentCount={3}
      transcriptSourceText={
        "Welcome to the launch review\nTraining starts next Thursday\nCustomer follow-up owners are confirmed"
      }
    />,
  );

  fireEvent.click(screen.getByRole("tab", { name: "Transcript" }));
  fireEvent.change(screen.getByLabelText("Search transcript"), {
    target: { value: "customer" },
  });

  expect(screen.getByText("1 matching line")).toBeInTheDocument();
  expect(screen.getByText("Customer follow-up owners are confirmed")).toHaveAttribute(
    "data-search-match",
    "true",
  );
  expect(screen.queryByText("Welcome to the launch review")).not.toBeInTheDocument();
  expect(screen.queryByText("Training starts next Thursday")).not.toBeInTheDocument();
});

test("auto-scrolls transcript view when new streaming lines arrive", () => {
  const scrollIntoView = vi.fn();

  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: scrollIntoView,
  });

  const { rerender } = render(
    <AITabs
      detectedLanguageName="Chinese"
      jobStage="generating_transcript"
      jobStatus="running"
      transcriptSegmentCount={1}
      transcriptSourceText="第一行字幕"
    />,
  );

  fireEvent.click(screen.getByRole("tab", { name: "Transcript" }));

  rerender(
    <AITabs
      detectedLanguageName="Chinese"
      jobStage="generating_transcript"
      jobStatus="running"
      transcriptSegmentCount={2}
      transcriptSourceText={"第一行字幕\n第二行字幕"}
    />,
  );

  expect(scrollIntoView).toHaveBeenCalled();
});

test("pauses auto-scroll when the reader scrolls upward and lets them jump to latest", () => {
  const scrollIntoView = vi.fn();

  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: scrollIntoView,
  });

  const { rerender } = render(
    <AITabs
      detectedLanguageName="Chinese"
      jobStage="generating_transcript"
      jobStatus="running"
      transcriptSegmentCount={2}
      transcriptSourceText={"第一行字幕\n第二行字幕"}
    />,
  );

  fireEvent.click(screen.getByRole("tab", { name: "Transcript" }));

  const transcriptViewport = screen.getByText("第一行字幕").parentElement as HTMLElement;
  Object.defineProperty(transcriptViewport, "scrollHeight", {
    configurable: true,
    value: 400,
  });
  Object.defineProperty(transcriptViewport, "clientHeight", {
    configurable: true,
    value: 120,
  });
  Object.defineProperty(transcriptViewport, "scrollTop", {
    configurable: true,
    value: 120,
    writable: true,
  });

  fireEvent.scroll(transcriptViewport);

  rerender(
    <AITabs
      detectedLanguageName="Chinese"
      jobStage="generating_transcript"
      jobStatus="running"
      transcriptSegmentCount={3}
      transcriptSourceText={"第一行字幕\n第二行字幕\n第三行字幕"}
    />,
  );

  expect(
    screen.getByText("Auto-scroll paused while you read earlier transcript lines."),
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Jump to latest" })).toBeInTheDocument();

  scrollIntoView.mockClear();
  fireEvent.click(screen.getByRole("button", { name: "Jump to latest" }));
  expect(scrollIntoView).toHaveBeenCalled();
});

test("briefly highlights the newest streaming transcript lines", () => {
  const { rerender } = render(
    <AITabs
      detectedLanguageName="Chinese"
      jobStage="generating_transcript"
      jobStatus="running"
      transcriptSegmentCount={1}
      transcriptSourceText="第一行字幕"
    />,
  );

  fireEvent.click(screen.getByRole("tab", { name: "Transcript" }));

  rerender(
    <AITabs
      detectedLanguageName="Chinese"
      jobStage="generating_transcript"
      jobStatus="running"
      transcriptSegmentCount={3}
      transcriptSourceText={"第一行字幕\n第二行字幕\n第三行字幕"}
    />,
  );

  expect(screen.getByText("第二行字幕")).toHaveAttribute("data-recent", "true");
  expect(screen.getByText("第三行字幕")).toHaveAttribute("data-recent", "true");
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

test("fills the Ask AI composer from a suggested question", () => {
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
  fireEvent.click(screen.getByRole("button", { name: "What are the key decisions?" }));

  expect(screen.getByLabelText("Ask a question")).toHaveValue(
    "What are the key decisions?",
  );
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
    screen.getByText("Transcript is decoding the first lines"),
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
    screen.getByText("Transcript is streaming live lines"),
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

test("shows source-language transcript and summary content by default", () => {
  render(
    <AITabs
      {...({
        activeJobId: "job-zh",
        detectedLanguageName: "Chinese",
        jobStatus: "completed",
        summarySourceBullets: [
          "产品发布时间已确认在下周",
          "客户成功团队将在周四前完成培训材料准备",
        ],
        summarySourceText: "录音确认了产品发布时间，并安排了培训准备。",
        transcriptSourceText: "大家好，欢迎来到今天的会议。",
      } as unknown as ComponentProps<typeof AITabs>)}
    />,
  );

  expect(
    screen.getByText("录音确认了产品发布时间，并安排了培训准备。"),
  ).toBeInTheDocument();
  expect(screen.getByText("Decisions")).toBeInTheDocument();
  expect(screen.getByText("Actions")).toBeInTheDocument();
  expect(screen.getByText("产品发布时间已确认在下周")).toBeInTheDocument();
  expect(
    screen.getByText("客户成功团队将在周四前完成培训材料准备"),
  ).toBeInTheDocument();

  fireEvent.click(screen.getByRole("tab", { name: "Transcript" }));

  expect(screen.getByText("Detected language: Chinese")).toBeInTheDocument();
  expect(screen.getByText("大家好，欢迎来到今天的会议。")).toBeInTheDocument();
});

test("translates summary and transcript on demand", async () => {
  vi.mocked(api.translateJobContent).mockImplementation(async (jobId, contentType, languageCode) => {
    expect(jobId).toBe("job-zh");

    if (contentType === "summary") {
      expect(languageCode).toBe("en");
      return {
        content_type: "summary",
        job_id: jobId,
        source_language_code: "zh",
        target_language_code: "en",
        translated_text: "The meeting confirmed the release date.",
      };
    }

    expect(languageCode).toBe("en");
    return {
      content_type: "transcript",
      job_id: jobId,
      source_language_code: "zh",
      target_language_code: "en",
      translated_text: "Hello everyone, welcome to today's meeting.",
    };
  });

  render(
    <AITabs
      activeJobId="job-zh"
      detectedLanguageName="Chinese"
      jobStatus="completed"
      summarySourceText="会议确定了发布时间。"
      transcriptSourceText="大家好，欢迎来到今天的会议。"
    />,
  );

  fireEvent.change(screen.getByLabelText("Summary language"), {
    target: { value: "en" },
  });

  expect(screen.getByText("Current language: English")).toBeInTheDocument();

  await waitFor(() => {
    expect(screen.getByText("The meeting confirmed the release date.")).toBeInTheDocument();
  });

  fireEvent.click(screen.getByRole("tab", { name: "Transcript" }));
  fireEvent.change(screen.getByLabelText("Transcript language"), {
    target: { value: "en" },
  });

  await waitFor(() => {
    expect(
      screen.getByText("Hello everyone, welcome to today's meeting."),
    ).toBeInTheDocument();
  });
  expect(screen.getByText("Current language: English")).toBeInTheDocument();
});

test("uses cached translations after hydration without re-requesting them", async () => {
  render(
    <AITabs
      activeJobId="job-zh"
      detectedLanguageName="Chinese"
      jobStatus="completed"
      summarySourceText="会议确定了发布时间。"
      summaryTranslations={{ en: "The meeting confirmed the release date." }}
      transcriptSourceText="大家好，欢迎来到今天的会议。"
      transcriptTranslations={{ en: "Hello everyone, welcome to today's meeting." }}
    />,
  );

  fireEvent.change(screen.getByLabelText("Summary language"), {
    target: { value: "en" },
  });

  expect(screen.getByText("The meeting confirmed the release date.")).toBeInTheDocument();
  expect(api.translateJobContent).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("tab", { name: "Transcript" }));
  fireEvent.change(screen.getByLabelText("Transcript language"), {
    target: { value: "en" },
  });

  expect(
    screen.getByText("Hello everyone, welcome to today's meeting."),
  ).toBeInTheDocument();
  expect(api.translateJobContent).not.toHaveBeenCalled();
});
