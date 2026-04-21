"""Integration tests for /api/chats/{chat_id}/read-status (PostgreSQL required)."""

from __future__ import annotations

from starlette.testclient import TestClient

from tests.conftest import auth_headers, login, register_user, set_user_permanently_banned


def test_chats_read_status_invalid_chat_id(client: TestClient) -> None:
    u = register_user(client)
    t = login(client, u["email"])
    h = auth_headers(t["access_token"])
    for bad in ("0", "-1", "abc"):
        r = client.get(f"/api/chats/{bad}/read-status", headers=h)
        assert r.status_code == 400, (bad, r.text)


def test_chats_global_read_status_and_monotonic(client: TestClient) -> None:
    u1 = register_user(client)
    u2 = register_user(client)
    t2 = login(client, u2["email"])
    h2 = auth_headers(t2["access_token"])
    h1 = auth_headers(login(client, u1["email"])["access_token"])

    r1 = client.post(
        "/api/messages",
        json={"text": "m1", "content_type": "text"},
        headers=h1,
    )
    r2 = client.post(
        "/api/messages",
        json={"text": "m2", "content_type": "text"},
        headers=h1,
    )
    assert r1.status_code == 200 and r2.status_code == 200
    m1, m2 = r1.json()["id"], r2.json()["id"]
    assert m1 < m2

    g0 = client.get("/api/chats/global/read-status", headers=h2)
    assert g0.status_code == 200
    j0 = g0.json()
    assert j0["last_read_message_id"] is None
    assert j0.get("updated_at") is None

    p1 = client.post(
        "/api/chats/global/read-status",
        json={"last_read_message_id": m1},
        headers=h2,
    )
    assert p1.status_code == 200, p1.text
    assert p1.json()["last_read_message_id"] == m1
    assert p1.json().get("updated_at") is not None

    p_stale = client.post(
        "/api/chats/global/read-status",
        json={"last_read_message_id": m1},
        headers=h2,
    )
    assert p_stale.status_code == 200, p_stale.text
    assert p_stale.json()["last_read_message_id"] == m1

    p_adv = client.post(
        "/api/chats/global/read-status",
        json={"last_read_message_id": m2},
        headers=h2,
    )
    assert p_adv.status_code == 200
    assert p_adv.json()["last_read_message_id"] == m2

    mar = client.post("/api/chats/global/mark-all-read", headers=h2)
    assert mar.status_code == 200
    assert mar.json()["last_read_message_id"] == m2


def test_chats_private_mark_all_and_monotonic(client: TestClient) -> None:
    u1 = register_user(client)
    u2 = register_user(client)
    h1 = auth_headers(login(client, u1["email"])["access_token"])
    h2 = auth_headers(login(client, u2["email"])["access_token"])
    peer_for_u2 = u1["id"]

    r_a = client.post(
        "/api/private/messages",
        json={"recipient_id": u2["id"], "text": "a", "content_type": "text"},
        headers=h1,
    )
    r_b = client.post(
        "/api/private/messages",
        json={"recipient_id": u2["id"], "text": "b", "content_type": "text"},
        headers=h1,
    )
    assert r_a.status_code == 200 and r_b.status_code == 200
    ma, mb = r_a.json()["id"], r_b.json()["id"]

    path = f"/api/chats/{peer_for_u2}/read-status"
    assert client.get(path, headers=h2).json()["last_read_message_id"] is None

    assert client.post(path, json={"last_read_message_id": mb}, headers=h2).json()["last_read_message_id"] == mb
    stale = client.post(path, json={"last_read_message_id": ma}, headers=h2)
    assert stale.status_code == 200
    assert stale.json()["last_read_message_id"] == mb

    mar = client.post(f"/api/chats/{peer_for_u2}/mark-all-read", headers=h2)
    assert mar.status_code == 200
    assert mar.json()["last_read_message_id"] == mb


def test_chats_global_forbidden_when_permanently_banned(client: TestClient) -> None:
    u = register_user(client)
    t = login(client, u["email"])
    set_user_permanently_banned(u["id"])
    h = auth_headers(t["access_token"])
    r = client.get("/api/chats/global/read-status", headers=h)
    assert r.status_code == 403
