from app.models import JobStatus
from app.services.qa_pipeline import _build_reference, describe_qa_shell, qa_is_ready


def test_qa_requires_three_or_more_grounded_chunks() -> None:
    assert qa_is_ready(2, "ready", "ready") is False
    assert qa_is_ready(3, "ready", "ready") is True


def test_qa_requires_ready_summary_and_mindmap_shells() -> None:
    assert qa_is_ready(3, "failed", "ready") is False
    assert qa_is_ready(3, "ready", "failed") is False
    assert qa_is_ready(3, "ready", "ready") is True


def test_qa_shell_waits_for_grounding_while_job_is_queued() -> None:
    shell = describe_qa_shell(JobStatus.QUEUED, "queued")

    assert shell.state == "queued"
    assert shell.grounding_status == "waiting_for_grounding"
    assert shell.answer_placeholder == "pending"
    assert shell.can_submit is False


def test_qa_shell_stays_queued_during_transcript_stage() -> None:
    shell = describe_qa_shell(JobStatus.RUNNING, "generating_transcript")

    assert shell.state == "queued"
    assert shell.grounding_status == "waiting_for_grounding"
    assert shell.answer_placeholder == "pending"
    assert shell.can_submit is False


def test_qa_shell_enters_grounding_mode_after_transcript_stage() -> None:
    shell = describe_qa_shell(JobStatus.RUNNING, "building_summary")

    assert shell.state == "processing"
    assert shell.grounding_status == "stabilizing_grounding"
    assert shell.answer_placeholder == "preparing"
    assert shell.can_submit is False


def test_qa_shell_unlocks_after_grounding_threshold_is_met() -> None:
    shell = describe_qa_shell(
        JobStatus.RUNNING,
        "mindmap_generated",
        transcript_segment_count=3,
        summary_status="ready",
        mindmap_status="ready",
    )

    assert shell.state == "complete"
    assert shell.grounding_status == "grounded"
    assert shell.answer_placeholder == "awaiting_question"
    assert shell.can_submit is True


def test_qa_shell_is_ready_after_completed_job() -> None:
    shell = describe_qa_shell(JobStatus.COMPLETED, "building_mindmap")

    assert shell.state == "complete"
    assert shell.grounding_status == "grounded"
    assert shell.answer_placeholder == "awaiting_question"
    assert shell.can_submit is True


def test_qa_shell_blocks_failed_jobs() -> None:
    shell = describe_qa_shell(JobStatus.FAILED, "building_summary")

    assert shell.state == "failed"
    assert shell.grounding_status == "unavailable"
    assert shell.answer_placeholder == "blocked"
    assert shell.can_submit is False


def test_build_reference_truncates_long_preview_text() -> None:
    preview_text = (
        "Transcript shell generated for sample.wav. It captures a longer "
        "explanation so Ask AI references stay compact in the workspace."
    )

    assert _build_reference("Transcript", preview_text) == (
        "Transcript: Transcript shell generated for sample.wav. "
        "It captures a longer expla..."
    )


def test_build_reference_keeps_exact_threshold_without_ellipsis() -> None:
    preview_text = "x" * 72

    assert _build_reference("Transcript", preview_text) == f"Transcript: {preview_text}"


def test_build_reference_falls_back_when_preview_is_whitespace() -> None:
    assert _build_reference("Summary", "   \n\t  ") == "Summary: shell preview unavailable"
