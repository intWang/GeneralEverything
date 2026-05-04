export type InputMode = "public_video" | "ringcentral_recording";

export type JobStatus = "queued" | "running" | "failed" | "completed";
export type JobStage =
  | "queued"
  | "metadata_ready"
  | "queued_download"
  | "downloading"
  | "download_ready"
  | "transcript_ready"
  | "transcript_generated"
  | "summary_generated"
  | "mindmap_generated"
  | "generating_transcript"
  | "building_summary"
  | "building_mindmap"
  | (string & {});

export type JobRecord = {
  created_at: string;
  description: string | null;
  duration_seconds: number | null;
  detected_language_code?: string | null;
  detected_language_name?: string | null;
  id: string;
  input_mode: InputMode;
  mindmap_node_count?: number | null;
  mindmap_preview_text?: string | null;
  mindmap_status?: string | null;
  source_name: string | null;
  source_url: string;
  stage: JobStage;
  status: JobStatus;
  summary_key_points_count?: number | null;
  summary_preview_text?: string | null;
  summary_source_bullets?: string[] | null;
  summary_source_text?: string | null;
  summary_translations?: Record<string, string> | null;
  summary_status?: string | null;
  transcript_audio_artifact_path?: string | null;
  transcript_extractor?: string | null;
  transcript_preview_text?: string | null;
  transcript_source_text?: string | null;
  transcript_translations?: Record<string, string> | null;
  transcript_segment_count?: number | null;
  transcript_status?: string | null;
  thumbnail_url: string | null;
  title: string | null;
};
