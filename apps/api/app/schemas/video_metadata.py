from typing import Optional

from pydantic import BaseModel


class VideoMetadata(BaseModel):
    title: str
    duration_seconds: Optional[int]
    thumbnail_url: Optional[str]
    source_name: Optional[str]
    description: Optional[str]
