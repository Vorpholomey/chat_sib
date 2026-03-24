"""Public user list item for sidebar."""

from pydantic import BaseModel, Field


class UserListItem(BaseModel):
    id: int
    username: str
    online: bool = Field(description="Whether user has an active WebSocket connection")
