from pydantic import BaseModel, ConfigDict, HttpUrl

from app.models.job import InputMode, JobStatus


class CreateJobRequest(BaseModel):
    input_mode: InputMode
    source_url: HttpUrl


class JobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    input_mode: str
    source_url: str
    status: str
    stage: str
