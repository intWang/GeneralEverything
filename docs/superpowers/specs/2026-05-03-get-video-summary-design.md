# GET Video Summary Design

## Overview

GeneralEveryThing (GET) is an AI-powered summarization web product that will eventually support multiple information categories such as video, audio, text, and images. Phase 1 focuses only on video summarization.

The Phase 1 product accepts video URLs from two explicit sources:

- Public video URLs
- RingCentral internal recording URLs

Users submit a URL, and GET ingests the corresponding media, progressively extracts structure and meaning from it, and renders results in a two-column workspace. The left column presents video metadata and downloadable assets. The right column presents AI-generated output across four tabs:

- Summary
- Transcript
- Mind Map
- Ask AI

The product must provide fast perceived responsiveness by returning metadata early and streaming incremental results while download and analysis are still running.

## Goals

- Build a production-shaped Phase 1 web product for video-only summarization
- Support both public video URLs and authorized RingCentral recording URLs
- Use open source components wherever practical, with light integration or extension instead of building low-level media tooling from scratch
- Stream progress and partial outputs instead of waiting for full completion
- Produce a usable transcript, rolling summary, read-only mind map, and grounded Q&A experience
- Establish an architecture that can later expand to audio, text, and image inputs

## Non-Goals

- Support DRM-protected media
- Guarantee support for every video website
- Support arbitrary browser-session scraping as the primary internal recording strategy
- Ship editable mind maps in Phase 1
- Build a multi-modal unified intake for audio, text, or images in Phase 1
- Build batch import, team collaboration, or enterprise admin management in Phase 1

## User Experience

### Homepage

The homepage uses a trustworthy, enterprise-grade visual language inspired by RingCentral, with a layout pattern inspired by saveanyvideo.online.

The page contains:

1. A simple top navigation with product branding and account actions
2. A hero section that explains the product value proposition
3. A dual-entry input area with explicit mode switching
   - Public Video URL
   - RingCentral Recording URL
4. A results area that expands in place below the input once analysis starts

### Input Modes

#### Public Video URL

This mode accepts public URLs from supported non-DRM video sources. The UI explains that support depends on accessibility and source compatibility.

#### RingCentral Recording URL

This mode accepts internal RingCentral recording URLs. If the user has not yet connected RingCentral, the UI prompts them to authenticate before analysis can start.

### Results Layout

The results area is split into two columns.

#### Left Column: Video Info

The left column displays:

- Cover image / thumbnail
- Title
- Source platform
- Duration
- Publish or recording time
- Tags when available
- Short description
- Current processing state
- Available resolutions
- Download buttons for original video, extracted audio, and subtitles when available

#### Right Column: AI Workspace

The right column contains four tabs:

- Summary
- Transcript
- Mind Map
- Ask AI

Phase 1 prioritizes transcript, summary, and Q&A quality. The Mind Map tab is included, but starts as a read-only structured rendering backed by markdown or JSON tree data.

### Streaming Feedback

After the user clicks Analyze, the page should not block behind a full-page loading state. Instead, the UI progressively reveals state transitions:

- Detecting source
- Fetching metadata
- Downloading stream
- Extracting audio
- Generating transcript
- Building summary
- Preparing Q&A

Metadata should appear as early as possible, before the full download completes. Transcript and summary should grow incrementally. Ask AI becomes available after enough content has been processed to support grounded answers.

### Error Experience

Errors should be productized and user-readable. Examples:

- Unsupported link
- Missing RingCentral authorization
- Insufficient permission for a recording
- Protected media that cannot be processed
- Interrupted or failed media stream

The UI should avoid raw stack traces and instead surface concise explanations with retry guidance when applicable.

## Product Scope

### Phase 1 Must-Haves

- Two explicit video input modes: Public Video URL and RingCentral Recording URL
- URL ingestion and source detection
- Metadata discovery
- Download or stream ingestion
- Audio extraction and chunking
- Incremental transcription
- Incremental summary generation
- Read-only mind map generation
- Q&A grounded in parsed content
- Persistent task state so users can refresh and resume viewing results

### Phase 1 Deliberately Deferred

- DRM handling
- Editable mind map UI
- Bulk URL processing
- Multi-tenant administration
- Team sharing or annotation
- Mobile apps
- Input types other than video

## Technical Direction

### Frontend

- Framework: Next.js
- Rendering model: server-rendered product shell with client-managed streaming result views
- Streaming transport: SSE

The frontend is responsible for:

- Rendering the dual-entry homepage
- Creating analysis jobs
- Subscribing to streaming job updates
- Updating transcript, summary, and mind map tabs incrementally
- Displaying availability changes, such as when Ask AI becomes ready

### Backend

Phase 1 backend stack:

- Python
- FastAPI
- Redis
- Arq
- PostgreSQL
- SQLAlchemy 2.x
- Alembic

This stack is chosen because Python fits media orchestration, transcription pipelines, and AI service integration well, while FastAPI is well-suited for task-oriented APIs and SSE endpoints.

### Open Source Media Tooling

Primary public-video ingestion stack:

- yt-dlp
- ffmpeg
- ffprobe

Fallback stream downloader for some HLS/DASH scenarios:

- N_m3u8DL-RE

These tools should be treated as external engines behind a stable application service boundary. GET should not expose tool-specific details directly to the UI.

### Enterprise Recording Access

RingCentral internal recordings should be supported through official authorization and API-oriented access patterns whenever possible.

Preferred strategy:

- User signs into GET
- User connects RingCentral through OAuth or an approved service-account style integration
- GET fetches recording metadata and authorized media access through the official RingCentral path

Not preferred:

- brittle page scraping
- manual cookie uploads as the main product path

## Backend Architecture

The backend is split into focused modules with clear boundaries.

### 1. API Module

Responsibilities:

- Accept user input
- Create and query jobs
- Serve SSE streams
- Validate parameters
- Enforce user access

This layer must stay thin and should not contain long-running business logic.

### 2. Ingestion Module

Responsibilities:

- Normalize submitted URLs
- Detect source type
- Decide whether the URL is public video or RingCentral recording
- Decide whether authorization is required
- Select the appropriate connector and media strategy

This is the routing and decision-making layer for incoming jobs.

### 3. Connectors Module

Responsibilities:

- Encapsulate source-specific integration logic
- Return normalized metadata and media-access information

Phase 1 connectors:

- `public_video_connector`
- `ringcentral_connector`

The public connector wraps yt-dlp, ffprobe, and N_m3u8DL-RE decisions. The RingCentral connector wraps OAuth, recording lookup, metadata retrieval, and recording access resolution.

### 4. Media Pipeline Module

Responsibilities:

- Start download or stream capture
- Collect media metadata
- Track download progress
- Extract audio chunks
- Manage intermediate files
- Publish media-related events

This module does not perform AI work. It only prepares structured media assets and audio chunk events.

### 5. Transcript Pipeline Module

Responsibilities:

- Receive audio chunks
- Perform incremental transcription
- Maintain provisional and finalized transcript segments
- Preserve timestamps

The transcript pipeline produces rolling transcript updates suitable for live UI rendering.

### 6. Summary Pipeline Module

Responsibilities:

- Consume transcript data
- Build rolling summaries
- Extract key topics and action items
- Generate mind map source data as markdown or JSON tree

This pipeline should emit partial updates as more transcript becomes stable.

### 7. Q&A Pipeline Module

Responsibilities:

- Create searchable chunks from transcript and summary output
- Build retrieval context
- Answer user questions grounded in parsed content

Answers should distinguish whether they are based on partial content or the completed recording.

## Processing Flow

The end-to-end job flow is:

1. User submits a URL in one of the two input modes
2. API creates an analysis job
3. Ingestion determines source type and authorization requirements
4. Connector fetches initial metadata and access details
5. UI receives early metadata
6. Media pipeline starts download or stream ingestion
7. Audio extraction produces chunks
8. Transcript pipeline generates incremental transcript segments
9. Summary pipeline generates rolling summary and mind map data
10. Q&A pipeline becomes active after enough content is available
11. UI continues receiving events until the job completes or fails

## Streaming Event Model

The frontend should consume a stable event taxonomy over SSE:

- `job.status`
- `video.metadata`
- `video.download.progress`
- `transcript.delta`
- `transcript.finalized`
- `summary.delta`
- `mindmap.delta`
- `qa.ready`
- `error`

This event model keeps the UI transport simple and decouples frontend rendering from worker internals.

## Persistence Model

Phase 1 requires persistent storage for jobs, assets, and AI outputs. Suggested core entities:

- `users`
- `oauth_accounts`
- `analysis_jobs`
- `source_assets`
- `video_variants`
- `transcript_segments`
- `summary_snapshots`
- `mindmap_snapshots`
- `qa_documents`
- `qa_conversations`

### Central Object: `analysis_jobs`

This object should capture:

- Submitted URL
- Input mode
- Resolved source type
- Current stage
- Progress indicators
- Failure category and message
- Links to media assets
- Links to transcript, summary, and Q&A artifacts

Persistent jobs enable:

- Refresh-safe viewing
- Retry flows
- History views
- Operations visibility

## AI and Transcription Approach

Phase 1 transcription uses open source `faster-whisper`.

Phase 1 AI output goals:

- Transcript quality high enough for downstream summarization
- Summary generated incrementally from stabilized transcript windows
- Mind map generated as structured textual hierarchy
- Q&A grounded in transcript and summary chunks

Phase 1 should avoid over-complicated agent loops. A predictable retrieval-and-answer flow is preferred over an open-ended agent architecture.

## Performance and Reliability Requirements

### Responsiveness

- Job creation should return quickly
- Metadata should be surfaced before full media completion
- Transcript and summary should stream in progressively

### Recoverability

- Job state must be persisted
- Users should be able to refresh and continue watching progress
- Failed jobs should be retryable
- Intermediate files should have cleanup policies

### Observability

- Every job should expose a clearly defined stage
- External-tool calls should be logged in summarized form
- Failures should be classified by type
- The system should distinguish authorization failures, unsupported sources, media failures, transcription failures, and model failures

### Security

- OAuth tokens must be stored securely
- Internal recordings must never be exposed as public resources
- Result access must be permission-aware
- Temporary media artifacts must have a retention and deletion policy

### Extensibility

- New source connectors should be addable without rewriting the UI
- AI models should be replaceable behind service interfaces
- The architecture should support future expansion to audio, text, and image inputs

## Recommended Open Source Strategy

GET should favor mature open source tools and wrap them behind product-specific boundaries instead of reimplementing low-level download or codec logic.

Recommended principle:

- Build product logic
- Integrate open source infrastructure
- Avoid rebuilding download engines, media muxers, or transcription primitives from scratch

This keeps Phase 1 focused on differentiated value: orchestrating ingestion, understanding, and user-facing progressive summarization.

## Delivery Judgment

This is a strong Phase 1 scope because it forms a coherent end-to-end product:

- A clear video-only focus
- Public and enterprise recording support
- Real-time perceived progress
- Practical AI outputs
- A strong foundation for future multi-modal expansion

It is intentionally narrower than a generalized knowledge platform and intentionally richer than a simple media downloader.
