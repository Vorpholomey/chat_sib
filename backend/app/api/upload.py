"""File upload and media serving with range support."""

import re
import uuid
import mimetypes
from pathlib import Path
from typing import Optional
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, File, Header, HTTPException, Request, Response, UploadFile, status
from fastapi.responses import FileResponse

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


def _id3_synchsafe_to_int(value: bytes) -> int:
    if len(value) != 4:
        return 0
    return (
        ((value[0] & 0x7F) << 21)
        | ((value[1] & 0x7F) << 14)
        | ((value[2] & 0x7F) << 7)
        | (value[3] & 0x7F)
    )


def _decode_id3_text(payload: bytes) -> str:
    if not payload:
        return ""
    encoding = payload[0]
    raw = payload[1:]
    try:
        if encoding == 0:
            text = raw.decode("latin1", errors="ignore")
        elif encoding == 1:
            text = raw.decode("utf-16", errors="ignore")
        elif encoding == 2:
            text = raw.decode("utf-16-be", errors="ignore")
        else:
            text = raw.decode("utf-8", errors="ignore")
    except Exception:
        return ""
    return text.replace("\x00", "").strip()


def _extract_apic_frame(payload: bytes) -> tuple[Optional[str], Optional[bytes]]:
    if len(payload) < 4:
        return None, None
    encoding = payload[0]
    i = 1
    mime_end = payload.find(b"\x00", i)
    if mime_end == -1:
        return None, None
    mime = payload[i:mime_end].decode("latin1", errors="ignore").strip().lower()
    i = mime_end + 1
    if i >= len(payload):
        return None, None
    i += 1  # picture type
    if i >= len(payload):
        return None, None

    if encoding in (0, 3):
        desc_end = payload.find(b"\x00", i)
        if desc_end == -1:
            return None, None
        i = desc_end + 1
    else:
        j = i
        while j + 1 < len(payload):
            if payload[j] == 0 and payload[j + 1] == 0:
                i = j + 2
                break
            j += 2
        else:
            return None, None

    image_data = payload[i:]
    if not image_data:
        return None, None
    return mime or None, image_data


def _parse_id3_audio_metadata(content: bytes) -> tuple[Optional[str], Optional[str], Optional[str], Optional[bytes]]:
    if len(content) < 10 or not content.startswith(b"ID3"):
        return None, None, None, None
    version = content[3]
    if version not in (3, 4):
        return None, None, None, None
    tag_size = _id3_synchsafe_to_int(content[6:10])
    end = min(len(content), 10 + tag_size)
    pos = 10
    title: Optional[str] = None
    artist: Optional[str] = None
    apic_mime: Optional[str] = None
    apic_data: Optional[bytes] = None

    while pos + 10 <= end:
        frame_header = content[pos : pos + 10]
        frame_id = frame_header[:4].decode("latin1", errors="ignore")
        if not frame_id.strip("\x00"):
            break
        frame_size = int.from_bytes(frame_header[4:8], byteorder="big")
        if frame_size <= 0:
            break
        frame_data_start = pos + 10
        frame_data_end = frame_data_start + frame_size
        if frame_data_end > end:
            break
        payload = content[frame_data_start:frame_data_end]
        if frame_id == "TIT2":
            parsed = _decode_id3_text(payload)
            if parsed:
                title = parsed
        elif frame_id == "TPE1":
            parsed = _decode_id3_text(payload)
            if parsed:
                artist = parsed
        elif frame_id == "APIC" and apic_data is None:
            apic_mime, apic_data = _extract_apic_frame(payload)
        pos = frame_data_end

    return title, artist, apic_mime, apic_data


def _cover_extension_from_mime(mime: Optional[str]) -> str:
    if not mime:
        return "jpg"
    if "png" in mime:
        return "png"
    if "gif" in mime:
        return "gif"
    if "webp" in mime:
        return "webp"
    return "jpg"


def _resolve_upload_path(path_param: str) -> Path:
    root = _ensure_upload_dir().resolve()
    candidate = (root / path_param).resolve()
    if root not in candidate.parents and candidate != root:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    if not candidate.exists() or not candidate.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    return candidate


def _parse_range_header(range_header: str, file_size: int) -> tuple[int, int]:
    m = re.match(r"^bytes=(\d*)-(\d*)$", range_header.strip())
    if not m:
        raise HTTPException(status_code=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE, detail="Invalid range")
    start_raw, end_raw = m.groups()
    if not start_raw and not end_raw:
        raise HTTPException(status_code=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE, detail="Invalid range")
    if start_raw:
        start = int(start_raw)
        end = int(end_raw) if end_raw else file_size - 1
    else:
        # Suffix range: bytes=-N means last N bytes.
        suffix_len = int(end_raw)
        if suffix_len <= 0:
            raise HTTPException(status_code=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE, detail="Invalid range")
        start = max(file_size - suffix_len, 0)
        end = file_size - 1
    if start < 0 or end < start or start >= file_size:
        raise HTTPException(status_code=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE, detail="Invalid range")
    end = min(end, file_size - 1)
    return start, end


@router.api_route("/uploads/{path_param:path}", methods=["GET", "HEAD"])
async def serve_upload(
    path_param: str,
    request: Request,
    range_header: Optional[str] = Header(default=None, alias="Range"),
):
    file_path = _resolve_upload_path(path_param)
    stat = file_path.stat()
    file_size = stat.st_size
    headers = {
        "Accept-Ranges": "bytes",
    }

    if not range_header:
        return FileResponse(file_path, headers=headers)

    start, end = _parse_range_header(range_header, file_size)
    length = end - start + 1
    headers["Content-Range"] = f"bytes {start}-{end}/{file_size}"
    headers["Content-Length"] = str(length)

    if request.method == "HEAD":
        return Response(status_code=status.HTTP_206_PARTIAL_CONTENT, headers=headers)

    with file_path.open("rb") as f:
        f.seek(start)
        chunk = f.read(length)
    media_type = mimetypes.guess_type(str(file_path))[0] or "application/octet-stream"
    return Response(
        content=chunk,
        status_code=status.HTTP_206_PARTIAL_CONTENT,
        headers=headers,
        media_type=media_type,
    )


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
        query: dict[str, str] = {"name": display_name}
        if kind == "mp3":
            title, artist, apic_mime, apic_data = _parse_id3_audio_metadata(content)
            if title:
                query["title"] = title
            if artist:
                query["artist"] = artist
            if apic_data:
                cover_ext = _cover_extension_from_mime(apic_mime)
                cover_name = _reserve_unique_name(
                    upload_dir,
                    f"{Path(name).stem}_cover.{cover_ext}",
                )
                (upload_dir / cover_name).write_bytes(apic_data)
                query["cover"] = f"/uploads/{cover_name}"
        url = f"{url}?{urlencode(query)}"
    return UploadResponse(url=url)
