"""Auth service: register, login, refresh."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.core.auth_constants import ACCOUNT_PERMANENTLY_BANNED
from app.core.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.models.user import User
from app.schemas.user import UserCreate

from app.schemas.auth import Token


async def register_user(db: AsyncSession, data: UserCreate) -> User:
    """Create user with hashed password. Raises if email/username taken."""
    existing = await db.execute(
        select(User.id).where(
            (User.email == data.email) | (User.username == data.username)
        ).limit(1)
    )
    if existing.scalar_one_or_none() is not None:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Email or username already registered")
    user = User(
        username=data.username,
        email=data.email,
        hashed_password=get_password_hash(data.password),
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


async def authenticate_user(db: AsyncSession, email: str, password: str) -> User | None:
    """Return user if credentials valid, else None."""
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(password, user.hashed_password):
        return None
    return user


def create_tokens_for_user(user: User) -> Token:
    sub = str(user.id)
    return Token(
        access_token=create_access_token(sub, extra_claims={"role": user.role.value}),
        refresh_token=create_refresh_token(sub),
    )


async def refresh_tokens(db: AsyncSession, refresh_token: str) -> Token | None:
    """Validate refresh token and return new token pair."""
    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh" or "sub" not in payload:
        return None
    try:
        user_id = int(payload["sub"])
    except (ValueError, TypeError):
        return None
    result = await db.execute(select(User).where(User.id == user_id, User.is_active == True))
    user = result.scalar_one_or_none()
    if not user:
        return None
    if user.public_ban_permanent:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=ACCOUNT_PERMANENTLY_BANNED,
        )
    return create_tokens_for_user(user)
