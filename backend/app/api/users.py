"""List registered users (for chat sidebar)."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.core.websocket_manager import ws_manager
from app.db.session import get_db
from app.models.user import User
from app.schemas.users_list import UserListItem

router = APIRouter(prefix="/api", tags=["users"])


@router.get("/users", response_model=list[UserListItem])
async def list_registered_users(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Active users for the sidebar, excluding permanently public-banned accounts (not listed in global chat)."""
    result = await db.execute(
        select(User)
        .where(User.is_active == True, User.public_ban_permanent == False)
        .order_by(User.username)
    )
    users = list(result.scalars().all())
    items: list[UserListItem] = []
    for u in users:
        if u.id == current_user.id:
            continue
        items.append(
            UserListItem(
                id=u.id,
                username=u.username,
                role=u.role,
                online=ws_manager.is_online(u.id),
            )
        )
    return items
