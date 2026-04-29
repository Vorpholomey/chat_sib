"""File upload: POST /upload returns URL for supported media."""

import uuid
from pathlib import Path
from typing import Optional
import re
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File

from app.api.deps import require_full_chat_access
from app.core.config import settings
from app.models.user import User
from app.schemas.upload import UploadResponse

router = APIRouter(tags=["upload"])

_KIND_TO_ALLOWED_FILENAME_EXTS: dict[str, frozenset[str]] = {
    "jpeg": frozenset({"jpg", "jpeg"}),
    "png": frozenset({"png"}),
    "gif": frozenset({"gif"}),
    "webp": frozenset({"webp"}),
    "mp4": frozenset({"mp4"}),
    "webm": frozenset({"webm"}),
    "mp3": frozenset({"mp3"}),
    "wav": frozenset({"wav"}),
}


def _media_kind_from_bytes(head: bytes) -> Optional[str]:
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
    if len(head) >= 12 and head[4:8] == b"ftyp":
        return "mp4"
    if head.startswith(b"\x1a\x45\xdf\xa3"):
        return "webm"
    if head.startswith(b"ID3"):
        return "mp3"
    if len(head) >= 2 and head[0] == 0xFF and (head[1] & 0xE0) == 0xE0:
        return "mp3"
    if head.startswith(b"RIFF") and head[8:12] == b"WAVE":
        return "wav"
    return None


def _ensure_upload_dir() -> Path:
    d = Path(settings.upload_dir)
    d.mkdir(parents=True, exist_ok=True)
    return d


def _sanitize_original_filename(filename: str) -> str:
    base = Path(filename).name.strip()
    if not base:
        return "file"
    sanitized = re.sub(r"[^A-Za-z0-9._-]+", "_", base).strip("._")
    return sanitized or "file"


def _reserve_unique_name(upload_dir: Path, desired_name: str) -> str:
    candidate = desired_name
    stem = Path(desired_name).stem or "file"
    suffix = Path(desired_name).suffix
    idx = 1
    while (upload_dir / candidate).exists():
        candidate = f"{stem}_{idx}{suffix}"
        idx += 1
    return candidate


@router.post("/upload", response_model=UploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(require_full_chat_access),
):
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing filename")
    ext = Path(file.filename).suffix.lstrip(".").lower()
    allowed_extensions = (
        settings.allowed_image_extensions
        | settings.allowed_video_extensions
        | settings.allowed_audio_extensions
    )
    if ext not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Allowed extensions: {', '.join(sorted(allowed_extensions))}",
        )
    content = await file.read()
    if len(content) > settings.max_upload_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Max {settings.max_upload_size_mb} MB",
        )
    kind = _media_kind_from_bytes(content[:512])
    if not kind:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File is not a recognized media type",
        )
    allowed_names = _KIND_TO_ALLOWED_FILENAME_EXTS.get(kind)
    if not allowed_names or ext not in allowed_names:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File extension does not match media type",
        )
    upload_dir = _ensure_upload_dir()
    store_ext = "jpg" if kind == "jpeg" else ext
    if kind in {"mp4", "webm", "mp3", "wav"}:
        original = _sanitize_original_filename(file.filename)
        if Path(original).suffix.lstrip(".").lower() != store_ext:
            original = f"{Path(original).stem or 'file'}.{store_ext}"
        name = _reserve_unique_name(upload_dir, original)
    else:
        name = f"{uuid.uuid4().hex}.{store_ext}"
    path = upload_dir / name
    path.write_bytes(content)
    url = f"/uploads/{name}"
    if kind in {"mp4", "webm", "mp3", "wav"}:
        display_name = _sanitize_original_filename(file.filename)
        if Path(display_name).suffix.lstrip(".").lower() != store_ext:
            display_name = f"{Path(display_name).stem or 'file'}.{store_ext}"
        url = f"{url}?name={quote(display_name)}"
    return UploadResponse(url=url)
