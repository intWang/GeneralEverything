export type InputMode = "public_video" | "ringcentral_recording";

export type JobStatus = "queued" | "running" | "failed" | "completed";

export type JobRecord = {
  created_at: string;
  description: string | null;
  duration_seconds: number | null;
  id: string;
  input_mode: InputMode;
  source_name: string | null;
  source_url: string;
  stage: string;
  status: JobStatus;
  thumbnail_url: string | null;
  title: string | null;
};
