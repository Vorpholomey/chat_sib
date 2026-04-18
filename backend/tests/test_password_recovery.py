"""Password recovery and temporary-password flows (PostgreSQL + migration 007 required)."""

from __future__ import annotations

from starlette.testclient import TestClient

from app.core.auth_constants import PASSWORD_CHANGE_REQUIRED, TEMPORARY_PASSWORD_EXPIRED
from tests.conftest import (
    auth_headers,
    login,
    register_user,
    set_user_temporary_password_state,
)


def test_forgot_password_idempotent_message(client: TestClient) -> None:
    msg_ok = "If an account exists for this email, we sent instructions."
    r_unknown = client.post("/auth/forgot-password", json={"email": "nobody@example.com"})
    assert r_unknown.status_code == 200
    assert r_unknown.json() == {"message": msg_ok}

    u = register_user(client)
    r_known = client.post("/auth/forgot-password", json={"email": u["email"]})
    assert r_known.status_code == 200
    assert r_known.json() == {"message": msg_ok}


def test_login_with_temporary_password_must_change_flag(client: TestClient) -> None:
    u = register_user(client)
    plain = "tmpA9zz2"
    set_user_temporary_password_state(u["id"], plain_password=plain, expired=False)
    r = client.post("/auth/login", json={"email": u["email"], "password": plain})
    assert r.status_code == 200
    body = r.json()
    assert body["must_change_password"] is True
    assert body["access_token"]


def test_login_expired_temporary_password(client: TestClient) -> None:
    u = register_user(client)
    plain = "tmpB8yy1"
    set_user_temporary_password_state(u["id"], plain_password=plain, expired=True)
    r = client.post("/auth/login", json={"email": u["email"], "password": plain})
    assert r.status_code == 401
    assert r.json()["detail"] == TEMPORARY_PASSWORD_EXPIRED


def test_change_password_after_temporary_clears_flags(client: TestClient) -> None:
    u = register_user(client)
    plain = "tmpC7xx0"
    set_user_temporary_password_state(u["id"], plain_password=plain, expired=False)
    t = login(client, u["email"], plain)
    assert t["must_change_password"] is True

    new_pw = "newpermanent99"
    ch = client.post(
        "/auth/change-password-after-temporary",
        json={"new_password": new_pw, "confirm_password": new_pw},
        headers=auth_headers(t["access_token"]),
    )
    assert ch.status_code == 200, ch.text
    pair = ch.json()
    assert pair["access_token"] != t["access_token"]

    r2 = client.post("/auth/login", json={"email": u["email"], "password": new_pw})
    assert r2.status_code == 200
    assert r2.json()["must_change_password"] is False


def test_protected_route_403_when_temporary_password(client: TestClient) -> None:
    u = register_user(client)
    plain = "tmpD6ww9"
    set_user_temporary_password_state(u["id"], plain_password=plain, expired=False)
    t = login(client, u["email"], plain)
    h = auth_headers(t["access_token"])

    blocked = client.get("/api/users", headers=h)
    assert blocked.status_code == 403
    assert blocked.json()["detail"] == PASSWORD_CHANGE_REQUIRED

    me = client.get("/api/private/me", headers=h)
    assert me.status_code == 200
    assert me.json()["must_change_password"] is True
