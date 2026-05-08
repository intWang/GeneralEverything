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

test("renders download progress", () => {
  render(
    <VideoInfoPanel
      downloadProgress={{
        percent: 50,
        status: "downloading",
      }}
      inputMode="public_video"
      sourceUrl="https://example.com/video"
    />,
  );

  expect(screen.getByText("Download progress")).toBeInTheDocument();
  expect(screen.getByText("50%")).toBeInTheDocument();
});

test("renders available asset formats", () => {
  render(
    <VideoInfoPanel
      downloadFormats={[
        {
          format_id: "rc-stream",
          format_label: "RingCentral recording stream",
          kind: "video",
        },
      ]}
      inputMode="ringcentral_recording"
      sourceUrl="https://example.com/recording"
    />,
  );

  expect(screen.getByText("Available asset formats")).toBeInTheDocument();
  expect(screen.getByText("RingCentral recording stream")).toBeInTheDocument();
});

test("renders asset formats with artifact download actions", () => {
  render(
    <VideoInfoPanel
      downloadFormats={[
        {
          artifact_path: "artifacts/downloads/demo/source.mp4",
          container: "mp4",
          format_id: "best",
          format_label: "Best available",
          kind: "video",
          resolution: "1080p",
        },
        {
          artifact_path: "artifacts/downloads/demo/audio.m4a",
          container: "m4a",
          format_id: "audio",
          format_label: "Audio only",
          kind: "audio",
          resolution: "audio",
        },
      ]}
      inputMode="public_video"
      sourceUrl="https://example.com/video"
    />,
  );

  expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  expect(screen.getByText("Best available")).toBeInTheDocument();
  expect(screen.getByText("1080p · mp4 · video")).toBeInTheDocument();
  expect(screen.getByText("Audio only")).toBeInTheDocument();
  expect(screen.getByText("audio · m4a · audio")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Download Best available" })).toHaveAttribute(
    "href",
    "artifacts/downloads/demo/source.mp4",
  );
  expect(screen.getByRole("link", { name: "Download Audio only" })).toHaveAttribute(
    "href",
    "artifacts/downloads/demo/audio.m4a",
  );
});

test("renders pending status without download links for formats without artifacts", () => {
  render(
    <VideoInfoPanel
      downloadFormats={[
        {
          artifact_path: null,
          format_id: "best",
          format_label: "Best available",
          kind: "video",
          resolution: "source",
        },
        {
          artifact_path: null,
          format_id: "bestaudio/best",
          format_label: "Audio only",
          kind: "audio",
          resolution: "audio",
        },
      ]}
      downloadProgress={{
        percent: 42,
        status: "downloading",
      }}
      inputMode="public_video"
      sourceUrl="https://example.com/video"
    />,
  );

  expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  expect(screen.getByText("Best available")).toBeInTheDocument();
  expect(screen.getByText("Audio only")).toBeInTheDocument();
  expect(screen.getAllByText("Preparing asset")).toHaveLength(2);
  expect(screen.queryByRole("link", { name: "Download Best available" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Download Audio only" })).not.toBeInTheDocument();
});

test("renders unavailable status when assets have not been generated", () => {
  render(
    <VideoInfoPanel
      downloadFormats={[
        {
          artifact_path: null,
          format_id: "best",
          format_label: "Best available",
          kind: "video",
          resolution: "source",
        },
      ]}
      inputMode="public_video"
      sourceUrl="https://example.com/video"
    />,
  );

  expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Download Best available" })).not.toBeInTheDocument();
  expect(screen.getByText("Not generated yet")).toBeInTheDocument();
});

test("renders diagnostics with suggestions", () => {
  render(
    <VideoInfoPanel
      diagnostics={[
        {
          message: "Could not read the recording stream.",
          reason: "recording_unavailable",
          stage: "probe",
          suggestion: "Check that the sharing link is still active.",
        },
      ]}
      inputMode="ringcentral_recording"
      sourceUrl="https://example.com/recording"
    />,
  );

  expect(screen.getByText("Could not read the recording stream.")).toBeInTheDocument();
  expect(
    screen.getByText("Check that the sharing link is still active."),
  ).toBeInTheDocument();
});

test.each([
  {
    label: "Session expired",
    message: "RingCentral could not access this recording because the session expired.",
    reason: "ringcentral_session_expired",
    suggestion: "Sign in to RingCentral again, then retry the recording link.",
  },
  {
    label: "Permission denied",
    message: "RingCentral denied access to this recording.",
    reason: "ringcentral_permission_denied",
    suggestion: "Ask the meeting owner to grant access or share a public recording link.",
  },
  {
    label: "Recording unavailable",
    message: "RingCentral says this recording is no longer available.",
    reason: "ringcentral_recording_unavailable",
    suggestion: "Confirm the recording has not expired or been deleted.",
  },
  {
    label: "Unsupported page",
    message: "This RingCentral page is not a supported recording view.",
    reason: "ringcentral_unsupported_page",
    suggestion: "Open the direct recording playback page and submit that URL.",
  },
  {
    label: "Authentication required",
    message: "RingCentral requires authentication before the recording can be read.",
    reason: "ringcentral_auth_required",
    suggestion: "Configure RingCentral authentication on the server before retrying.",
  },
])(
  "renders RingCentral diagnostic details for $reason",
  ({ label, message, reason, suggestion }) => {
    render(
      <VideoInfoPanel
        diagnostics={[
          {
            message,
            reason,
            stage: "probe",
            suggestion,
          },
        ]}
        inputMode="ringcentral_recording"
        sourceUrl="https://example.com/recording"
      />,
    );

    expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.getByText(suggestion)).toBeInTheDocument();
    expect(screen.getByText(label)).toBeInTheDocument();
  },
);
