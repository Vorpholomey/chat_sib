"""User Pydantic schemas."""

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator


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
    created_at: datetime

    model_config = {"from_attributes": True}


class UserInDB(UserResponse):
    hashed_password: str
