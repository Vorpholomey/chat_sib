"""Auth routes: register, login, refresh."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.user import UserCreate, UserResponse
from app.schemas.auth import LoginRequest, RefreshRequest, Token
from app.services.auth import register_user, authenticate_user, create_tokens_for_user, refresh_tokens

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse)
async def register(
    data: UserCreate,
    db: AsyncSession = Depends(get_db),
):
    try:
        user = await register_user(db, data)
    except HTTPException:
        raise
    return UserResponse.model_validate(user)


@router.post("/login", response_model=Token)
async def login(
    data: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    user = await authenticate_user(db, data.email, data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
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
