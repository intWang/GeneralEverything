export type InputMode = "public_video" | "ringcentral_recording";

export type JobStatus = "queued" | "running" | "failed" | "completed";

export type JobRecord = {
  created_at: string;
  id: string;
  input_mode: InputMode;
  source_url: string;
  stage: string;
  status: JobStatus;
};
