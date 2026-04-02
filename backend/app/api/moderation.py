"""User moderation: public bans and role changes (admin)."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_admin, require_moderator_or_admin
from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.user import UserBanRequest, UserRoleUpdateRequest
from app.services.user import apply_public_ban, get_user_by_id, set_user_role

router = APIRouter(prefix="/users", tags=["users"])


@router.post("/{user_id}/ban")
async def ban_user_public(
    user_id: int,
    body: UserBanRequest,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_moderator_or_admin),
):
    target = await get_user_by_id(db, user_id)
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    try:
        await apply_public_ban(db, actor, target, body.duration)
    except PermissionError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot ban this user") from None
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid duration") from None
    await db.commit()
    return {"ok": True, "user_id": user_id, "duration": body.duration}


@router.put("/{user_id}/role")
async def update_user_role(
    user_id: int,
    body: UserRoleUpdateRequest,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_admin),
):
    target = await get_user_by_id(db, user_id)
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    new_role = UserRole.moderator if body.role == "moderator" else UserRole.user
    try:
        await set_user_role(db, actor, target, new_role)
    except PermissionError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot change role for this user") from None
    await db.commit()
    return {"ok": True, "user_id": user_id, "role": new_role.value}
