"""Upload response schema."""

from pydantic import BaseModel


class UploadResponse(BaseModel):
    url: str
