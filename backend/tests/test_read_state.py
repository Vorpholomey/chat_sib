"""Integration tests for /api/read-state (PostgreSQL required)."""

from __future__ import annotations

from starlette.testclient import TestClient

from tests.conftest import auth_headers, login, register_user, set_user_permanently_banned


def test_global_read_state_roundtrip(client: TestClient) -> None:
    u1 = register_user(client)
    u2 = register_user(client)
    t1 = login(client, u1["email"])
    t2 = login(client, u2["email"])
    h1 = auth_headers(t1["access_token"])
    h2 = auth_headers(t2["access_token"])

    r = client.post(
        "/api/messages",
        json={"text": "hello global", "content_type": "text"},
        headers=h1,
    )
    assert r.status_code == 200, r.text
    mid = r.json()["id"]

    g = client.get("/api/read-state/global", headers=h2)
    assert g.status_code == 200
    assert g.json() == {"last_read_message_id": None}

    p = client.patch(
        "/api/read-state/global",
        json={"last_read_message_id": mid},
        headers=h2,
    )
    assert p.status_code == 200, p.text
    assert p.json() == {"last_read_message_id": mid}

    g2 = client.get("/api/read-state/global", headers=h2)
    assert g2.json() == {"last_read_message_id": mid}


def test_global_patch_unknown_message_404(client: TestClient) -> None:
    u = register_user(client)
    t = login(client, u["email"])
    r = client.patch(
        "/api/read-state/global",
        json={"last_read_message_id": 999999999},
        headers=auth_headers(t["access_token"]),
    )
    assert r.status_code == 404


def test_global_forbidden_when_permanently_banned(client: TestClient) -> None:
    u = register_user(client)
    t = login(client, u["email"])
    set_user_permanently_banned(u["id"])
    r = client.get("/api/read-state/global", headers=auth_headers(t["access_token"]))
    assert r.status_code == 403


def test_private_read_state_roundtrip(client: TestClient) -> None:
    u1 = register_user(client)
    u2 = register_user(client)
    t1 = login(client, u1["email"])
    t2 = login(client, u2["email"])
    h1 = auth_headers(t1["access_token"])
    h2 = auth_headers(t2["access_token"])
    # From u2's perspective the peer in the DM is u1 (u1 sent the message).
    peer_for_u2 = u1["id"]

    r = client.post(
        "/api/private/messages",
        json={"recipient_id": u2["id"], "text": "dm hello", "content_type": "text"},
        headers=h1,
    )
    assert r.status_code == 200, r.text
    mid = r.json()["id"]

    g = client.get("/api/read-state/private", params={"peer_id": peer_for_u2}, headers=h2)
    assert g.status_code == 200
    assert g.json() == {"last_read_message_id": None}

    p = client.patch(
        "/api/read-state/private",
        json={"peer_id": peer_for_u2, "last_read_message_id": mid},
        headers=h2,
    )
    assert p.status_code == 200, p.text
    assert p.json() == {"last_read_message_id": mid}

    g2 = client.get("/api/read-state/private", params={"peer_id": peer_for_u2}, headers=h2)
    assert g2.json() == {"last_read_message_id": mid}


def test_private_patch_wrong_peer_bad_request(client: TestClient) -> None:
    u1 = register_user(client)
    u2 = register_user(client)
    u3 = register_user(client)
    t1 = login(client, u1["email"])
    t3 = login(client, u3["email"])
    h1 = auth_headers(t1["access_token"])
    h3 = auth_headers(t3["access_token"])

    r = client.post(
        "/api/private/messages",
        json={"recipient_id": u2["id"], "text": "x", "content_type": "text"},
        headers=h1,
    )
    assert r.status_code == 200, r.text
    mid = r.json()["id"]

    bad = client.patch(
        "/api/read-state/private",
        json={"peer_id": u2["id"], "last_read_message_id": mid},
        headers=h3,
    )
    assert bad.status_code == 403


def test_private_patch_peer_mismatch(client: TestClient) -> None:
    u1 = register_user(client)
    u2 = register_user(client)
    u3 = register_user(client)
    t1 = login(client, u1["email"])
    t2 = login(client, u2["email"])
    h1 = auth_headers(t1["access_token"])
    h2 = auth_headers(t2["access_token"])

    r = client.post(
        "/api/private/messages",
        json={"recipient_id": u2["id"], "text": "x", "content_type": "text"},
        headers=h1,
    )
    assert r.status_code == 200, r.text
    mid = r.json()["id"]

    bad = client.patch(
        "/api/read-state/private",
        json={"peer_id": u3["id"], "last_read_message_id": mid},
        headers=h2,
    )
    assert bad.status_code == 400
    assert "conversation" in bad.json()["detail"].lower()


def test_private_get_invalid_peer(client: TestClient) -> None:
    u = register_user(client)
    t = login(client, u["email"])
    r = client.get(
        "/api/read-state/private",
        params={"peer_id": 999999999},
        headers=auth_headers(t["access_token"]),
    )
    assert r.status_code == 404


def test_unauthenticated_read_state(client: TestClient) -> None:
    r = client.get("/api/read-state/global")
    assert r.status_code == 401
