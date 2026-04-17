"""Sanitize rich text (subset of HTML) for chat message bodies."""

from __future__ import annotations

import re
from typing import Optional
from html import unescape
from urllib.parse import urlparse

import bleach

from app.models.global_message import MessageType

ALLOWED_TAGS = ["p", "br", "strong", "b", "em", "i", "a"]
ALLOWED_ATTRIBUTES = {"a": ["href"]}

MAX_MESSAGE_CONTENT_LEN = 65535


def sanitize_message_html(raw: str) -> str:
    """Allow bold, italic, line breaks, and safe http(s) links only."""
    if not raw:
        return ""
    cleaned = bleach.clean(
        raw.strip(),
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        protocols=["http", "https"],
        strip=True,
    )
    return cleaned.strip()


def is_effectively_empty_html(html: str) -> bool:
    """True if there is no visible text (e.g. empty tags or only whitespace)."""
    if not html or not html.strip():
        return True
    text = re.sub(r"<[^>]+>", "", html)
    text = unescape(text)
    return not text.strip()


def prepare_optional_caption_html(raw: Optional[str]) -> Optional[str]:
    """Sanitized HTML for optional image/gif captions; None if absent or empty."""
    if raw is None:
        return None
    s = raw.strip()
    if not s:
        return None
    out = sanitize_message_html(s)
    if is_effectively_empty_html(out):
        return None
    if len(out) > MAX_MESSAGE_CONTENT_LEN:
        raise ValueError("Caption too long")
    return out


def prepare_stored_message_content(content: str, message_type: MessageType) -> str:
    """
    Normalize content before persistence. Text messages are HTML-sanitized;
    image/gif bodies are treated as plain URL strings.
    """
    if message_type != MessageType.text:
        out = content.strip()
        if not out:
            raise ValueError("Message content is required")
        if len(out) > MAX_MESSAGE_CONTENT_LEN:
            raise ValueError("Message too long")
        parsed = urlparse(out)
        if parsed.scheme not in ("http", "https") or not parsed.netloc:
            raise ValueError("Image URL must be http(s) with a valid host")
        return out
    out = sanitize_message_html(content)
    if is_effectively_empty_html(out):
        raise ValueError("Message text is required")
    if len(out) > MAX_MESSAGE_CONTENT_LEN:
        raise ValueError("Message too long")
    return out
