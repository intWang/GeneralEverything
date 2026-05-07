import json

from sqlalchemy.orm import Session, sessionmaker

from app.main import app
from app.models.job import AnalysisJob, InputMode, JobStatus
from tests.test_create_job import make_test_client


def _persist_export_ready_job(testing_session: sessionmaker[Session]) -> AnalysisJob:
    job = AnalysisJob(
        input_mode=InputMode.PUBLIC_VIDEO,
        source_url="https://example.com/watch?v=demo",
        title="Quarterly Product Review",
        duration_seconds=3661,
        source_name="Example Channel",
        description="A recorded product review with launch decisions.",
        status=JobStatus.COMPLETED,
        stage="mindmap_generated",
        download_status="ready",
        download_executor="yt-dlp",
        download_format_id="bestvideo+bestaudio",
        download_format_label="Best MP4",
        download_artifact_path="artifacts/downloads/demo.mp4",
        download_progress_json=json.dumps({"status": "ready", "percent": 100}),
        download_formats_json=json.dumps(
            [
                {
                    "format_id": "bestvideo+bestaudio",
                    "format_label": "Best MP4",
                    "resolution": "1080p",
                    "container": "mp4",
                    "kind": "video",
                }
            ]
        ),
        diagnostics_json=json.dumps(
            [
                {
                    "reason": "download_complete",
                    "stage": "download",
                    "message": "Download completed.",
                    "suggestion": "No action needed.",
                }
            ]
        ),
        transcript_status="ready",
        transcript_extractor="whisper",
        transcript_audio_artifact_path="artifacts/transcripts/demo.wav",
        detected_language_code="en",
        detected_language_name="English",
        transcript_source_text="Fallback transcript text is available.",
        transcript_source_segments_json=json.dumps(
            [
                {
                    "id": "segment-1",
                    "start_seconds": 12,
                    "end_seconds": 18,
                    "text": "We confirmed the launch date.",
                },
                {
                    "id": "segment-2",
                    "start_seconds": 42,
                    "end_seconds": 50,
                    "text": "Training starts next week.",
                },
            ]
        ),
        transcript_segment_count=2,
        summary_status="ready",
        summary_source_text="The team confirmed launch timing and training.",
        summary_source_bullets_json=json.dumps(
            ["Launch date confirmed", "Training starts next week"]
        ),
        summary_structured_json=json.dumps(
            {
                "abstract": "The review aligned launch and enablement plans.",
                "key_points": [
                    {"text": "Launch date confirmed", "citation_ids": ["citation-1"]}
                ],
                "action_items": [
                    {"text": "Prepare training deck", "citation_ids": ["citation-2"]}
                ],
                "decisions": [
                    {"text": "Proceed with launch", "citation_ids": ["citation-1"]}
                ],
                "risks": [],
                "citations": [
                    {
                        "id": "citation-1",
                        "segment_id": "segment-1",
                        "start_seconds": 12,
                        "end_seconds": 18,
                        "label": "00:12",
                    },
                    {
                        "id": "citation-2",
                        "segment_id": "segment-2",
                        "start_seconds": 42,
                        "end_seconds": 50,
                        "label": "00:42",
                    },
                ],
            }
        ),
        summary_key_points_count=2,
        mindmap_status="ready",
        mindmap_preview_text="Launch, training, customer follow-up",
        mindmap_nodes_json=json.dumps(
            {
                "id": "mindmap-root",
                "label": "Product review",
                "summary": "Launch and enablement planning.",
                "references": [
                    {
                        "segment_id": "segment-1",
                        "start_seconds": 12,
                        "end_seconds": 18,
                        "label": "00:12",
                    }
                ],
                "children": [
                    {
                        "id": "mindmap-launch",
                        "label": "Launch",
                        "summary": "Launch date confirmed.",
                        "references": [
                            {
                                "segment_id": "segment-1",
                                "start_seconds": 12,
                                "end_seconds": 18,
                                "label": "00:12",
                            }
                        ],
                        "children": [],
                    }
                ],
            }
        ),
        mindmap_node_count=2,
    )

    with testing_session() as session:
        session.add(job)
        session.commit()
        session.refresh(job)
        session.expunge(job)

    return job


def test_export_markdown_report_contains_analysis_sections(tmp_path) -> None:
    client, testing_session = make_test_client(tmp_path)
    job = _persist_export_ready_job(testing_session)

    try:
        response = client.get(f"/api/jobs/{job.id}/exports/markdown")
    finally:
        app.dependency_overrides.clear()

    payload = response.json()
    markdown = payload["markdown"]

    assert response.status_code == 200
    assert payload["job_id"] == str(job.id)
    assert payload["content_type"] == "text/markdown; charset=utf-8"
    assert payload["filename"] == f"get-analysis-{job.id}.md"
    assert payload["generated_at"]
    assert "# Analysis Report: Quarterly Product Review" in markdown
    assert f"Job ID: `{job.id}`" in markdown
    assert "Export time:" in markdown
    assert "## Video metadata" in markdown
    assert "source_name: Example Channel" in markdown
    assert "duration: 01:01:01" in markdown
    assert "input_mode: public_video" in markdown
    assert "status: completed" in markdown
    assert "stage: mindmap_generated" in markdown
    assert "## Download/source details" in markdown
    assert "download_status: ready" in markdown
    assert "download_executor: yt-dlp" in markdown
    assert "download_format: bestvideo+bestaudio (Best MP4)" in markdown
    assert "download_artifact: artifacts/downloads/demo.mp4" in markdown
    assert "Best MP4" in markdown
    assert "download_complete" in markdown
    assert "## Summary layers" in markdown
    assert "summary_source_text" in markdown
    assert "- Launch date confirmed" in markdown
    assert "### Key Points" in markdown
    assert "Prepare training deck" in markdown
    assert "citation-1" in markdown
    assert "00:12-00:18" in markdown
    assert "## Transcript timeline" in markdown
    assert "[00:12-00:18] We confirmed the launch date." in markdown
    assert "transcript_source_text fallback" in markdown
    assert "Fallback transcript text is available." in markdown
    assert "## Mind map" in markdown
    assert "- Product review" in markdown
    assert "Launch and enablement planning." in markdown
    assert "## Ask AI" in markdown
    assert "Ask AI references are generated on demand" in markdown
    assert "No persisted ask history yet" in markdown
    assert "Readiness context" in markdown
    assert "## References and timestamps" in markdown
    assert "summary citation citation-2" in markdown
    assert "mindmap reference" in markdown


def test_export_markdown_report_returns_404_for_missing_job(tmp_path) -> None:
    client, _testing_session = make_test_client(tmp_path)

    response = client.get("/api/jobs/11111111-1111-1111-1111-111111111111/exports/markdown")

    app.dependency_overrides.clear()

    assert response.status_code == 404
    assert response.json() == {"detail": "Job not found"}


def test_export_markdown_report_ignores_bad_download_json(tmp_path) -> None:
    client, testing_session = make_test_client(tmp_path)
    job = AnalysisJob(
        input_mode=InputMode.PUBLIC_VIDEO,
        source_url="https://example.com/watch?v=bad-json",
        title="Bad JSON Export",
        status=JobStatus.COMPLETED,
        stage="mindmap_generated",
        download_status="ready",
        download_progress_json="not-json",
        download_formats_json=json.dumps({"format_id": "not-a-list"}),
        diagnostics_json=json.dumps("not-a-list"),
        summary_source_text="Summary still exports.",
        transcript_source_text="Transcript still exports.",
        mindmap_preview_text="Mind map still exports.",
    )

    with testing_session() as session:
        session.add(job)
        session.commit()
        session.refresh(job)
        job_id = job.id

    try:
        response = client.get(f"/api/jobs/{job_id}/exports/markdown")
    finally:
        app.dependency_overrides.clear()

    markdown = response.json()["markdown"]

    assert response.status_code == 200
    assert "# Analysis Report: Bad JSON Export" in markdown
    assert "Summary still exports." in markdown
    assert "Transcript still exports." in markdown
    assert "Mind map still exports." in markdown
    assert "### Download progress" not in markdown
    assert "### Available formats" not in markdown
    assert "### Diagnostics" not in markdown
