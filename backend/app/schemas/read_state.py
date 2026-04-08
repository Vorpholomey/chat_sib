"""Read-state (last read message id) API DTOs."""

from typing import Optional

from pydantic import BaseModel, Field


class ReadStateResponse(BaseModel):
    last_read_message_id: Optional[int] = None


class PatchGlobalReadStateBody(BaseModel):
    last_read_message_id: int = Field(..., ge=1)


class PatchPrivateReadStateBody(BaseModel):
    peer_id: int = Field(..., ge=1)
    last_read_message_id: int = Field(..., ge=1)
