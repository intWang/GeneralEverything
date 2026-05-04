from pydantic import BaseModel


class VideoMetadata(BaseModel):
    title: str
    duration_seconds: int | None
    thumbnail_url: str | None
    source_name: str | None
    description: str | None
