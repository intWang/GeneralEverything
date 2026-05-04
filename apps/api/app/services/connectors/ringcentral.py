from urllib.parse import urlparse


def is_ringcentral_recording_url(url: str) -> bool:
    host = urlparse(url).hostname or ""
    return host.endswith("rclabenv.com") or "ringcentral" in host
