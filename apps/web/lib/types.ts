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

export type DownloadProgress = {
  downloaded_bytes?: number | null;
  eta_seconds?: number | null;
  percent?: number | null;
  speed_bytes_per_second?: number | null;
  status: "queued" | "probing" | "downloading" | "ready" | "failed" | (string & {});
  total_bytes?: number | null;
};

export type DownloadFormat = {
  artifact_path?: string | null;
  container?: string | null;
  format_id: string;
  format_label: string;
  kind: "video" | "audio" | "subtitle" | "thumbnail" | "report" | (string & {});
  resolution?: string | null;
};

export type Diagnostic = {
  message: string;
  reason: string;
  stage: string;
  suggestion: string;
};

export type TranscriptSegment = {
  end_seconds: number;
  id: string;
  start_seconds: number;
  text: string;
};

export type SummaryCitation = {
  end_seconds?: number | null;
  id: string;
  label?: string | null;
  segment_id?: string | null;
  start_seconds?: number | null;
};

export type StructuredSummaryItem = {
  citation_ids?: string[];
  text: string;
};

export type StructuredSummary = {
  abstract?: string | null;
  action_items?: StructuredSummaryItem[];
  citations?: SummaryCitation[];
  decisions?: StructuredSummaryItem[];
  key_points?: StructuredSummaryItem[];
  risks?: StructuredSummaryItem[];
};

export type MindMapReference = {
  end_seconds?: number | null;
  label?: string | null;
  segment_id?: string | null;
  start_seconds?: number | null;
};

export type MindMapNode = {
  children?: MindMapNode[];
  id: string;
  label: string;
  references?: MindMapReference[];
  summary?: string | null;
};

export type JobRecord = {
  created_at: string;
  description: string | null;
  duration_seconds: number | null;
  detected_language_code?: string | null;
  detected_language_name?: string | null;
  diagnostics?: Diagnostic[] | null;
  download_formats?: DownloadFormat[] | null;
  download_artifact_path?: string | null;
  download_progress?: DownloadProgress | null;
  download_status?: string | null;
  id: string;
  input_mode: InputMode;
  mindmap_node_count?: number | null;
  mindmap_nodes?: MindMapNode | null;
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
  summary_structured?: StructuredSummary | null;
  summary_translations?: Record<string, string> | null;
  summary_status?: string | null;
  transcript_audio_artifact_path?: string | null;
  transcript_extractor?: string | null;
  transcript_preview_text?: string | null;
  transcript_source_segments?: TranscriptSegment[] | null;
  transcript_source_text?: string | null;
  transcript_translations?: Record<string, string> | null;
  transcript_segment_count?: number | null;
  transcript_status?: string | null;
  thumbnail_url: string | null;
  title: string | null;
};
