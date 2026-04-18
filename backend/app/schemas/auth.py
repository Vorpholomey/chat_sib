"""Auth Pydantic schemas."""

from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


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


class LoginResponse(Token):
    must_change_password: bool = False


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ForgotPasswordResponse(BaseModel):
    message: str


class ChangePasswordAfterTemporaryRequest(BaseModel):
    new_password: str = Field(..., min_length=6, max_length=128)
    confirm_password: str = Field(..., min_length=6, max_length=128)

    @field_validator("new_password", "confirm_password")
    @classmethod
    def password_max_72_bytes(cls, v: str) -> str:
        if len(v.encode("utf-8")) > _BCRYPT_MAX_PASSWORD_BYTES:
            raise ValueError("Password is too long (max 72 bytes). Use a shorter password.")
        return v

    @model_validator(mode="after")
    def passwords_match(self) -> ChangePasswordAfterTemporaryRequest:
        if self.new_password != self.confirm_password:
            raise ValueError("Passwords do not match")
        return self


class TokenPayload(BaseModel):
    sub: str
    exp: int
    iat: int
    type: str
