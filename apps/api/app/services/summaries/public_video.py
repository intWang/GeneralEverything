from __future__ import annotations

import json
from dataclasses import dataclass
import re
from typing import Callable


@dataclass(slots=True)
class PublicVideoSummaryShell:
    status: str
    stage: str
    source_text: str | None
    source_bullets: list[str] | None
    preview_text: str | None
    key_points_count: int | None

    def model_dump(self) -> dict[str, str | int | None]:
        return {
            "status": self.status,
            "stage": self.stage,
            "source_text": self.source_text,
            "source_bullets": self.source_bullets,
            "preview_text": self.preview_text,
            "key_points_count": self.key_points_count,
        }

    def source_bullets_json(self) -> str | None:
        if self.source_bullets is None:
            return None

        return json.dumps(self.source_bullets, ensure_ascii=False)


class PublicVideoSummaryShellError(RuntimeError):
    def __init__(self, reason: str, message: str) -> None:
        super().__init__(message)
        self.reason = reason
        self.message = message


_SALUTATION_PATTERN = re.compile(
    r"^(大家好|hello everyone|hi everyone|欢迎来到今天的会议|歡迎來到今天的會議)$",
    flags=re.IGNORECASE,
)
_LEADING_FILLER_PATTERN = re.compile(
    r"^(今天|今日|本次(?:录音|錄音|会议|會議)?(?:中)?|在今天的会议中|在今天的會議中|"
    r"在本次(?:会议|會議|录音|錄音)中|随后|之後|之后|最後|最后|另外|此外|并且|並且|并|並)\s*"
)
_TOPIC_HINTS = (
    (
        ("客户名单", "名单", "销售", "同步", "customer list", "sales", "client sync"),
        "发布前客户同步",
        "customer coordination",
    ),
    (("培训", "培訓", "training", "enablement", "materials"), "培训准备", "training preparation"),
    (("发布", "發布", "上线", "上線", "release", "launch"), "发布时间", "release timing"),
    (("行动项", "后续", "follow-up", "next step", "action"), "后续安排", "follow-up actions"),
)
def _normalize_summary_clause(clause: str) -> str:
    normalized = " ".join(clause.split()).strip().strip("。！？.!?;；,，")
    normalized = _LEADING_FILLER_PATTERN.sub("", normalized).strip()

    return normalized


def _extract_summary_points(transcript_text: str) -> list[str]:
    sentence_candidates = [
        sentence.strip()
        for sentence in re.split(r"(?<=[。！？.!?])\s*|\n+", transcript_text)
        if sentence.strip()
    ]

    point_candidates: list[str] = []
    for sentence in sentence_candidates:
        clauses = [
            _normalize_summary_clause(clause)
            for clause in re.split(r"[，,；;]", sentence)
        ]
        for clause in clauses:
            if not clause or _SALUTATION_PATTERN.match(clause):
                continue
            if clause not in point_candidates:
                point_candidates.append(clause)
            if len(point_candidates) == 4:
                return point_candidates

    if point_candidates:
        return point_candidates

    normalized = _normalize_summary_clause(transcript_text)
    if not normalized:
        return []

    if len(normalized) <= 180:
        return [normalized]

    return [f"{normalized[:177].rstrip()}..."]


def _is_cjk_text(text: str) -> bool:
    cjk_character_count = sum(1 for character in text if "\u4e00" <= character <= "\u9fff")
    return cjk_character_count >= max(2, len(text) // 12)


def _derive_summary_topics(summary_points: list[str], *, locale: str) -> list[str]:
    topics: list[str] = []
    for point in summary_points:
        lowered_point = point.lower()
        for keywords, chinese_label, english_label in _TOPIC_HINTS:
            if any(keyword in point or keyword in lowered_point for keyword in keywords):
                label = chinese_label if locale == "zh" else english_label
                if label not in topics:
                    topics.append(label)
                break
        if len(topics) == 3:
            break

    return topics


def _derive_chinese_summary_phrases(
    summary_points: list[str],
    topics: list[str],
) -> list[str]:
    topic_phrases: list[str] = []
    for topic in topics:
        if topic == "发布时间":
            topic_phrases.append("产品发布时间")
            continue

        if topic == "培训准备":
            matching_point = next(
                (point for point in summary_points if "培训" in point or "培訓" in point),
                "",
            )
            if any(keyword in matching_point for keyword in ("材料", "准备", "準備")):
                topic_phrases.append("培训准备")
            else:
                topic_phrases.append("团队培训")
            continue

        if topic == "发布前客户同步":
            topic_phrases.append("客户同步")
            continue

        topic_phrases.append(topic)

    return topic_phrases


def _polish_chinese_summary_point(summary_point: str) -> str:
    if "客户名单" in summary_point or "客戶名單" in summary_point or "同步客户名单" in summary_point:
        return "销售团队将在发布前同步客户名单" if "销售" in summary_point else "客戶名單將在發布前同步"

    if "发布" in summary_point or "發布" in summary_point:
        week_match = re.search(r"(下周|下週|本周|本週)", summary_point)
        if week_match:
            prefix = "產品發布時間已確認" if "產品" in summary_point else "产品发布时间已确认"
            return f"{prefix}在{week_match.group(1)}"
        if "產品" in summary_point:
            return "產品發布時間已確認"
        return "产品发布时间已确认"

    if "培训材料" in summary_point or "培訓材料" in summary_point:
        deadline_match = re.search(r"(周[一二三四五六日天]|星期[一二三四五六日天]|下周|下週|本周|本週)前", summary_point)
        subject_match = re.match(r"(.+?团队|.+?團隊)", summary_point)
        subject = subject_match.group(1) if subject_match else ""
        prepared_text = "完成培訓材料準備" if "培訓" in summary_point else "完成培训材料准备"
        if deadline_match and subject:
            return f"{subject}将在{deadline_match.group(1)}前{prepared_text}"
        if subject:
            return f"{subject}{'將' if '團隊' in subject else '将'}{prepared_text}"
        return "培训材料准备已安排"

    if "培训" in summary_point or "培訓" in summary_point:
        week_match = re.search(r"(下周|下週|本周|本週)", summary_point)
        if week_match:
            return f"{week_match.group(1)}將進行團隊培訓" if "培訓" in summary_point else f"{week_match.group(1)}将进行团队培训"
        return "团队培训已安排"

    return summary_point


def _polish_summary_points(summary_points: list[str]) -> list[str]:
    if not summary_points:
        return []

    if _is_cjk_text(" ".join(summary_points)):
        return [_polish_chinese_summary_point(point) for point in summary_points]

    return summary_points


def _build_summary_text(summary_points: list[str]) -> str | None:
    if not summary_points:
        return None

    locale = "zh" if _is_cjk_text(" ".join(summary_points)) else "en"
    topics = _derive_summary_topics(summary_points, locale=locale)

    if locale == "zh":
        topic_phrases = _derive_chinese_summary_phrases(summary_points, topics)
        if len(topic_phrases) == 1:
            return f"录音聚焦在{topic_phrases[0]}。"
        if len(topic_phrases) == 2:
            return f"录音确认了{topic_phrases[0]}，并安排了{topic_phrases[1]}。"
        if len(topic_phrases) >= 3:
            return f"录音确认了{topic_phrases[0]}，并安排了{topic_phrases[1]}和{topic_phrases[2]}。"
        return f"本次录音主要确认了以下事项：{'；'.join(summary_points)}。"

    if len(topics) == 1:
        return f"The recording mainly focused on {topics[0]}."
    if len(topics) == 2:
        return f"The recording confirmed {topics[0]} and outlined {topics[1]}."
    if len(topics) >= 3:
        return (
            f"The recording confirmed {topics[0]} and outlined "
            f"{topics[1]} plus {topics[2]}."
        )

    return f"The recording focused on these takeaways: {'; '.join(summary_points)}."


def _build_partial_summary_text(summary_points: list[str]) -> str | None:
    if not summary_points:
        return None

    locale = "zh" if _is_cjk_text(" ".join(summary_points)) else "en"
    visible_points = summary_points[:3]

    if locale == "zh":
        if len(visible_points) == 1:
            return f"当前重点：{visible_points[0]}。"
        return f"当前重点包括：{'；'.join(visible_points)}。"

    if len(visible_points) == 1:
        return f"Current focus: {visible_points[0]}."

    return f"Current takeaways include: {'; '.join(visible_points)}."


def generate_public_video_summary_shell(
    job: object,
    summarizer: Callable[[str], PublicVideoSummaryShell] | None = None,
) -> PublicVideoSummaryShell:
    transcript_status = getattr(job, "transcript_status", None)
    if transcript_status and transcript_status != "ready":
        raise PublicVideoSummaryShellError(
            "transcript_not_ready",
            "The transcript shell is not ready for summary generation.",
        )

    transcript_source_text = getattr(job, "transcript_source_text", None)
    transcript_preview_text = getattr(job, "transcript_preview_text", None)
    transcript_text = transcript_source_text or transcript_preview_text
    if not transcript_text:
        raise PublicVideoSummaryShellError(
            "missing_transcript_preview",
            "The job does not have transcript preview text for summary generation.",
        )

    if summarizer is not None:
        return summarizer(transcript_text)

    summary_points = _extract_summary_points(transcript_text)
    polished_summary_points = _polish_summary_points(summary_points)
    summary_mode = getattr(job, "summary_mode", None)
    if summary_mode == "partial":
        summary_text = _build_partial_summary_text(polished_summary_points)
        polished_summary_points = polished_summary_points[:2]
    else:
        summary_text = _build_summary_text(summary_points)

    return PublicVideoSummaryShell(
        status="ready",
        stage="summary_generated",
        source_text=summary_text,
        source_bullets=polished_summary_points or None,
        preview_text=summary_text,
        key_points_count=len(polished_summary_points) or None,
    )
