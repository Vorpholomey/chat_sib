"""File upload: POST /upload returns URL. Used for images/gifs in messages."""

import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.models.user import User
from app.schemas.upload import UploadResponse

router = APIRouter(tags=["upload"])


def _ensure_upload_dir() -> Path:
    d = Path(settings.upload_dir)
    d.mkdir(parents=True, exist_ok=True)
    return d


@router.post("/upload", response_model=UploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing filename")
    ext = Path(file.filename).suffix.lstrip(".").lower()
    if ext not in settings.allowed_image_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Allowed extensions: {', '.join(sorted(settings.allowed_image_extensions))}",
        )
    content = await file.read()
    if len(content) > settings.max_upload_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Max {settings.max_upload_size_mb} MB",
        )
    upload_dir = _ensure_upload_dir()
    name = f"{uuid.uuid4().hex}.{ext}"
    path = upload_dir / name
    path.write_bytes(content)
    url = f"/uploads/{name}"
    return UploadResponse(url=url)
