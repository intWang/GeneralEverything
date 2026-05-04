# Multilingual Transcript And Translation Design

- Date: 2026-05-04
- Scope: `apps/api`, `apps/web`
- Status: Draft for review

## Problem

The current transcript and summary pipeline does not run real speech recognition. It only extracts audio with `ffmpeg`, stores shell placeholder text, and then builds a summary shell from that placeholder. As a result:

- Chinese is not specifically blocked, but it also does not work.
- English and every other language are equally limited.
- The UI appears to have transcript and summary stages, but those stages do not produce real analysis output.

We need to replace the placeholder transcript flow with a real multilingual pipeline that:

1. Automatically detects the spoken language in the audio.
2. Produces transcript output in the source language.
3. Produces summary output grounded in the source-language transcript.
4. Supports intelligent translation of transcript and summary into 18 common target languages.

## Goals

- Support multilingual audio transcription without requiring manual language selection.
- Preserve a source-of-truth transcript in the detected source language.
- Generate source-language summaries before any translation occurs.
- Let users read transcript and summary in the original language or a translated language.
- Keep translation cost controlled by generating translations on demand instead of precomputing all 18 languages for every job.

## Non-Goals

- Real-time streaming transcript generation.
- Speaker diarization in this phase.
- Subtitle file export in this phase.
- Translation-aware Ask AI grounding in this phase. Ask AI will continue to ground on source-language artifacts first.

## Recommended Approach

Use an OpenAI-backed pipeline for transcription and translation.

Reasoning:

- Best multilingual accuracy for the least custom infrastructure.
- Native support for automatic language detection.
- Easiest path to consistent transcript, summary, and translation quality.
- Keeps the architecture simple enough to ship in two iterations.

The system should treat the source-language transcript and summary as canonical. Translation is a derived artifact.

## User Experience

### Default behavior

After analysis completes:

- `Video info` shows the detected audio language.
- `Transcript` shows original-language transcript text by default.
- `Summary` shows original-language summary by default.

### Language switching

The `Transcript` and `Summary` tabs gain a language selector with:

- `Original`
- 18 target languages

When a user selects a target language:

- If a translation already exists, show it immediately.
- If not, request translation and show a loading state.
- Cache the translated result for subsequent visits.

### Ask AI behavior

In this phase:

- Ask AI continues to ground on source-language transcript and source-language summary.
- The displayed answer language may remain unchanged initially.
- Translation-aware Ask AI can be a follow-up enhancement after the source and translation artifacts are stable.

## Supported Languages

The first release supports these translation targets:

- `en` English
- `zh-CN` Chinese (Simplified)
- `zh-TW` Chinese (Traditional)
- `ja` Japanese
- `ko` Korean
- `es` Spanish
- `fr` French
- `de` German
- `pt` Portuguese
- `it` Italian
- `ru` Russian
- `ar` Arabic
- `hi` Hindi
- `id` Indonesian
- `th` Thai
- `vi` Vietnamese
- `tr` Turkish
- `nl` Dutch

The source-language transcript can be any language supported by the transcription provider. The target translation set is restricted to the list above.

## Backend Architecture

### Canonical flow

The processing pipeline becomes:

1. Download video
2. Extract audio with `ffmpeg`
3. Run speech recognition with automatic language detection
4. Persist source-language transcript
5. Generate source-language summary from transcript
6. Generate source-language mind map from summary
7. Generate translations for transcript or summary on demand

### Transcript service responsibilities

The transcript service must now:

- Read the extracted audio artifact
- Send it to the transcription provider
- Receive:
  - detected language code
  - detected language display name
  - full transcript text
  - optional transcript segments
- Persist a complete transcript result instead of placeholder shell text

### Summary service responsibilities

The summary service must:

- Consume canonical transcript text
- Generate a structured summary in the source language
- Persist summary text and summary bullets

### Translation service responsibilities

Add a dedicated translation service for derived artifacts. It must:

- Accept:
  - `job_id`
  - `content_type` (`transcript` or `summary`)
  - `target_language_code`
- Read source-language canonical text
- Generate translation
- Persist or update the localized artifact

This service must be separate from transcription and summary so translation can be requested lazily.

## Data Model

### `analysis_jobs` additions

Add canonical source-language fields to the job model:

- `detected_language_code`
- `detected_language_name`
- `transcript_source_text`
- `transcript_source_segments_json`
- `summary_source_text`
- `summary_source_bullets_json`

Keep existing shell-compatible fields during migration if needed, but new UI work should read from canonical source fields.

### New localization table

Add a new table, recommended name: `analysis_job_localizations`

Fields:

- `id`
- `job_id`
- `content_type`
- `target_language_code`
- `translated_text`
- `translated_segments_json` nullable
- `status`
- `error_message`
- `created_at`
- `updated_at`

Constraints:

- Unique on `(job_id, content_type, target_language_code)`

This keeps translated artifacts normalized and avoids bloating the main job row.

## API Design

### Job response additions

`GET /jobs/{id}` should include:

- detected language metadata
- canonical source transcript fields
- canonical source summary fields
- translation availability metadata for transcript and summary

### Translation request endpoint

Add a new endpoint for lazy translation, for example:

- `POST /jobs/{id}/localizations`

Request body:

- `content_type`
- `target_language_code`

Response:

- translation record status
- translated artifact when available

If a translation already exists, the endpoint should return the existing record rather than recomputing.

## Frontend Design

### Video info panel

Extend the panel to show:

- detected language name
- detected language code when useful for debugging or fallback display

### Transcript tab

Add a selector above the transcript content:

- `Original`
- supported target languages

Rendering rules:

- `Original` reads from canonical transcript source fields
- translated views read from localization records
- if translation is missing, trigger creation and show loading state

### Summary tab

Use the same pattern as transcript:

- `Original`
- supported target languages

The summary tab should switch between canonical source summary text and translated summary text.

### Loading and error states

Per-tab language loading should be isolated:

- translating transcript must not block summary
- translating summary must not block transcript

If translation fails:

- show a local error state inside that tab
- do not break the main job result view

## Pipeline Status Model

The current stage model is transcript-shell oriented. Update it to reflect real work:

- `transcript_ready`
- `transcribing`
- `transcript_generated`
- `building_summary`
- `summary_generated`
- `building_mindmap`
- `mindmap_generated`

Translation should not block overall job completion. Translation is a derived post-analysis task. It should have its own status model per localization record instead of mutating the main job stage after completion.

## Error Handling

### Transcription failures

If transcription fails:

- mark job failed
- surface provider error safely
- do not attempt summary or mind map generation

### Summary failures

If summary fails:

- preserve successful transcript output
- mark summary status failed
- do not present fake summary content

### Translation failures

If translation fails:

- preserve source-language transcript and summary
- mark only that localization record failed
- allow retry without re-running the entire job

## Rollout Plan

### Phase 1

Ship real multilingual transcript and summary generation:

- real transcription
- automatic language detection
- canonical source-language transcript
- canonical source-language summary
- detected language display in UI

This phase fixes the immediate product problem: transcript and summary do not produce real content today.

### Phase 2

Ship lazy translation:

- localization table
- translation endpoint
- transcript language selector
- summary language selector
- 18 target languages

## Testing Strategy

### Backend tests

- transcript service stores detected language and source transcript
- summary service consumes real transcript text
- translation service creates and reuses localization records
- duplicate translation requests do not create duplicate rows
- failed translation requests do not corrupt source artifacts

### Frontend tests

- detected language appears in `Video info`
- transcript defaults to `Original`
- summary defaults to `Original`
- switching to a new language triggers translation loading
- switching to an existing language shows cached translation
- translation errors stay local to the tab

### Integration tests

- Chinese audio yields detected Chinese and usable transcript text
- English audio yields detected English and usable transcript text
- summary is generated from source-language transcript
- translated summary and transcript can be requested after completion

## Open Questions Resolved

- Should we summarize the translated transcript instead of the original transcript?
  - No. Summary is generated from the original transcript to preserve meaning.

- Should we precompute all 18 languages for every job?
  - No. Use lazy translation to control cost and latency.

- Should Ask AI use translated artifacts in this phase?
  - No. It continues grounding on canonical source-language artifacts first.

## Recommendation

Proceed in two implementation steps:

1. Replace placeholder transcript and summary generation with real multilingual source-language generation.
2. Add lazy translation plus UI language switching for transcript and summary.

This sequencing solves the current broken output problem first, then layers on multilingual product value without overloading the first implementation.
