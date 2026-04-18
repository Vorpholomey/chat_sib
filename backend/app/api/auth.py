"""Auth routes: register, login, refresh, forgot password, change password after temporary."""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth_constants import ACCOUNT_PERMANENTLY_BANNED
from app.core.rate_limit import forgot_password_limiter, login_limiter, register_limiter
from app.db.session import get_db
from app.schemas.user import UserCreate, UserResponse
from app.schemas.auth import (
    ChangePasswordAfterTemporaryRequest,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    LoginResponse,
    RefreshRequest,
    Token,
)
from app.services.auth import (
    register_user,
    authenticate_user,
    create_tokens_for_user,
    refresh_tokens,
    forgot_password,
    forgot_password_ack_message,
    change_password_after_temporary,
)
from app.api.deps import get_current_user
from app.models.user import User

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


@router.post("/login", response_model=LoginResponse)
async def login(
    request: Request,
    data: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    if not login_limiter.allow(f"login:{_client_ip(request)}"):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many requests")
    user, must_change_password = await authenticate_user(db, data.email, data.password)
    if user.public_ban_permanent:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=ACCOUNT_PERMANENTLY_BANNED,
        )
    tokens = create_tokens_for_user(user)
    return LoginResponse(
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        token_type=tokens.token_type,
        must_change_password=must_change_password,
    )


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


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
async def forgot_password_route(
    request: Request,
    body: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    if not forgot_password_limiter.allow(f"forgot-password:{_client_ip(request)}"):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many requests")
    await forgot_password(db, body.email)
    return ForgotPasswordResponse(message=forgot_password_ack_message())


@router.post("/change-password-after-temporary", response_model=Token)
async def change_password_after_temporary_route(
    body: ChangePasswordAfterTemporaryRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await change_password_after_temporary(db, current_user, body.new_password)
