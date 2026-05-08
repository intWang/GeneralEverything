from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path
import re
import subprocess

from app.services.connectors.ringcentral import sanitize_ringcentral_url
from app.services.downloads.progress import DownloadDiagnostic, DownloadFormatChoice
from app.services.downloads.public_video import (
    PublicVideoDownloadShell,
    _extract_downloaded_path,
    _resolve_yt_dlp_command,
)


DEFAULT_RINGCENTRAL_DOWNLOAD_ROOT = Path("var/downloads/ringcentral")


@dataclass(frozen=True, slots=True)
class RingCentralDownloadAuth:
    cookie_file: str | None = None
    cookies_from_browser: str | None = None

    @classmethod
    def from_mapping(cls, value: object) -> "RingCentralDownloadAuth":
        if isinstance(value, RingCentralDownloadAuth):
            return value

        if not isinstance(value, dict):
            return cls()

        cookie_file = value.get("cookie_file")
        cookies_from_browser = value.get("cookies_from_browser")
        return cls(
            cookie_file=cookie_file if isinstance(cookie_file, str) else None,
            cookies_from_browser=(
                cookies_from_browser if isinstance(cookies_from_browser, str) else None
            ),
        )

    def has_context(self) -> bool:
        return bool(self.cookie_file or self.cookies_from_browser)


class RingCentralDownloadError(RuntimeError):
    def __init__(self, reason: str, message: str) -> None:
        super().__init__(message)
        self.reason = reason
        self.message = message
        self.suggestion = _suggestion_for_reason(reason)

    def diagnostic(self) -> DownloadDiagnostic:
        return DownloadDiagnostic(
            reason=self.reason,
            stage="download",
            message=self.message,
            suggestion=self.suggestion,
        )


def plan_ringcentral_download_shell(
    job: object,
    download_root: Path | None = None,
) -> PublicVideoDownloadShell:
    root = download_root or DEFAULT_RINGCENTRAL_DOWNLOAD_ROOT
    job_id = str(getattr(job, "id", "unknown"))
    output_template = root / f"{job_id}.%(ext)s"
    return PublicVideoDownloadShell(
        status="queued",
        stage="queued_download",
        executor="yt-dlp:ringcentral",
        format_id="best",
        format_label="RingCentral recording stream",
        artifact_path=None,
        available_formats=[
            DownloadFormatChoice(
                format_id="best",
                format_label="RingCentral recording stream",
                resolution="source",
                container=None,
                kind="video",
            )
        ],
        output_template=str(output_template),
    )


def execute_ringcentral_download_shell(
    job: object,
    *,
    auth: RingCentralDownloadAuth | None = None,
    planned: PublicVideoDownloadShell | None = None,
    download_root: Path | None = None,
) -> PublicVideoDownloadShell:
    download_auth = auth or RingCentralDownloadAuth()
    if not download_auth.has_context():
        raise RingCentralDownloadError(
            "ringcentral_auth_required",
            "RingCentral download requires a configured cookie file or browser cookie source.",
        )

    source_url = getattr(job, "source_url", None)
    if not source_url:
        raise RingCentralDownloadError(
            "missing_source_url",
            "The RingCentral job does not have a source URL.",
        )

    shell = planned or plan_ringcentral_download_shell(job, download_root=download_root)
    output_template = (
        shell.output_template
        or shell.artifact_path
        or str(
            (download_root or DEFAULT_RINGCENTRAL_DOWNLOAD_ROOT)
            / f"{getattr(job, 'id', 'unknown')}.%(ext)s"
        )
    )
    output_path = Path(output_template)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    command = [
        *_resolve_yt_dlp_command(),
        "--no-progress",
        "--newline",
        "-f",
        shell.format_id or "best",
        "-o",
        output_template,
        "--print",
        "after_move:filepath",
    ]
    command.extend(_build_auth_arguments(download_auth))
    command.append(sanitize_ringcentral_url(str(source_url)))

    try:
        result = subprocess.run(
            command,
            check=False,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError as exc:
        raise RingCentralDownloadError(
            "tool_missing",
            "yt-dlp is not installed or not available on PATH.",
        ) from exc
    except OSError as exc:
        raise RingCentralDownloadError(
            "download_unavailable",
            f"Unable to start RingCentral download: {_redact_sensitive_text(str(exc))}",
        ) from exc

    if result.returncode != 0:
        message = (
            result.stderr
            or result.stdout
            or "yt-dlp failed to download the RingCentral recording."
        ).strip()
        reason = _classify_failure_reason(message)
        raise RingCentralDownloadError(
            reason,
            _redact_sensitive_text(message),
        )

    final_path = _extract_downloaded_path(result.stdout, output_template)
    if final_path is None:
        raise RingCentralDownloadError(
            "download_artifact_missing",
            "yt-dlp completed but did not report or create a RingCentral recording artifact.",
        )

    return PublicVideoDownloadShell(
        status="ready",
        stage="download_ready",
        executor=shell.executor,
        format_id=shell.format_id,
        format_label=shell.format_label,
        artifact_path=final_path,
        available_formats=[
            format_choice.model_copy(update={"artifact_path": final_path})
            if format_choice.format_id == shell.format_id
            else format_choice
            for format_choice in shell.available_formats
        ],
        output_template=output_template,
    )


def probe_ringcentral_recording_access(
    source_url: str,
    *,
    auth: RingCentralDownloadAuth | None = None,
) -> dict[str, object]:
    download_auth = auth or RingCentralDownloadAuth()
    if not download_auth.has_context():
        error = RingCentralDownloadError(
            "ringcentral_auth_required",
            "RingCentral probe requires a configured cookie file or browser cookie source.",
        )
        return {"ok": False, "diagnostic": error.diagnostic().model_dump()}

    command = [
        *_resolve_yt_dlp_command(),
        "--skip-download",
        "--dump-single-json",
        "--no-playlist",
    ]
    command.extend(_build_auth_arguments(download_auth))
    command.append(sanitize_ringcentral_url(source_url))

    try:
        result = subprocess.run(
            command,
            check=False,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError:
        error = RingCentralDownloadError(
            "tool_missing",
            "yt-dlp is not installed or not available on PATH.",
        )
        return {"ok": False, "diagnostic": error.diagnostic().model_dump()}
    except OSError as exc:
        error = RingCentralDownloadError(
            "download_unavailable",
            f"Unable to start RingCentral probe: {_redact_sensitive_text(str(exc))}",
        )
        return {"ok": False, "diagnostic": error.diagnostic().model_dump()}

    if result.returncode != 0:
        message = (
            result.stderr
            or result.stdout
            or "yt-dlp failed to probe the RingCentral recording."
        ).strip()
        error = RingCentralDownloadError(
            _classify_failure_reason(message),
            _redact_sensitive_text(message),
        )
        return {"ok": False, "diagnostic": error.diagnostic().model_dump()}

    metadata = _parse_probe_metadata(result.stdout)
    return {
        "ok": True,
        "title": metadata.get("title"),
        "duration_seconds": metadata.get("duration_seconds"),
    }


def _build_auth_arguments(auth: RingCentralDownloadAuth) -> list[str]:
    if auth.cookie_file:
        return ["--cookies", auth.cookie_file]

    if auth.cookies_from_browser:
        return ["--cookies-from-browser", auth.cookies_from_browser]

    return []


def _redact_sensitive_text(value: str) -> str:
    redacted = value
    for key in ("access_token", "auth", "code", "jwt", "token"):
        redacted = re.sub(
            rf"({key}=)[^&\s]+",
            lambda match: f"{match.group(1)}[redacted]",
            redacted,
            flags=re.IGNORECASE,
        )
    return redacted


def _parse_probe_metadata(stdout: str) -> dict[str, object | None]:
    lines = [line.strip() for line in stdout.splitlines() if line.strip()]
    if not lines:
        return {"title": None, "duration_seconds": None}

    try:
        payload = json.loads(lines[-1])
    except json.JSONDecodeError:
        return {"title": None, "duration_seconds": None}

    title = payload.get("title")
    duration = payload.get("duration")
    return {
        "title": title if isinstance(title, str) else None,
        "duration_seconds": duration if isinstance(duration, int | float) else None,
    }


def _classify_failure_reason(message: str) -> str:
    normalized = message.lower()

    if any(marker in normalized for marker in ("401", "unauthorized", "log in", "login")):
        return "ringcentral_session_expired"

    if any(marker in normalized for marker in ("403", "forbidden", "permission denied")):
        return "ringcentral_permission_denied"

    if any(
        marker in normalized
        for marker in ("404", "not found", "recording unavailable", "recording expired")
    ):
        return "ringcentral_recording_unavailable"

    if any(
        marker in normalized
        for marker in ("unsupported url", "no suitable extractor", "unsupported page")
    ):
        return "ringcentral_unsupported_page"

    return "ringcentral_download_failed"


def _suggestion_for_reason(reason: str) -> str:
    suggestions = {
        "ringcentral_auth_required": (
            "Configure RINGCENTRAL_COOKIE_FILE or RINGCENTRAL_COOKIES_FROM_BROWSER, "
            "confirm the recording opens in that authenticated context, then retry."
        ),
        "ringcentral_session_expired": (
            "Refresh the configured browser session or export a fresh cookie file, "
            "confirm the recording opens, then retry."
        ),
        "ringcentral_permission_denied": (
            "Open the recording in the configured browser/session, confirm your account "
            "has permission, then retry."
        ),
        "ringcentral_recording_unavailable": (
            "Confirm the recording still exists, the link has not expired, and the "
            "recording owner still allows access."
        ),
        "ringcentral_unsupported_page": (
            "Open the URL in a browser and try copying the direct recording playback URL; "
            "if it still fails, capture a sanitized sample for connector support."
        ),
        "tool_missing": "Install yt-dlp in the API runtime, then retry the recording job.",
        "download_artifact_missing": (
            "Retry the job and inspect the API server download directory if the artifact "
            "is still missing."
        ),
        "missing_source_url": "Retry from the original RingCentral recording URL.",
    }
    return suggestions.get(
        reason,
        (
            "Check that the recording opens in the configured authenticated session, "
            "then retry. If it still fails, review the sanitized backend diagnostic."
        ),
    )
