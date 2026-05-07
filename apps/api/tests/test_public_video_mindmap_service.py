from __future__ import annotations

import json
from datetime import datetime, timezone
from uuid import UUID

import pytest

from app.models.job import AnalysisJob, InputMode, JobStatus
from app.schemas.jobs import JobResponse
from app.services.mindmaps.public_video import (
    PublicVideoMindMapShellError,
    generate_public_video_mindmap_shell,
)


def _make_job(
    summary_preview_text: str | None = "Summary shell generated from transcript preview.",
) -> AnalysisJob:
    return AnalysisJob(
        id=UUID("12345678-1234-5678-1234-567812345678"),
        input_mode=InputMode.PUBLIC_VIDEO,
        source_url="https://example.com/watch?v=test",
        status=JobStatus.RUNNING,
        stage="summary_generated",
        created_at=datetime(2026, 5, 8, tzinfo=timezone.utc),
        summary_status="ready",
        summary_preview_text=summary_preview_text,
        summary_key_points_count=2,
    )


def test_generate_public_video_mindmap_shell_returns_generated_result() -> None:
    result = generate_public_video_mindmap_shell(_make_job())

    assert result.status == "ready"
    assert result.stage == "mindmap_generated"
    assert result.node_count == 2
    assert "Summary shell generated from transcript preview." in (result.preview_text or "")


def test_generate_public_video_mindmap_shell_returns_structured_tree() -> None:
    job = _make_job("Launch plan, customer training.")
    job.summary_structured_json = json.dumps(
        {
            "abstract": "Launch plan and customer training.",
            "key_points": [
                {"text": "Launch plan is confirmed", "citation_ids": ["citation-1"]},
                {"text": "Customer training follows", "citation_ids": ["citation-2"]},
            ],
            "action_items": [],
            "decisions": [],
            "risks": [],
            "citations": [
                {
                    "id": "citation-1",
                    "segment_id": "segment-1",
                    "start_seconds": 3,
                    "end_seconds": 8,
                    "label": "00:03",
                },
                {
                    "id": "citation-2",
                    "segment_id": "segment-2",
                    "start_seconds": 9,
                    "end_seconds": 15,
                    "label": "00:09",
                },
            ],
        }
    )

    result = generate_public_video_mindmap_shell(job)

    assert result.nodes == {
        "id": "mindmap-root",
        "label": "Launch plan and customer training.",
        "summary": "Launch plan and customer training.",
        "children": [
            {
                "id": "mindmap-key-point-1",
                "label": "Launch plan is confirmed",
                "children": [],
                "references": [
                    {
                        "segment_id": "segment-1",
                        "start_seconds": 3.0,
                        "end_seconds": 8.0,
                        "label": "00:03",
                    }
                ],
            },
            {
                "id": "mindmap-key-point-2",
                "label": "Customer training follows",
                "children": [],
                "references": [
                    {
                        "segment_id": "segment-2",
                        "start_seconds": 9.0,
                        "end_seconds": 15.0,
                        "label": "00:09",
                    }
                ],
            },
        ],
        "references": [],
    }
    assert result.node_count == 3

    persisted_job = _make_job()
    persisted_job.mindmap_nodes_json = result.mindmap_nodes_json()
    response = JobResponse.model_validate(persisted_job)

    assert response.mindmap_nodes is not None
    assert response.mindmap_nodes.children[0].id == "mindmap-key-point-1"
    assert response.mindmap_nodes.children[0].references[0].segment_id == "segment-1"


def test_analysis_job_mindmap_nodes_returns_none_for_invalid_json_or_shape() -> None:
    job = _make_job()
    job.mindmap_nodes_json = "{not valid json"

    assert JobResponse.model_validate(job).mindmap_nodes is None

    job.mindmap_nodes_json = json.dumps({"id": "root", "children": []})

    assert JobResponse.model_validate(job).mindmap_nodes is None


def test_analysis_job_mindmap_nodes_returns_none_for_deep_tree() -> None:
    job = _make_job()
    deep_tree = {"id": "node-0", "label": "Node 0", "children": [], "references": []}
    current_node = deep_tree
    for index in range(1, 90):
        child = {
            "id": f"node-{index}",
            "label": f"Node {index}",
            "children": [],
            "references": [],
        }
        current_node["children"] = [child]
        current_node = child
    job.mindmap_nodes_json = json.dumps(deep_tree)

    assert JobResponse.model_validate(job).mindmap_nodes is None


def test_generate_public_video_mindmap_shell_requires_summary_preview() -> None:
    with pytest.raises(PublicVideoMindMapShellError) as exc_info:
        generate_public_video_mindmap_shell(_make_job(summary_preview_text=None))

    assert exc_info.value.reason == "missing_summary_preview"


def test_generate_public_video_mindmap_shell_requires_ready_summary() -> None:
    job = _make_job()
    job.summary_status = "failed"

    with pytest.raises(PublicVideoMindMapShellError) as exc_info:
        generate_public_video_mindmap_shell(job)

    assert exc_info.value.reason == "summary_not_ready"
