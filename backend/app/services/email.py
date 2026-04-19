"""SMTP email delivery (password recovery)."""

from __future__ import annotations

import logging
from email.message import EmailMessage

import aiosmtplib

from app.core.config import settings

logger = logging.getLogger(__name__)


def _smtp_connection_kwargs() -> dict:
    """Match server TLS mode: 465 = SSL from first byte; 587 = plain then STARTTLS."""
    port = settings.smtp_port
    if port == 465:
        return {"use_tls": True, "start_tls": False}
    if settings.smtp_use_tls:
        return {"use_tls": False, "start_tls": True}
    return {"use_tls": False, "start_tls": False}


async def send_plaintext_email(to_addr: str, subject: str, body: str) -> None:
    """Send a simple plaintext email. Raises on SMTP failure."""
    if not settings.smtp_host:
        raise RuntimeError("SMTP host not configured")

    message = EmailMessage()
    message["From"] = settings.smtp_from
    message["To"] = to_addr
    message["Subject"] = subject
    message.set_content(body)

    tls = _smtp_connection_kwargs()
    await aiosmtplib.send(
        message,
        hostname=settings.smtp_host,
        port=settings.smtp_port,
        username=settings.smtp_user or None,
        password=settings.smtp_password or None,
        timeout=settings.smtp_timeout_seconds,
        **tls,
    )
