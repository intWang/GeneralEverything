from urllib.parse import urlparse

from app.models import InputMode


RINGCENTRAL_HOST_SUFFIXES = (
    ".ringcentral.com",
    ".rclabenv.com",
)


def detect_source_type(url: str) -> InputMode:
    host = urlparse(url).hostname or ""
    if host == "ringcentral.com" or host.endswith(RINGCENTRAL_HOST_SUFFIXES):
        return InputMode.RINGCENTRAL_RECORDING
    return InputMode.PUBLIC_VIDEO
