from __future__ import annotations

from uuid import UUID

import pytest

from app.models.job import AnalysisJob, InputMode, JobStatus
from app.services.summaries.public_video import (
    PublicVideoSummaryShellError,
    generate_public_video_summary_shell,
)


def _make_job(
    transcript_preview_text: str | None = "Transcript shell generated for demo.wav.",
) -> AnalysisJob:
    job = AnalysisJob(
        id=UUID("12345678-1234-5678-1234-567812345678"),
        input_mode=InputMode.PUBLIC_VIDEO,
        source_url="https://example.com/watch?v=test",
        status=JobStatus.RUNNING,
        stage="transcript_generated",
        transcript_status="ready",
        transcript_preview_text=transcript_preview_text,
        transcript_segment_count=2,
    )
    job.transcript_source_text = "今天讨论了产品发布时间和客户培训安排。"
    return job


def test_generate_public_video_summary_shell_returns_generated_result() -> None:
    job = _make_job()
    job.transcript_source_text = (
        "今天团队确认了产品会在下周发布。"
        "客户成功团队会在周四前准备培训材料。"
        "销售团队将在发布前同步客户名单。"
    )

    result = generate_public_video_summary_shell(job)

    assert result.status == "ready"
    assert result.stage == "summary_generated"
    assert result.key_points_count == 3
    assert result.preview_text == "录音确认了产品发布时间，并安排了培训准备和客户同步。"
    assert result.source_text == "录音确认了产品发布时间，并安排了培训准备和客户同步。"
    assert result.source_bullets == [
        "产品发布时间已确认在下周",
        "客户成功团队将在周四前完成培训材料准备",
        "销售团队将在发布前同步客户名单",
    ]


def test_generate_public_video_summary_shell_uses_source_transcript_text() -> None:
    result = generate_public_video_summary_shell(
        _make_job(),
        summarizer=lambda transcript: type("SummaryResult", (), {
            "status": "ready",
            "stage": "summary_generated",
            "source_text": f"Summary for: {transcript}",
            "source_bullets": [
                "产品将在下周发布",
                "支持团队负责培训",
            ],
            "preview_text": "产品将在下周发布，培训由支持团队负责。",
            "key_points_count": 2,
        })(),
    )

    assert result.source_text == "Summary for: 今天讨论了产品发布时间和客户培训安排。"
    assert result.source_bullets == [
        "产品将在下周发布",
        "支持团队负责培训",
    ]
    assert result.key_points_count == 2


def test_generate_public_video_summary_shell_handles_traditional_chinese_topics() -> None:
    job = _make_job()
    job.transcript_source_text = (
        "我們確定了產品發布時間。"
        "安排下週進行團隊培訓。"
    )

    result = generate_public_video_summary_shell(job)

    assert result.source_text == "录音确认了产品发布时间，并安排了团队培训。"
    assert result.source_bullets == [
        "產品發布時間已確認",
        "下週將進行團隊培訓",
    ]


def test_generate_public_video_summary_shell_uses_tighter_copy_for_partial_mode() -> None:
    job = _make_job()
    job.stage = "generating_transcript"
    job.summary_mode = "partial"
    job.transcript_source_text = (
        "VPN太贵用不起。"
        "机场不稳定会跑路。"
        "本系列视频将你从零开始搭建属于自己的翻墙节点。"
        "后面还会继续讲VPS和面板。"
    )

    result = generate_public_video_summary_shell(job)

    assert result.source_text == (
        "当前重点包括：VPN太贵用不起；机场不稳定会跑路；本系列视频将你从零开始搭建属于自己的翻墙节点。"
    )
    assert result.preview_text == result.source_text
    assert result.source_bullets == [
        "VPN太贵用不起",
        "机场不稳定会跑路",
    ]


def test_generate_public_video_summary_shell_requires_transcript_preview() -> None:
    job = _make_job(transcript_preview_text=None)
    job.transcript_source_text = None

    with pytest.raises(PublicVideoSummaryShellError) as exc_info:
        generate_public_video_summary_shell(job)

    assert exc_info.value.reason == "missing_transcript_preview"


def test_generate_public_video_summary_shell_requires_ready_transcript() -> None:
    job = _make_job()
    job.transcript_status = "failed"

    with pytest.raises(PublicVideoSummaryShellError) as exc_info:
        generate_public_video_summary_shell(job)

    assert exc_info.value.reason == "transcript_not_ready"
