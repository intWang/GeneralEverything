import { render, screen } from "@testing-library/react";

import HomePage from "../app/page";

test("renders both input modes", () => {
  render(<HomePage />);

  expect(screen.getByText("Public Video URL")).toBeInTheDocument();
  expect(screen.getByText("RingCentral Recording URL")).toBeInTheDocument();
});
