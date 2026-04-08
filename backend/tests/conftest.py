"""Shared fixtures for API tests (requires PostgreSQL matching DATABASE_URL)."""

from __future__ import annotations

import uuid
from collections.abc import Generator
from typing import Any

import pytest
from sqlalchemy import create_engine, text
from starlette.testclient import TestClient

from app.core import rate_limit
from app.core.config import settings
from app.main import app


@pytest.fixture(scope="session", autouse=True)
def _disable_auth_rate_limits() -> Generator[None, None, None]:
    """Session-scoped client hits /auth/register many times; lift in-process limits."""
    orig_reg = rate_limit.register_limiter.allow
    orig_login = rate_limit.login_limiter.allow
    rate_limit.register_limiter.allow = lambda key: True  # type: ignore[assignment]
    rate_limit.login_limiter.allow = lambda key: True  # type: ignore[assignment]
    yield
    rate_limit.register_limiter.allow = orig_reg
    rate_limit.login_limiter.allow = orig_login


@pytest.fixture(scope="session")
def client() -> Generator[TestClient, None, None]:
    # One ASGI client for the whole session so Starlette's anyio portal (and SQLAlchemy's
    # async engine bound to that loop) is not recreated per test — avoids asyncpg
    # "another operation is in progress" / wrong loop errors.
    with TestClient(app) as c:
        yield c


def register_user(
    client: TestClient,
    *,
    username: str | None = None,
    email: str | None = None,
    password: str = "testpassword123",
) -> dict[str, Any]:
    u = username or f"u_{uuid.uuid4().hex[:12]}"
    e = email or f"{u}@test.example"
    r = client.post(
        "/auth/register",
        json={"username": u, "email": e, "password": password},
    )
    assert r.status_code == 200, r.text
    return r.json()


def login(client: TestClient, email: str, password: str = "testpassword123") -> dict[str, Any]:
    r = client.post("/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json()


def auth_headers(access_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {access_token}"}


def set_user_permanently_banned(user_id: int) -> None:
    """Mark user banned using sync DB connection (avoids asyncio loop conflicts with TestClient)."""
    e = create_engine(settings.database_url_sync)
    with e.connect() as c:
        c.execute(
            text("UPDATE users SET public_ban_permanent = true WHERE id = :id"),
            {"id": user_id},
        )
        c.commit()
