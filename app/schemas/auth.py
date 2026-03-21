"""Auth Pydantic schemas."""

from pydantic import BaseModel, EmailStr, Field, field_validator


_BCRYPT_MAX_PASSWORD_BYTES = 72


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)

    @field_validator("password")
    @classmethod
    def password_max_72_bytes(cls, v: str) -> str:
        if len(v.encode("utf-8")) > _BCRYPT_MAX_PASSWORD_BYTES:
            raise ValueError("Password is too long (max 72 bytes). Use a shorter password.")
        return v


class RefreshRequest(BaseModel):
    refresh_token: str = Field(..., min_length=1)


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    sub: str
    exp: int
    iat: int
    type: str
