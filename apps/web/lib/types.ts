export type InputMode = "public_video" | "ringcentral_recording";

export type JobStatus = "queued" | "running" | "failed" | "completed";
export type JobStage =
  | "queued"
  | "metadata_ready"
  | "queued_download"
  | "downloading"
  | "download_ready"
  | "transcript_ready"
  | "generating_transcript"
  | "building_summary"
  | "building_mindmap"
  | (string & {});

export type JobRecord = {
  created_at: string;
  description: string | null;
  duration_seconds: number | null;
  id: string;
  input_mode: InputMode;
  source_name: string | null;
  source_url: string;
  stage: JobStage;
  status: JobStatus;
  transcript_audio_artifact_path?: string | null;
  transcript_extractor?: string | null;
  transcript_status?: string | null;
  thumbnail_url: string | null;
  title: string | null;
};
