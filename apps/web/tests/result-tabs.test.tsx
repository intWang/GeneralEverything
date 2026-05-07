import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

test("copies the available AI analysis bundle", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });

  render(
    <AITabs
      detectedLanguageName="Chinese"
      jobStage="mindmap_generated"
      jobStatus="running"
      mindmapPreviewText="Product launch, training"
      mindmapStatus="ready"
      summarySourceBullets={["产品发布时间已确认", "下周将进行团队培训"]}
      summarySourceText="录音确认了产品发布时间，并安排了团队培训。"
      summaryStatus="ready"
      transcriptSegmentCount={3}
      transcriptSourceText={"第一行字幕\n第二行字幕"}
      transcriptStatus="ready"
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Copy analysis bundle" }));

  await waitFor(() => {
    expect(writeText).toHaveBeenCalledWith(
      [
        "## Summary",
        "录音确认了产品发布时间，并安排了团队培训。",
        "",
        "### Key points",
        "- 产品发布时间已确认",
        "- 下周将进行团队培训",
        "",
        "## Transcript",
        "第一行字幕\n第二行字幕",
        "",
        "## Mind Map",
        "- Product launch",
        "- Training",
      ].join("\n"),
    );
  });
  expect(screen.getByRole("status")).toHaveTextContent("Analysis bundle copied");
});

test("offers the AI analysis bundle as a markdown download", () => {
  render(
    <AITabs
      activeJobId="job-123"
      detectedLanguageName="Chinese"
      jobStage="mindmap_generated"
      jobStatus="running"
      mindmapPreviewText="Product launch, training"
      mindmapStatus="ready"
      summarySourceBullets={["产品发布时间已确认", "下周将进行团队培训"]}
      summarySourceText="录音确认了产品发布时间，并安排了团队培训。"
      summaryStatus="ready"
      transcriptSegmentCount={3}
      transcriptSourceText={"第一行字幕\n第二行字幕"}
      transcriptStatus="ready"
    />,
  );

  const downloadLink = screen.getByRole("link", { name: "Download .md" });

  expect(downloadLink).toHaveAttribute("aria-describedby", "analysis-bundle-contents");
  expect(downloadLink).toHaveAttribute("download", "get-analysis-job-123.md");
  expect(downloadLink).toHaveAttribute("title", "Download get-analysis-job-123.md");
  expect(downloadLink.getAttribute("href")).toContain("data:text/markdown");
  expect(downloadLink.getAttribute("href")).toContain(
    encodeURIComponent("## Summary"),
  );
  expect(downloadLink.getAttribute("href")).toContain(
    encodeURIComponent("第一行字幕\n第二行字幕"),
  );
});

test("summarizes which sections are included in the AI analysis bundle", () => {
  render(
    <AITabs
      jobStage="mindmap_generated"
      jobStatus="running"
      mindmapPreviewText="Product launch, training"
      mindmapStatus="ready"
      summarySourceText="录音确认了产品发布时间，并安排了团队培训。"
      summaryStatus="ready"
      transcriptSegmentCount={3}
      transcriptSourceText={"第一行字幕\n第二行字幕"}
      transcriptStatus="ready"
    />,
  );

  const contents = screen.getByLabelText("AI analysis bundle contents");
  const copyButton = screen.getByRole("button", { name: "Copy analysis bundle" });

  expect(copyButton).toHaveAttribute("aria-describedby", "analysis-bundle-contents");
  expect(contents).toHaveAttribute("id", "analysis-bundle-contents");
  expect(contents).toHaveTextContent("Bundle includes");
  expect(within(contents).getByText("Summary")).toBeInTheDocument();
  expect(within(contents).getByText("Transcript")).toBeInTheDocument();
  expect(within(contents).getByText("Mind Map")).toBeInTheDocument();
  expect(within(contents).getByText(/\d+ chars/)).toBeInTheDocument();
});

test("toggles a markdown preview for the AI analysis bundle", () => {
  render(
    <AITabs
      jobStage="mindmap_generated"
      jobStatus="running"
      mindmapPreviewText="Product launch, training"
      mindmapStatus="ready"
      summarySourceText="录音确认了产品发布时间，并安排了团队培训。"
      summaryStatus="ready"
      transcriptSegmentCount={3}
      transcriptSourceText={"第一行字幕\n第二行字幕"}
      transcriptStatus="ready"
    />,
  );

  expect(
    screen.queryByLabelText("AI analysis markdown preview"),
  ).not.toBeInTheDocument();

  const previewButton = screen.getByRole("button", { name: "Preview bundle" });
  expect(previewButton).toHaveAttribute("aria-controls", "analysis-bundle-preview");
  expect(previewButton).toHaveAttribute("aria-describedby", "analysis-bundle-contents");
  expect(previewButton).toHaveAttribute("aria-expanded", "false");

  fireEvent.click(previewButton);

  const preview = screen.getByLabelText("AI analysis markdown preview");
  expect(preview).toHaveAttribute("id", "analysis-bundle-preview");
  expect(preview).toHaveTextContent("## Summary");
  expect(preview).toHaveTextContent("第一行字幕");
  expect(screen.getByRole("button", { name: "Hide preview" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );

  fireEvent.keyDown(document, { key: "Escape" });

  expect(
    screen.queryByLabelText("AI analysis markdown preview"),
  ).not.toBeInTheDocument();

  fireEvent.click(previewButton);

  expect(screen.getByLabelText("AI analysis markdown preview")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Hide preview" }));

  expect(
    screen.queryByLabelText("AI analysis markdown preview"),
  ).not.toBeInTheDocument();
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
  expect(screen.getAllByText("Action items").length).toBeGreaterThan(0);
});

test("renders structured summary sections with timestamp citation chips", () => {
  render(
    <AITabs
      detectedLanguageName="Chinese"
      jobStage="summary_generated"
      jobStatus="running"
      summaryStatus="ready"
      summaryStructured={{
        abstract: "录音确认了产品发布时间，并安排了培训准备。",
        key_points: [
          { text: "产品发布时间已确认在下周", citation_ids: ["citation-1"] },
          {
            text: "客户成功团队将在周四前完成培训材料准备",
            citation_ids: ["citation-2"],
          },
        ],
        action_items: [
          {
            text: "客户成功团队将在周四前完成培训材料准备",
            citation_ids: ["citation-2"],
          },
        ],
        decisions: [
          { text: "产品发布时间已确认在下周", citation_ids: ["citation-1"] },
        ],
        risks: [],
        citations: [
          {
            id: "citation-1",
            segment_id: "segment-1",
            start_seconds: 3,
            end_seconds: 8,
            label: "00:03",
          },
          {
            id: "citation-2",
            segment_id: "segment-2",
            start_seconds: 9,
            end_seconds: 15,
            label: "00:09",
          },
        ],
      }}
      transcriptSegmentCount={6}
    />,
  );

  expect(screen.getAllByText("Action items").length).toBeGreaterThan(0);
  expect(screen.getByText("Decisions")).toBeInTheDocument();
  expect(
    screen.getByText("客户成功团队将在周四前完成培训材料准备"),
  ).toBeInTheDocument();
  expect(screen.getByText("00:03")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "00:03" })).not.toBeInTheDocument();
});

test("uses legacy bullet count when structured summary is absent", () => {
  render(
    <AITabs
      detectedLanguageName="Chinese"
      jobStage="summary_generated"
      jobStatus="running"
      summarySourceBullets={["产品发布时间已确认在下周", "客户成功团队将在周四前完成培训材料准备"]}
      summarySourceText="录音确认了产品发布时间，并安排了培训准备。"
      summaryStatus="ready"
      transcriptSegmentCount={6}
    />,
  );

  expect(screen.getByLabelText("Structured summary")).toHaveTextContent("2");
  expect(screen.getByText("tracked points")).toBeInTheDocument();
});

test("prefers translated or legacy source text over structured summary abstract", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });

  render(
    <AITabs
      detectedLanguageName="Chinese"
      jobStage="summary_generated"
      jobStatus="running"
      summarySourceText="Translated summary should be visible."
      summaryStatus="ready"
      summaryStructured={{
        abstract: "Structured original abstract should stay hidden.",
        key_points: [{ text: "产品发布时间已确认", citation_ids: [] }],
        action_items: [],
        decisions: [{ text: "产品发布时间已确认", citation_ids: [] }],
        risks: [],
        citations: [],
      }}
      transcriptSegmentCount={6}
    />,
  );

  expect(screen.getByText("Translated summary should be visible.")).toBeInTheDocument();
  expect(
    screen.queryByText("Structured original abstract should stay hidden."),
  ).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Copy summary" }));

  await waitFor(() => {
    expect(writeText).toHaveBeenCalledWith(
      [
        "Brief",
        "Translated summary should be visible.",
        "",
        "Decisions",
        "- 产品发布时间已确认",
      ].join("\n"),
    );
  });
});

test("copies the structured summary to the clipboard", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });

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

  fireEvent.click(screen.getByRole("button", { name: "Copy summary" }));

  await waitFor(() => {
    expect(writeText).toHaveBeenCalledWith(
      [
        "Brief",
        "录音确认了产品发布时间，并安排了培训准备。",
        "",
        "Decisions",
        "- 产品发布时间已确认在下周",
        "",
        "Actions",
        "- 客户成功团队将在周四前完成培训材料准备",
      ].join("\n"),
    );
  });
  expect(screen.getByText("Summary copied")).toBeInTheDocument();
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

test("expands and collapses a structured mind map branch", () => {
  render(
    <AITabs
      jobStage="mindmap_generated"
      jobStatus="running"
      mindmapNodes={{
        id: "mindmap-root",
        label: "Launch readiness",
        summary: "Launch and enablement plan",
        children: [
          {
            id: "mindmap-launch",
            label: "Launch plan",
            children: [
              {
                id: "mindmap-launch-date",
                label: "Launch date is confirmed",
                children: [],
                references: [
                  {
                    segment_id: "segment-1",
                    start_seconds: 3,
                    end_seconds: 8,
                    label: "00:03",
                  },
                ],
              },
            ],
            references: [],
          },
        ],
        references: [],
      }}
      mindmapPreviewText="Legacy preview should stay available"
      mindmapStatus="ready"
    />,
  );

  fireEvent.click(screen.getByRole("tab", { name: "Mind Map" }));

  const tree = screen.getByLabelText("Structured mind map tree");
  expect(tree).toBeInTheDocument();
  expect(screen.queryByLabelText("Mind map preview")).not.toBeInTheDocument();
  expect(within(tree).getByText("Launch readiness")).toBeInTheDocument();
  expect(within(tree).getByText("Launch date is confirmed")).toBeInTheDocument();
  expect(within(tree).getByText("00:03")).toBeInTheDocument();
  expect(screen.queryByText("Legacy preview should stay available")).not.toBeInTheDocument();
  expect(screen.queryByText("Summary backbone")).not.toBeInTheDocument();
  expect(screen.queryByText("Key evidence clusters")).not.toBeInTheDocument();

  const branchToggle = screen.getByRole("button", { name: "Collapse Launch plan" });
  expect(branchToggle).toHaveAttribute("aria-expanded", "true");

  fireEvent.click(branchToggle);

  expect(branchToggle).toHaveAttribute("aria-expanded", "false");
  expect(within(tree).queryByText("Launch date is confirmed")).not.toBeInTheDocument();

  fireEvent.click(branchToggle);

  expect(branchToggle).toHaveAttribute("aria-expanded", "true");
  expect(within(tree).getByText("Launch date is confirmed")).toBeInTheDocument();
});

test("copies the mind map outline to the clipboard", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });

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
  fireEvent.click(screen.getByRole("button", { name: "Copy mind map" }));

  await waitFor(() => {
    expect(writeText).toHaveBeenCalledWith(
      [
        "Central idea",
        "AI analysis",
        "",
        "Branches",
        "- Product launch",
        "- Training",
        "- Customer follow-up",
      ].join("\n"),
    );
  });
  expect(screen.getByText("Mind map copied")).toBeInTheDocument();
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

test("renders structured transcript segments with timestamp chips", () => {
  render(
    <AITabs
      detectedLanguageName="English"
      jobStage="generating_transcript"
      jobStatus="running"
      transcriptSegmentCount={2}
      transcriptSourceSegments={[
        {
          id: "segment-1",
          start_seconds: 3,
          end_seconds: 6.5,
          text: "Welcome to the launch review.",
        },
        {
          id: "segment-2",
          start_seconds: 65,
          end_seconds: 70,
          text: "Training starts next Thursday.",
        },
      ]}
      transcriptSourceText="Legacy fallback should not render first"
    />,
  );

  fireEvent.click(screen.getByRole("tab", { name: "Transcript" }));

  expect(screen.getByText("00:03")).toBeInTheDocument();
  expect(screen.getByText("01:05")).toBeInTheDocument();
  expect(screen.getByText("Welcome to the launch review.")).toBeInTheDocument();
  expect(screen.getByText("Training starts next Thursday.")).toBeInTheDocument();
  expect(screen.queryByText("Legacy fallback should not render first")).not.toBeInTheDocument();
});

test("copies the visible structured transcript segment text", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });

  render(
    <AITabs
      detectedLanguageName="English"
      jobStage="generating_transcript"
      jobStatus="running"
      transcriptSegmentCount={2}
      transcriptSourceSegments={[
        {
          id: "segment-1",
          start_seconds: 3,
          end_seconds: 6.5,
          text: "Visible structured opening.",
        },
        {
          id: "segment-2",
          start_seconds: 65,
          end_seconds: 70,
          text: "Visible structured follow-up.",
        },
      ]}
      transcriptSourceText="Legacy fallback copy should not win."
    />,
  );

  fireEvent.click(screen.getByRole("tab", { name: "Transcript" }));
  fireEvent.click(screen.getByRole("button", { name: "Copy transcript" }));

  await waitFor(() => {
    expect(writeText).toHaveBeenCalledWith(
      "Visible structured opening.\nVisible structured follow-up.",
    );
  });
});

test("highlights newly appended structured transcript segments", () => {
  const scrollIntoView = vi.fn();

  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: scrollIntoView,
  });

  const { rerender } = render(
    <AITabs
      detectedLanguageName="English"
      jobStage="generating_transcript"
      jobStatus="running"
      transcriptSegmentCount={1}
      transcriptSourceSegments={[
        {
          id: "segment-1",
          start_seconds: 3,
          end_seconds: 6.5,
          text: "First structured segment.",
        },
      ]}
    />,
  );

  fireEvent.click(screen.getByRole("tab", { name: "Transcript" }));
  scrollIntoView.mockClear();

  rerender(
    <AITabs
      detectedLanguageName="English"
      jobStage="generating_transcript"
      jobStatus="running"
      transcriptSegmentCount={2}
      transcriptSourceSegments={[
        {
          id: "segment-1",
          start_seconds: 3,
          end_seconds: 6.5,
          text: "First structured segment.",
        },
        {
          id: "segment-2",
          start_seconds: 8,
          end_seconds: 11,
          text: "Second structured segment.",
        },
      ]}
    />,
  );

  expect(
    screen.getByText((_content, element) =>
      Boolean(
        element?.tagName === "P" &&
          element.textContent?.includes("Second structured segment."),
      ),
    ),
  ).toHaveAttribute("data-recent", "true");
  expect(scrollIntoView).toHaveBeenCalled();
});

test("copies the full transcript text to the clipboard", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });

  render(
    <AITabs
      detectedLanguageName="Chinese"
      jobStage="generating_transcript"
      jobStatus="running"
      transcriptSegmentCount={3}
      transcriptSourceText={"第一行字幕\n第二行字幕\n第三行字幕"}
    />,
  );

  fireEvent.click(screen.getByRole("tab", { name: "Transcript" }));
  fireEvent.change(screen.getByLabelText("Search transcript"), {
    target: { value: "第二" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Copy transcript" }));

  await waitFor(() => {
    expect(writeText).toHaveBeenCalledWith("第一行字幕\n第二行字幕\n第三行字幕");
  });
  expect(screen.getByText("Transcript copied")).toBeInTheDocument();
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

test("clears the Ask AI transcript jump target when the same job loses Ask AI readiness", async () => {
  vi.mocked(api.submitJobQuestion).mockResolvedValue({
    answer:
      'Grounded answer shell for "What should I review next?" based on the transcript, summary, and mind map shells currently available.',
    grounded: true,
    job_id: "job-123",
    question: "What should I review next?",
    references: buildAskAiMockReferences("222.wav"),
    structured_references: [
      {
        source_type: "transcript",
        segment_id: "segment-1",
        start_seconds: 3,
        end_seconds: 8,
        snippet: "Opening segment explains the release decision.",
      },
    ],
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

  fireEvent.click(await screen.findByRole("button", { name: "Jump to transcript 00:03" }));

  expect(screen.getByRole("tab", { name: "Transcript" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(screen.getByRole("tabpanel")).toHaveTextContent(
    "Transcript jump target: 00:03",
  );

  rerender(
    <AITabs
      activeJobId="job-123"
      jobStage="building_summary"
      jobStatus="running"
      summaryStatus="processing"
      transcriptSegmentCount={3}
    />,
  );

  await waitFor(() => {
    expect(screen.getByRole("tabpanel")).not.toHaveTextContent(
      "Transcript jump target: 00:03",
    );
  });
});

test("copies a grounded Ask AI answer with references", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  const answer =
    'Grounded answer shell for "What should I review next?" based on the transcript, summary, and mind map shells currently available.';
  const references = buildAskAiMockReferences("222.wav");
  vi.mocked(api.submitJobQuestion).mockResolvedValue({
    answer,
    grounded: true,
    job_id: "job-123",
    question: "What should I review next?",
    references,
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

  await screen.findByText(answer);
  fireEvent.click(screen.getByRole("button", { name: "Copy answer" }));

  await waitFor(() => {
    expect(writeText).toHaveBeenCalledWith(
      ["Answer", answer, "", "References", ...references.map((item) => `- ${item}`)].join(
        "\n",
      ),
    );
  });
  expect(screen.getByText("Answer copied")).toBeInTheDocument();
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
