import type { Page, Route } from "@playwright/test";

import type { JobRecord } from "../../lib/types";

export const phase2JobId = "get-phase2-e2e-demo";

export const phase2Job: JobRecord = {
  created_at: "2026-05-07T19:30:00.000Z",
  description:
    "A sanitized browser fixture covering download progress, transcript, summary, mind map, Ask AI, history, and export surfaces.",
  detected_language_code: "en",
  detected_language_name: "English",
  diagnostics: [
    {
      reason: "ringcentral_auth_required",
      stage: "metadata_probe",
      message: "This internal recording may require an authenticated browser session.",
      suggestion:
        "Open the shared recording in the company browser session, then retry with a fresh shared link.",
    },
  ],
  download_artifact_path: "/artifacts/get-phase2-e2e-demo/video-1080p.mp4",
  download_formats: [
    {
      artifact_path: "/artifacts/get-phase2-e2e-demo/video-1080p.mp4",
      container: "mp4",
      format_id: "rc-1080p",
      format_label: "1080p meeting recording",
      kind: "video",
      resolution: "1920x1080",
    },
    {
      artifact_path: "/artifacts/get-phase2-e2e-demo/audio.m4a",
      container: "m4a",
      format_id: "rc-audio",
      format_label: "Audio only",
      kind: "audio",
      resolution: "source",
    },
  ],
  download_progress: {
    downloaded_bytes: 73_400_320,
    eta_seconds: 18,
    percent: 72,
    speed_bytes_per_second: 2_457_600,
    status: "downloading",
    total_bytes: 104_857_600,
  },
  download_status: "downloading",
  duration_seconds: 1886,
  id: phase2JobId,
  input_mode: "ringcentral_recording",
  mindmap_node_count: 4,
  mindmap_nodes: {
    children: [
      {
        children: [],
        id: "streaming",
        label: "Streaming pipeline",
        references: [
          {
            label: "Live updates",
            segment_id: "seg-3",
            start_seconds: 121,
          },
        ],
        summary:
          "Progress, transcript, summary, and mind map shells stream into the UI.",
      },
    ],
    id: "root",
    label: "Product planning sync",
    references: [
      {
        label: "Opening context",
        segment_id: "seg-1",
        start_seconds: 12,
      },
    ],
    summary:
      "The team aligns on recording ingestion, live AI output, and report export readiness.",
  },
  mindmap_preview_text: "source handling, streaming pipeline, export and history",
  mindmap_status: "ready",
  source_name: "RingCentral Recording",
  source_url: "https://recording.example.internal/meetings/e2e-demo",
  stage: "mindmap_generated",
  status: "completed",
  summary_key_points_count: 3,
  summary_preview_text:
    "The recording validates GET Phase 2 video analysis flows with streaming progress and grounded outputs.",
  summary_source_bullets: [
    "RingCentral recordings are treated as a first-class source with safe diagnostics.",
    "Transcript, summary, mind map, and Ask AI panels preserve source references.",
    "History controls and Markdown export are available from the results workspace.",
  ],
  summary_source_text:
    "The team validated a Phase 2 workflow for internal recordings with progress, diagnostics, grounded references, and Markdown export.",
  summary_status: "ready",
  summary_structured: {
    abstract:
      "GET Phase 2 behaves like a video-intelligence workspace for internal recording analysis.",
    action_items: [
      {
        citation_ids: ["seg-3"],
        text: "Review streaming transcript and progress behavior before production rollout.",
      },
    ],
    citations: [
      {
        id: "seg-3",
        label: "Live updates",
        segment_id: "seg-3",
        start_seconds: 121,
      },
    ],
    decisions: [
      {
        citation_ids: ["seg-2"],
        text: "Keep RingCentral credentials behind connector boundaries.",
      },
    ],
    key_points: [
      {
        citation_ids: ["seg-1"],
        text: "Internal source support is visible in the workspace.",
      },
    ],
    risks: [
      {
        citation_ids: ["seg-2"],
        text: "Real recordings may require authenticated browser sessions.",
      },
    ],
  },
  thumbnail_url: null,
  title: "GET Phase 2 E2E Recording Demo",
  transcript_audio_artifact_path: "/artifacts/get-phase2-e2e-demo/audio.m4a",
  transcript_extractor: "fixture-whisper-stream",
  transcript_preview_text:
    "[02:01] While the media downloads, progress and transcript segments should appear in the workspace.",
  transcript_segment_count: 3,
  transcript_source_segments: [
    {
      end_seconds: 34,
      id: "seg-1",
      start_seconds: 12,
      text: "We need the internal recording path to feel as immediate as a public video URL.",
    },
    {
      end_seconds: 86,
      id: "seg-2",
      start_seconds: 65,
      text: "The connector should normalize the shared link and redact sensitive query tokens.",
    },
    {
      end_seconds: 150,
      id: "seg-3",
      start_seconds: 121,
      text: "While the media downloads, progress and transcript segments should appear in the workspace.",
    },
  ],
  transcript_source_text:
    "[00:12] We need the internal recording path to feel as immediate as a public video URL.\n[01:05] The connector should normalize the shared link and redact sensitive query tokens.\n[02:01] While the media downloads, progress and transcript segments should appear in the workspace.",
  transcript_status: "ready",
};

export const phase2MarkdownReport = `# GET Phase 2 E2E Recording Demo

## Summary
${phase2Job.summary_source_text}

## Transcript
${phase2Job.transcript_source_text}
`;

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    body: JSON.stringify(body),
    contentType: "application/json",
    status,
  });
}

export async function installPhase2ApiFixtures(page: Page) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;
    const method = request.method();

    if (pathname === "/api/jobs" && method === "GET") {
      await fulfillJson(route, [phase2Job]);
      return;
    }

    if (pathname === `/api/jobs/${phase2JobId}` && method === "GET") {
      await fulfillJson(route, phase2Job);
      return;
    }

    if (pathname.endsWith("/events")) {
      await route.fulfill({
        body: "",
        headers: { "content-type": "text/event-stream" },
        status: 200,
      });
      return;
    }

    if (pathname === `/api/jobs/${phase2JobId}/questions` && method === "POST") {
      await fulfillJson(route, {
        answer:
          "Review the streaming pipeline first: it connects safe RingCentral intake, progressive transcript context, and grounded summary export.",
        grounded: true,
        job_id: phase2JobId,
        question: "What should I review first?",
        references: ["Transcript 02:01", "Summary key point 2"],
        structured_references: [
          {
            end_seconds: 150,
            segment_id: "seg-3",
            snippet:
              "Progress and transcript segments should appear without waiting for the full file.",
            source_type: "transcript",
            start_seconds: 121,
          },
        ],
      });
      return;
    }

    if (pathname === `/api/jobs/${phase2JobId}/exports/markdown` && method === "GET") {
      await fulfillJson(route, {
        content_type: "text/markdown; charset=utf-8",
        filename: "get-phase2-e2e-recording-demo.md",
        generated_at: "2026-05-07T19:30:00Z",
        job_id: phase2JobId,
        markdown: phase2MarkdownReport,
      });
      return;
    }

    await fulfillJson(route, {
      detail: `Unhandled e2e fixture route: ${method} ${pathname}`,
    }, 404);
  });
}
