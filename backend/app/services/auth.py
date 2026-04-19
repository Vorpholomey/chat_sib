"""Auth service: register, login, refresh, password recovery."""

from __future__ import annotations

import logging
import secrets
import string
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.core.auth_constants import ACCOUNT_PERMANENTLY_BANNED, TEMPORARY_PASSWORD_EXPIRED
from app.core.config import settings
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
from app.services.email import send_plaintext_email

logger = logging.getLogger(__name__)

_TEMP_PASSWORD_ALPHABET = string.ascii_letters + string.digits
_FORGOT_PASSWORD_ACK = "If an account exists for this email, we sent instructions."


def forgot_password_ack_message() -> str:
    return _FORGOT_PASSWORD_ACK


def generate_temporary_password_plain() -> str:
    length = secrets.randbelow(3) + 8  # 8, 9, or 10
    return "".join(secrets.choice(_TEMP_PASSWORD_ALPHABET) for _ in range(length))


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


async def authenticate_user(db: AsyncSession, email: str, password: str) -> tuple[User, bool]:
    """Return (user, must_change_password). must_change_password is True only after temp-password login.

    Raises HTTPException 401 with TEMPORARY_PASSWORD_EXPIRED when a temporary password exists but is expired.
    Returns no user by raising internally — caller maps to 401 invalid credentials.
    """
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if verify_password(password, user.hashed_password):
        if user.temporary_password_hash is not None or user.is_using_temporary_password:
            user.temporary_password_hash = None
            user.is_using_temporary_password = False
            user.temporary_password_expires_at = None
            await db.commit()
            await db.refresh(user)
        return user, False

    if user.temporary_password_hash:
        now = datetime.now(timezone.utc)
        exp = user.temporary_password_expires_at
        if exp is None or exp <= now:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=TEMPORARY_PASSWORD_EXPIRED,
            )
        if verify_password(password, user.temporary_password_hash):
            return user, True

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid email or password",
    )


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


async def forgot_password(db: AsyncSession, email: str) -> None:
    """If a user exists, set a short-lived temporary password and email it (or log in dev)."""
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user:
        return

    plain = generate_temporary_password_plain()
    user.temporary_password_hash = get_password_hash(plain)
    user.is_using_temporary_password = True
    user.temporary_password_expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
    await db.commit()

    body = (
        "You requested a password reset.\n\n"
        f"Your temporary password is: {plain}\n\n"
        "It is valid for 15 minutes. After logging in, you will be asked to choose a new password.\n"
        "If you did not request this, you can ignore this message.\n"
    )
    subject = "Your temporary password"

    if settings.smtp_host:
        try:
            await send_plaintext_email(user.email, subject, body)
        except Exception:
            logger.exception("Failed to send password recovery email to %s", user.email)
    else:
        logger.warning(
            "SMTP not configured; temporary password for %s: %s",
            user.email,
            plain,
        )


async def change_password_after_temporary(db: AsyncSession, user: User, new_password: str) -> Token:
    if not user.is_using_temporary_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password change not required",
        )
    user.hashed_password = get_password_hash(new_password)
    user.temporary_password_hash = None
    user.is_using_temporary_password = False
    user.temporary_password_expires_at = None
    await db.commit()
    await db.refresh(user)
    return create_tokens_for_user(user)
