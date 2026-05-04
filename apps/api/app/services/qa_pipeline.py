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


def describe_qa_shell(status: JobStatus, stage: str) -> QAPipelineShell:
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
    return describe_qa_shell(job.status, job.stage)
