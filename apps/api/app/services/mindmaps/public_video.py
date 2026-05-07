from __future__ import annotations

from dataclasses import dataclass
import json


@dataclass(slots=True)
class PublicVideoMindMapShell:
    status: str
    stage: str
    preview_text: str | None
    node_count: int | None
    nodes: dict | None = None

    def model_dump(self) -> dict[str, str | int | dict | None]:
        payload: dict[str, str | int | dict | None] = {
            "status": self.status,
            "stage": self.stage,
            "preview_text": self.preview_text,
            "node_count": self.node_count,
        }
        if self.nodes is not None:
            payload["mindmap_nodes"] = self.nodes

        return payload

    def mindmap_nodes_json(self) -> str | None:
        if self.nodes is None:
            return None

        return json.dumps(self.nodes, ensure_ascii=False)


class PublicVideoMindMapShellError(RuntimeError):
    def __init__(self, reason: str, message: str) -> None:
        super().__init__(message)
        self.reason = reason
        self.message = message


def _mindmap_reference_from_citation(citation: dict) -> dict:
    return {
        "segment_id": citation.get("segment_id"),
        "start_seconds": citation.get("start_seconds"),
        "end_seconds": citation.get("end_seconds"),
        "label": citation.get("label"),
    }


def _count_nodes(node: dict | None) -> int:
    if not node:
        return 0

    return 1 + sum(_count_nodes(child) for child in node.get("children", []))


def _build_nodes_from_structured_summary(structured_summary: dict | None) -> dict | None:
    if not structured_summary:
        return None

    abstract = structured_summary.get("abstract")
    if not isinstance(abstract, str) or not abstract:
        return None

    citations_by_id = {
        citation["id"]: citation
        for citation in structured_summary.get("citations", [])
        if isinstance(citation, dict) and isinstance(citation.get("id"), str)
    }
    children: list[dict] = []
    for index, item in enumerate(structured_summary.get("key_points", []), start=1):
        if not isinstance(item, dict) or not isinstance(item.get("text"), str):
            continue

        references = [
            _mindmap_reference_from_citation(citations_by_id[citation_id])
            for citation_id in item.get("citation_ids", [])
            if citation_id in citations_by_id
        ]
        children.append(
            {
                "id": f"mindmap-key-point-{index}",
                "label": item["text"],
                "children": [],
                "references": references,
            }
        )

    return {
        "id": "mindmap-root",
        "label": abstract,
        "summary": abstract,
        "children": children,
        "references": [],
    }


def _build_nodes_from_preview(preview_text: str) -> dict:
    branches = [
        branch.strip()
        for branch in preview_text.split(",")
        if branch.strip()
    ][:6]

    return {
        "id": "mindmap-root",
        "label": "AI analysis",
        "summary": preview_text,
        "children": [
            {
                "id": f"mindmap-preview-{index}",
                "label": branch,
                "children": [],
                "references": [],
            }
            for index, branch in enumerate(branches, start=1)
        ],
        "references": [],
    }


def generate_public_video_mindmap_shell(job: object) -> PublicVideoMindMapShell:
    summary_status = getattr(job, "summary_status", None)
    if summary_status and summary_status != "ready":
        raise PublicVideoMindMapShellError(
            "summary_not_ready",
            "The summary shell is not ready for mind map generation.",
        )

    summary_preview_text = getattr(job, "summary_preview_text", None)
    if not summary_preview_text:
        raise PublicVideoMindMapShellError(
            "missing_summary_preview",
            "The job does not have summary preview text for mind map generation.",
        )

    key_points_count = getattr(job, "summary_key_points_count", None) or 1
    preview_text = f"Mind map shell generated from summary preview: {summary_preview_text}"
    nodes = _build_nodes_from_structured_summary(getattr(job, "summary_structured", None))
    if nodes is None:
        nodes = _build_nodes_from_preview(summary_preview_text)

    return PublicVideoMindMapShell(
        status="ready",
        stage="mindmap_generated",
        preview_text=preview_text,
        node_count=max(_count_nodes(nodes), int(key_points_count), 1),
        nodes=nodes,
    )
