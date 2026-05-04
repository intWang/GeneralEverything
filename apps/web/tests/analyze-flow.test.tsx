import { render, screen } from "@testing-library/react";

import { AnalyzeForm } from "../components/analyze-form";

test("renders analyze button", () => {
  render(<AnalyzeForm inputMode="public_video" />);

  expect(screen.getByRole("button", { name: "Analyze" })).toBeInTheDocument();
});
