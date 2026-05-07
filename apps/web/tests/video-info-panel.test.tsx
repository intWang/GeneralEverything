import { render, screen } from "@testing-library/react";

import { VideoInfoPanel } from "../components/video-info-panel";

test("renders hydrated public video metadata", () => {
  render(
    <VideoInfoPanel
      description="A practical walkthrough of the weekly sync."
      durationSeconds={754}
      inputMode="public_video"
      jobId="11111111-1111-1111-1111-111111111111"
      sourceName="OpenAI Channel"
      sourceUrl="https://www.youtube.com/watch?v=abc123"
      thumbnailUrl="https://example.com/thumb.jpg"
      title="Weekly sync recap"
    />,
  );

  expect(screen.getAllByText("Weekly sync recap").length).toBeGreaterThan(0);
  expect(screen.getByText("OpenAI Channel")).toBeInTheDocument();
  expect(screen.getByText("Youtube")).toBeInTheDocument();
  expect(screen.getByText("12:34")).toBeInTheDocument();
  expect(
    screen.getByText("A practical walkthrough of the weekly sync."),
  ).toBeInTheDocument();
  expect(screen.getByRole("img", { name: "Weekly sync recap" })).toHaveAttribute(
    "src",
    "https://example.com/thumb.jpg",
  );
});

test("renders a preview player card with source actions", () => {
  render(
    <VideoInfoPanel
      durationSeconds={754}
      inputMode="public_video"
      sourceName="OpenAI Channel"
      sourceUrl="https://www.youtube.com/watch?v=abc123"
      thumbnailUrl="https://example.com/thumb.jpg"
      title="Weekly sync recap"
    />,
  );

  expect(screen.getByText("Preview player")).toBeInTheDocument();
  expect(screen.getByText("12:34 runtime")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Open source video" })).toHaveAttribute(
    "href",
    "https://www.youtube.com/watch?v=abc123",
  );
  expect(screen.getByText("Timestamp sync ready")).toBeInTheDocument();
});

test("falls back to pending copy when metadata is still unavailable", () => {
  render(
    <VideoInfoPanel
      inputMode="public_video"
      jobId="11111111-1111-1111-1111-111111111111"
      sourceUrl="https://example.com/video"
    />,
  );

  expect(screen.getAllByText("Pending analysis").length).toBeGreaterThan(0);
  expect(screen.getByText("Example")).toBeInTheDocument();
  expect(screen.getByText("https://example.com/video")).toBeInTheDocument();
});
