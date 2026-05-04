import { fireEvent, render, screen } from "@testing-library/react";

import HomePage from "../app/page";

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
