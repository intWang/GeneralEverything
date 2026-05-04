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
  expect(screen.getByText("Ask AI placeholder")).toBeInTheDocument();
  expect(
    screen.getByText(
      "Ask AI shell only. Question input, grounding rules, and answer states will land in the next task.",
    ),
  ).toBeInTheDocument();
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
});
