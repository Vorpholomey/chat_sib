"""File upload: POST /upload returns URL. Used for images/gifs in messages."""

import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File

from app.api.deps import require_full_chat_access
from app.core.config import settings
from app.models.user import User
from app.schemas.upload import UploadResponse

router = APIRouter(tags=["upload"])

# Magic-byte sniffing (extension alone is not enough).
_KIND_TO_ALLOWED_FILENAME_EXTS: dict[str, frozenset[str]] = {
    "jpeg": frozenset({"jpg", "jpeg"}),
    "png": frozenset({"png"}),
    "gif": frozenset({"gif"}),
    "webp": frozenset({"webp"}),
}


def _image_kind_from_bytes(head: bytes) -> Optional[str]:
    if len(head) < 12:
        return None
    if head.startswith(b"\xff\xd8\xff"):
        return "jpeg"
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if head.startswith(b"GIF87a") or head.startswith(b"GIF89a"):
        return "gif"
    if head.startswith(b"RIFF") and head[8:12] == b"WEBP":
        return "webp"
    return None


def _ensure_upload_dir() -> Path:
    d = Path(settings.upload_dir)
    d.mkdir(parents=True, exist_ok=True)
    return d


@router.post("/upload", response_model=UploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(require_full_chat_access),
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
    kind = _image_kind_from_bytes(content[:32])
    if not kind:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File is not a recognized image",
        )
    allowed_names = _KIND_TO_ALLOWED_FILENAME_EXTS.get(kind)
    if not allowed_names or ext not in allowed_names:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File extension does not match image type",
        )
    upload_dir = _ensure_upload_dir()
    store_ext = "jpg" if kind == "jpeg" else ext
    name = f"{uuid.uuid4().hex}.{store_ext}"
    path = upload_dir / name
    path.write_bytes(content)
    url = f"/uploads/{name}"
    return UploadResponse(url=url)
