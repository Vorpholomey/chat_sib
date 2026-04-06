"""Dependency injection: get current user from JWT."""

from typing import Annotated, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer, APIKeyQuery
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth_constants import ACCOUNT_PERMANENTLY_BANNED
from app.core.security import decode_token
from app.db.session import get_db
from app.models.user import User, UserRole

# Prefer Bearer token; also allow token in query for WebSocket
security_bearer = HTTPBearer(auto_error=False)
security_query = APIKeyQuery(name="token", auto_error=False)


async def get_token_payload(
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(security_bearer)],
    token_query: Annotated[Optional[str], Depends(security_query)],
) -> Optional[dict]:
    """Extract and decode JWT from Authorization header or query param."""
    token = None
    if credentials and credentials.credentials:
        token = credentials.credentials
    elif token_query:
        token = token_query
    if not token:
        return None
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        return None
    return payload


async def get_current_user_id(
    payload: Annotated[Optional[dict], Depends(get_token_payload)],
) -> Optional[int]:
    if not payload or "sub" not in payload:
        return None
    try:
        return int(payload["sub"])
    except (ValueError, TypeError):
        return None


async def get_current_user(
    user_id: Annotated[Optional[int], Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is inactive",
        )
    if user.public_ban_permanent:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=ACCOUNT_PERMANENTLY_BANNED,
        )
    return user


async def get_optional_user(
    user_id: Annotated[Optional[int], Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Optional[User]:
    if user_id is None:
        return None
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def require_moderator_or_admin(
    user: Annotated[User, Depends(get_current_user)],
) -> User:
    if user.role not in (UserRole.moderator, UserRole.admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Moderator or admin required")
    return user


async def require_admin(
    user: Annotated[User, Depends(get_current_user)],
) -> User:
    if user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin required")
    return user
