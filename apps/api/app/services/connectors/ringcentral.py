from urllib.parse import urlparse

from app.services.ingestion import RINGCENTRAL_HOST_SUFFIXES


def is_ringcentral_recording_url(url: str) -> bool:
    parsed_url = urlparse(url)
    host = parsed_url.hostname or ""
    is_ringcentral_host = host == "ringcentral.com" or host.endswith(
        RINGCENTRAL_HOST_SUFFIXES
    )
    return is_ringcentral_host and parsed_url.path.startswith("/recordings")
