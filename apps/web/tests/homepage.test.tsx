import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import HomePage from "../app/page";
import * as api from "../lib/api";

vi.mock("../lib/api", () => ({
  createJob: vi.fn(),
}));

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

  createJob.mockResolvedValue({ id: "job-123" });

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

  expect(screen.getByText("Summary")).toBeInTheDocument();
  expect(screen.getByText("Transcript")).toBeInTheDocument();
  expect(screen.getByText("Mind Map")).toBeInTheDocument();
  expect(screen.getByText("Ask AI")).toBeInTheDocument();
  expect(
    screen.getByText("Job job-123 is queued for analysis."),
  ).toBeInTheDocument();
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
