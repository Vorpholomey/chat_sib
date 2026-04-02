"""Public user list item for sidebar."""

from pydantic import BaseModel, Field

from app.models.user import UserRole


class UserListItem(BaseModel):
    id: int
    username: str
    role: UserRole
    online: bool = Field(description="Whether user has an active WebSocket connection")
