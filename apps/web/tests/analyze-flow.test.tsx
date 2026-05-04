import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import { AnalyzeForm } from "../components/analyze-form";
import * as api from "../lib/api";

vi.mock("../lib/api", () => ({
  createJob: vi.fn(),
}));

test("submits the source url and reports job creation", async () => {
  const createJob = vi.mocked(api.createJob);
  const onJobCreated = vi.fn();

  createJob.mockResolvedValue({ id: "job-123" });

  render(
    <AnalyzeForm inputMode="public_video" onJobCreated={onJobCreated} />,
  );

  fireEvent.change(screen.getByLabelText("Video source"), {
    target: { value: "https://example.com/video" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Analyze" }));

  await waitFor(() => {
    expect(createJob).toHaveBeenCalledWith("https://example.com/video");
  });

  expect(onJobCreated).toHaveBeenCalledWith({ id: "job-123" });
  expect(
    screen.getByText("Analysis requested. Live status will appear below."),
  ).toBeInTheDocument();
});
