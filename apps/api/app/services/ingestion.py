from urllib.parse import urlparse


def detect_source_type(url: str) -> str:
    host = urlparse(url).hostname or ""
    if host.endswith("rclabenv.com") or "ringcentral" in host:
        return "ringcentral_recording"
    return "public_video"
