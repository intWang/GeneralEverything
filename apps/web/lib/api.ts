import type { InputMode } from "./types";

export type CreateJobResponse = {
  id: string;
  [key: string]: unknown;
};

export async function createJob(inputMode: InputMode, sourceUrl: string) {
  const payload: { input_mode?: InputMode; source_url: string } = {
    source_url: sourceUrl,
  };

  if (inputMode) {
    payload.input_mode = inputMode;
  }

  const response = await fetch("/api/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Failed to create job");
  }

  return (await response.json()) as CreateJobResponse;
}
