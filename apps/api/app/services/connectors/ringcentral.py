from urllib.parse import parse_qsl, urlencode, urlparse, urlsplit, urlunsplit

from app.services.ingestion import RINGCENTRAL_HOST_SUFFIXES
from app.services.downloads.progress import DownloadDiagnostic


SENSITIVE_RINGCENTRAL_QUERY_KEYS = {"access_token", "auth", "code", "jwt", "token"}


def is_ringcentral_recording_url(url: str) -> bool:
    parsed_url = urlparse(url)
    host = parsed_url.hostname or ""
    is_ringcentral_host = host == "ringcentral.com" or host.endswith(
        RINGCENTRAL_HOST_SUFFIXES
    )
    return is_ringcentral_host and parsed_url.path.startswith("/recordings")


def sanitize_ringcentral_url(source_url: str) -> str:
    parsed_url = urlsplit(source_url)
    safe_query = urlencode(
        [
            (key, value)
            for key, value in parse_qsl(parsed_url.query, keep_blank_values=True)
            if key.lower() not in SENSITIVE_RINGCENTRAL_QUERY_KEYS
        ]
    )
    return urlunsplit(
        (
            parsed_url.scheme,
            parsed_url.netloc,
            parsed_url.path,
            safe_query,
            parsed_url.fragment,
        )
    )


class RingCentralProbeError(Exception):
    def __init__(self, reason: str, message: str) -> None:
        super().__init__(message)
        self.reason = reason
        self.message = message

    def diagnostic(self) -> DownloadDiagnostic:
        return DownloadDiagnostic(
            reason=self.reason,
            stage="metadata_probe",
            message=self.message,
            suggestion=(
                "Open the recording in your browser, confirm access, then retry "
                "with a fresh shared link."
            ),
        )
