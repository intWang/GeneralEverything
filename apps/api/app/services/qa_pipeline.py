from dataclasses import dataclass
from typing import Literal

from app.models import AnalysisJob, JobStatus


QAShellState = Literal["queued", "processing", "complete", "failed"]
GroundingStatus = str
AnswerPlaceholderState = str


@dataclass(frozen=True)
class QAPipelineShell:
    state: QAShellState
    grounding_status: GroundingStatus
    answer_placeholder: AnswerPlaceholderState
    can_submit: bool


@dataclass(frozen=True)
class QAAnswerShell:
    answer: str
    grounded: bool
    question: str
    references: tuple[str, ...]


class QAAnswerNotReadyError(RuntimeError):
    pass


def _build_reference(label: str, preview_text: str | None) -> str:
    if preview_text:
        return f"{label}: {preview_text.strip()}"

    return f"{label}: shell preview unavailable"


def qa_is_ready(
    transcript_segment_count: int | None,
    summary_status: str | None,
    mindmap_status: str | None,
) -> bool:
    return (
        (transcript_segment_count or 0) >= 3
        and summary_status == "ready"
        and mindmap_status == "ready"
    )


def describe_qa_shell(
    status: JobStatus,
    stage: str,
    *,
    transcript_segment_count: int | None = None,
    summary_status: str | None = None,
    mindmap_status: str | None = None,
) -> QAPipelineShell:
    if status is JobStatus.COMPLETED:
        return QAPipelineShell(
            state="complete",
            grounding_status="grounded",
            answer_placeholder="awaiting_question",
            can_submit=True,
        )

    if status is JobStatus.FAILED:
        return QAPipelineShell(
            state="failed",
            grounding_status="unavailable",
            answer_placeholder="blocked",
            can_submit=False,
        )

    if qa_is_ready(transcript_segment_count, summary_status, mindmap_status):
        return QAPipelineShell(
            state="complete",
            grounding_status="grounded",
            answer_placeholder="awaiting_question",
            can_submit=True,
        )

    if status is JobStatus.RUNNING:
        if "transcript" in stage:
            return QAPipelineShell(
                state="queued",
                grounding_status="waiting_for_grounding",
                answer_placeholder="pending",
                can_submit=False,
            )

        return QAPipelineShell(
            state="processing",
            grounding_status="stabilizing_grounding",
            answer_placeholder="preparing",
            can_submit=False,
        )

    return QAPipelineShell(
        state="queued",
        grounding_status="waiting_for_grounding",
        answer_placeholder="pending",
        can_submit=False,
    )


def describe_job_qa_shell(job: AnalysisJob) -> QAPipelineShell:
    return describe_qa_shell(
        job.status,
        job.stage,
        transcript_segment_count=job.transcript_segment_count,
        summary_status=job.summary_status,
        mindmap_status=job.mindmap_status,
    )


def answer_job_question(job: AnalysisJob, question: str) -> QAAnswerShell:
    if not qa_is_ready(
        job.transcript_segment_count,
        job.summary_status,
        job.mindmap_status,
    ):
        raise QAAnswerNotReadyError("Ask AI is not ready for grounded questions yet")

    normalized_question = question.strip()
    return QAAnswerShell(
        answer=(
            f'Grounded answer shell for "{normalized_question}" based on the '
            "transcript, summary, and mind map shells currently available."
        ),
        grounded=True,
        question=normalized_question,
        references=(
            _build_reference("Transcript", job.transcript_preview_text),
            _build_reference("Summary", job.summary_preview_text),
            _build_reference("Mind map", job.mindmap_preview_text),
        ),
    )
