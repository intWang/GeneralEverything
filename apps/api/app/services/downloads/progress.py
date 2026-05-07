from typing import Literal

from pydantic import BaseModel, Field


DownloadProgressStatus = Literal["queued", "probing", "downloading", "ready", "failed"]
DownloadAssetKind = Literal["video", "audio", "subtitle", "thumbnail", "report"]


class DownloadProgress(BaseModel):
    status: DownloadProgressStatus
    percent: int | None = Field(default=None, ge=0, le=100)
    downloaded_bytes: int | None = Field(default=None, ge=0)
    total_bytes: int | None = Field(default=None, ge=0)
    speed_bytes_per_second: int | None = Field(default=None, ge=0)
    eta_seconds: int | None = Field(default=None, ge=0)


class DownloadFormatChoice(BaseModel):
    format_id: str
    format_label: str
    resolution: str | None = None
    container: str | None = None
    kind: DownloadAssetKind


class DownloadDiagnostic(BaseModel):
    reason: str
    stage: str
    message: str
    suggestion: str
