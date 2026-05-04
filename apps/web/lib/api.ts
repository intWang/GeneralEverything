import type { JobRecord } from "./types";

export type CreateJobResponse = JobRecord;
export type SubmitJobQuestionResponse = {
  answer: string;
  grounded: boolean;
  job_id: string;
  question: string;
  references: string[];
};

const DEFAULT_API_BASE_URL = "http://localhost:8000/api";

export function getApiBaseUrl() {
  const configuredBaseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL;

  return configuredBaseUrl.endsWith("/")
    ? configuredBaseUrl.slice(0, -1)
    : configuredBaseUrl;
}

export function buildApiUrl(path: string) {
  return `${getApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

async function readJson<T>(input: string, init?: RequestInit) {
  const response = await fetch(input, init);

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function createJob(sourceUrl: string) {
  const payload = {
    source_url: sourceUrl,
  };

  return readJson<CreateJobResponse>(buildApiUrl("/jobs"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function getJob(jobId: string) {
  return readJson<JobRecord>(buildApiUrl(`/jobs/${jobId}`));
}

export function listJobs(limit = 8) {
  return readJson<JobRecord[]>(buildApiUrl(`/jobs?limit=${limit}`));
}

export function submitJobQuestion(jobId: string, question: string) {
  return readJson<SubmitJobQuestionResponse>(buildApiUrl(`/jobs/${jobId}/questions`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
}
