"""Auth routes: register, login, refresh."""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth_constants import ACCOUNT_PERMANENTLY_BANNED
from app.core.rate_limit import login_limiter, register_limiter
from app.db.session import get_db
from app.schemas.user import UserCreate, UserResponse
from app.schemas.auth import LoginRequest, RefreshRequest, Token
from app.services.auth import register_user, authenticate_user, create_tokens_for_user, refresh_tokens

router = APIRouter(prefix="/auth", tags=["auth"])


def _client_ip(request: Request) -> str:
    if request.client:
        return request.client.host or "unknown"
    return "unknown"


@router.post("/register", response_model=UserResponse)
async def register(
    request: Request,
    data: UserCreate,
    db: AsyncSession = Depends(get_db),
):
    if not register_limiter.allow(f"register:{_client_ip(request)}"):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many requests")
    try:
        user = await register_user(db, data)
    except HTTPException:
        raise
    return UserResponse.model_validate(user)


@router.post("/login", response_model=Token)
async def login(
    request: Request,
    data: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    if not login_limiter.allow(f"login:{_client_ip(request)}"):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many requests")
    user = await authenticate_user(db, data.email, data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    if user.public_ban_permanent:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=ACCOUNT_PERMANENTLY_BANNED,
        )
    return create_tokens_for_user(user)


@router.post("/refresh", response_model=Token)
async def refresh(
    data: RefreshRequest,
    db: AsyncSession = Depends(get_db),
):
    tokens = await refresh_tokens(db, data.refresh_token)
    if not tokens:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )
    return tokens
