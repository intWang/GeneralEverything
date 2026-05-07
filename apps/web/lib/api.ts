import type { JobRecord } from "./types";

export type CreateJobResponse = JobRecord;
export type AskAiStructuredReference = {
  source_type: string;
  segment_id?: string | null;
  start_seconds?: number | null;
  end_seconds?: number | null;
  snippet: string;
};
export type SubmitJobQuestionResponse = {
  answer: string;
  grounded: boolean;
  job_id: string;
  question: string;
  references: string[];
  structured_references?: AskAiStructuredReference[];
};
export type TranslateJobContentResponse = {
  content_type: "summary" | "transcript";
  job_id: string;
  source_language_code: string;
  target_language_code: string;
  translated_text: string;
};

export class ApiError extends Error {
  detail?: string;
  status: number;

  constructor(message: string, status: number, detail?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

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
    let detail: string | undefined;
    try {
      const errorBody = (await response.json()) as { detail?: string };
      detail = errorBody.detail;
    } catch {
      detail = undefined;
    }

    throw new ApiError(`Request failed: ${response.status}`, response.status, detail);
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

export function updateJob(jobId: string, title: string) {
  return readJson<JobRecord>(buildApiUrl(`/jobs/${jobId}`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
}

export function retryJob(jobId: string) {
  return readJson<JobRecord>(buildApiUrl(`/jobs/${jobId}/retry`), {
    method: "POST",
  });
}

export async function deleteJob(jobId: string) {
  const response = await fetch(buildApiUrl(`/jobs/${jobId}`), {
    method: "DELETE",
  });

  if (!response.ok) {
    let detail: string | undefined;
    try {
      const errorBody = (await response.json()) as { detail?: string };
      detail = errorBody.detail;
    } catch {
      detail = undefined;
    }

    throw new ApiError(`Request failed: ${response.status}`, response.status, detail);
  }
}

export function submitJobQuestion(jobId: string, question: string) {
  return readJson<SubmitJobQuestionResponse>(buildApiUrl(`/jobs/${jobId}/questions`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
}

export function translateJobContent(
  jobId: string,
  contentType: "summary" | "transcript",
  targetLanguageCode: string,
) {
  return readJson<TranslateJobContentResponse>(buildApiUrl(`/jobs/${jobId}/translations`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content_type: contentType,
      target_language_code: targetLanguageCode,
    }),
  });
}
