"""User Pydantic schemas."""

from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, computed_field, field_validator

from app.models.user import UserRole

_BCRYPT_MAX_PASSWORD_BYTES = 72


class UserBase(BaseModel):
    username: str = Field(..., min_length=1, max_length=64)
    email: EmailStr


class UserCreate(UserBase):
    password: str = Field(..., min_length=6, max_length=128)

    @field_validator("password")
    @classmethod
    def password_max_72_bytes(cls, v: str) -> str:
        # bcrypt only uses the first 72 bytes; reject longer passwords to avoid surprises / 500s.
        if len(v.encode("utf-8")) > _BCRYPT_MAX_PASSWORD_BYTES:
            raise ValueError("Password is too long (max 72 bytes). Use a shorter password.")
        return v


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    is_active: bool
    role: UserRole
    created_at: datetime
    public_ban_until: Optional[datetime] = None
    public_ban_permanent: bool = False

    model_config = {"from_attributes": True}

    @computed_field
    def is_public_banned(self) -> bool:
        if self.public_ban_permanent:
            return True
        if self.public_ban_until is not None:
            return self.public_ban_until > datetime.now(timezone.utc)
        return False


class UserInDB(UserResponse):
    hashed_password: str


class UserBanRequest(BaseModel):
    duration: str = Field(..., pattern="^(1h|24h|forever)$")


class UserRoleUpdateRequest(BaseModel):
    role: str = Field(..., pattern="^(user|moderator)$")
