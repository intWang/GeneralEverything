from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
import json
from pathlib import Path
import shutil
import subprocess
from typing import Callable

from app.config import settings
from app.services.translations.languages import LANGUAGE_NAME_BY_CODE


DEFAULT_TRANSCRIPT_ROOT = Path("var/transcripts/public-video")


@dataclass(slots=True)
class PublicVideoTranscriptShell:
    status: str
    stage: str
    extractor: str
    audio_artifact_path: str | None

    def model_dump(self) -> dict[str, str | None]:
        return {
            "status": self.status,
            "stage": self.stage,
            "extractor": self.extractor,
            "audio_artifact_path": self.audio_artifact_path,
        }


@dataclass(slots=True)
class PublicVideoTranscriptResult:
    status: str
    stage: str
    detected_language_code: str | None
    detected_language_name: str | None
    source_text: str | None
    source_segments: list[dict[str, float | str]] | None
    preview_text: str | None
    segment_count: int | None

    def model_dump(self) -> dict[str, str | int | None]:
        return {
            "status": self.status,
            "stage": self.stage,
            "detected_language_code": self.detected_language_code,
            "detected_language_name": self.detected_language_name,
            "source_text": self.source_text,
            "source_segments": self.source_segments,
            "preview_text": self.preview_text,
            "segment_count": self.segment_count,
        }

    def source_segments_json(self) -> str | None:
        if self.source_segments is None:
            return None

        return json.dumps(self.source_segments, ensure_ascii=False)


class PublicVideoTranscriptShellError(RuntimeError):
    def __init__(self, reason: str, message: str) -> None:
        super().__init__(message)
        self.reason = reason
        self.message = message


class PublicVideoTranscriptExecutionError(RuntimeError):
    def __init__(self, reason: str, message: str) -> None:
        super().__init__(message)
        self.reason = reason
        self.message = message


def _build_preview_text(source_text: str | None, audio_artifact_path: str) -> str:
    if source_text:
        normalized = " ".join(source_text.split())
        if len(normalized) <= 280:
            return normalized

        return f"{normalized[:277].rstrip()}..."

    return (
        f"Transcript shell generated for {Path(audio_artifact_path).name}. "
        "Speech recognition did not return stable text."
    )


def _language_name_for_code(language_code: str | None) -> str | None:
    if not language_code:
        return None

    if language_code in LANGUAGE_NAME_BY_CODE:
        return LANGUAGE_NAME_BY_CODE[language_code]

    primary_code = language_code.split("-")[0]
    if primary_code in LANGUAGE_NAME_BY_CODE:
        return LANGUAGE_NAME_BY_CODE[primary_code]

    return language_code


def _load_imageio_ffmpeg_command() -> str | None:
    try:
        import imageio_ffmpeg
    except ImportError:
        return None

    try:
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return None


def _resolve_ffmpeg_command() -> str:
    system_ffmpeg = shutil.which("ffmpeg")
    if system_ffmpeg:
        return system_ffmpeg

    bundled_ffmpeg = _load_imageio_ffmpeg_command()
    if bundled_ffmpeg:
        return bundled_ffmpeg

    return "ffmpeg"


@lru_cache(maxsize=1)
def _load_faster_whisper_model():
    from faster_whisper import WhisperModel

    return WhisperModel(
        settings.transcript_model_name,
        device=settings.transcript_device,
        compute_type=settings.transcript_compute_type,
    )


def transcribe_public_video_audio(audio_artifact_path: str) -> PublicVideoTranscriptResult:
    return transcribe_public_video_audio_streaming(audio_artifact_path)


def transcribe_public_video_audio_streaming(
    audio_artifact_path: str,
    on_segment: Callable[[dict[str, object]], None] | None = None,
) -> PublicVideoTranscriptResult:
    model = _load_faster_whisper_model()
    segments, info = model.transcribe(
        audio_artifact_path,
        beam_size=settings.transcript_beam_size,
        vad_filter=settings.transcript_enable_vad,
    )

    source_segments: list[dict[str, float | str]] = []
    source_lines: list[str] = []
    detected_language_code = getattr(info, "language", None) or "und"
    detected_language_name = _language_name_for_code(detected_language_code) or "Unknown"

    for segment in segments:
        text = (getattr(segment, "text", "") or "").strip()
        if not text:
            continue

        source_segments.append(
            {
                "start": round(float(getattr(segment, "start", 0.0)), 2),
                "end": round(float(getattr(segment, "end", 0.0)), 2),
                "text": text,
            }
        )
        source_lines.append(text)
        if on_segment is not None:
            source_text = "\n".join(source_lines)
            on_segment(
                {
                    "detected_language_code": detected_language_code,
                    "detected_language_name": detected_language_name,
                    "preview_text": _build_preview_text(source_text, audio_artifact_path),
                    "segment_count": len(source_segments),
                    "source_segments": list(source_segments),
                    "source_text": source_text,
                },
            )

    source_text = "\n".join(source_lines) if source_lines else None

    return PublicVideoTranscriptResult(
        status="ready",
        stage="transcript_generated",
        detected_language_code=detected_language_code,
        detected_language_name=detected_language_name,
        source_text=source_text,
        source_segments=source_segments or None,
        preview_text=_build_preview_text(source_text, audio_artifact_path),
        segment_count=len(source_segments),
    )


def prepare_public_video_transcript_shell(
    job: object,
    ffmpeg_command: str | None = None,
    transcript_root: Path | None = None,
    run_command: Callable[..., subprocess.CompletedProcess[str]] | None = None,
) -> PublicVideoTranscriptShell:
    download_status = getattr(job, "download_status", None)
    if download_status and download_status != "ready":
        raise PublicVideoTranscriptShellError(
            "download_not_ready",
            "The job download is not ready for transcript preparation.",
        )

    download_artifact_path = getattr(job, "download_artifact_path", None)
    if not download_artifact_path:
        raise PublicVideoTranscriptShellError(
            "missing_download_artifact",
            "The job does not have a downloaded video artifact to prepare for transcript extraction.",
        )

    job_id = str(getattr(job, "id", "unknown"))
    root = transcript_root or DEFAULT_TRANSCRIPT_ROOT
    audio_artifact_path = root / f"{job_id}.wav"
    audio_artifact_path.parent.mkdir(parents=True, exist_ok=True)

    command = [
        ffmpeg_command or _resolve_ffmpeg_command(),
        "-y",
        "-i",
        str(download_artifact_path),
        "-vn",
        "-acodec",
        "pcm_s16le",
        "-ar",
        "16000",
        "-ac",
        "1",
        str(audio_artifact_path),
    ]

    runner = run_command or subprocess.run
    try:
        result = runner(
            command,
            check=False,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError as exc:
        raise PublicVideoTranscriptShellError(
            "tool_missing",
            "ffmpeg is not installed or not available on PATH.",
        ) from exc
    except OSError as exc:
        raise PublicVideoTranscriptShellError(
            "extraction_unavailable",
            f"Unable to start ffmpeg audio extraction: {exc}",
        ) from exc

    if result.returncode != 0:
        message = (result.stderr or result.stdout or "ffmpeg failed to extract audio.").strip()
        raise PublicVideoTranscriptShellError("extraction_failed", message)

    return PublicVideoTranscriptShell(
        status="ready",
        stage="transcript_ready",
        extractor="ffmpeg",
        audio_artifact_path=str(audio_artifact_path),
    )


def execute_public_video_transcript_shell(
    job: object,
    runner: Callable[[object], PublicVideoTranscriptResult] | None = None,
    transcriber: Callable[[str], PublicVideoTranscriptResult] | None = None,
    on_segment: Callable[[dict[str, object]], None] | None = None,
) -> PublicVideoTranscriptResult:
    transcript_status = getattr(job, "transcript_status", None)
    if transcript_status and transcript_status not in {"ready", "processing"}:
        raise PublicVideoTranscriptExecutionError(
            "transcript_not_ready",
            "The transcript shell is not ready for transcript generation.",
        )

    audio_artifact_path = getattr(job, "transcript_audio_artifact_path", None)
    if not audio_artifact_path:
        raise PublicVideoTranscriptExecutionError(
            "missing_audio_artifact",
            "The job does not have an extracted audio artifact for transcript generation.",
        )

    if runner is not None:
        try:
            return runner(job)
        except OSError as exc:
            raise PublicVideoTranscriptExecutionError(
                "transcript_unavailable",
                f"Unable to start transcript generation: {exc}",
            ) from exc

    transcript_runner = transcriber or transcribe_public_video_audio
    try:
        if transcriber is not None:
            return transcript_runner(str(audio_artifact_path))

        return transcribe_public_video_audio_streaming(
            str(audio_artifact_path),
            on_segment=on_segment,
        )
    except ImportError as exc:
        raise PublicVideoTranscriptExecutionError(
            "transcript_unavailable",
            "faster-whisper is not installed or available in the current environment.",
        ) from exc
    except FileNotFoundError as exc:
        raise PublicVideoTranscriptExecutionError(
            "transcript_unavailable",
            f"Unable to read the extracted audio artifact: {exc}",
        ) from exc
    except OSError as exc:
        raise PublicVideoTranscriptExecutionError(
            "transcript_unavailable",
            f"Unable to start transcript generation: {exc}",
        ) from exc
