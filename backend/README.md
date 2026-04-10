# Chat backend

FastAPI service for the chat application: global room, private messaging, JWT auth, WebSockets, file uploads, and moderation (roles, bans, pins).

## Tech stack

- **Python** 3.10+
- **FastAPI**, **Uvicorn**
- **PostgreSQL** (async via `asyncpg`, sync for Alembic)
- **SQLAlchemy 2.0** + **Alembic**
- **JWT** (access + refresh), **bcrypt** passwords
- **Redis** URL in config (reserved for future caching; WebSockets use an in-memory connection manager)

## Setup

1. **Virtualenv and dependencies**

   ```bash
   cd backend
   python3 -m venv .venv
   source .venv/bin/activate   # or .venv\Scripts\activate on Windows
   pip install -r requirements.txt
   ```

2. **PostgreSQL**

   Create a database and set URLs in `.env` (sync for Alembic, async for the app):

   ```bash
   createdb chat_db
   ```

3. **Environment**

   ```bash
   cp .env.example .env
   ```

   Set `DATABASE_URL` and `DATABASE_URL_SYNC` to a PostgreSQL user that exists on your machine. Optionally set `SECRET_KEY` and upload limits.

4. **Migrations**

   Run from **`backend/`** (so `alembic.ini` and the `app` package resolve correctly):

   ```bash
   alembic upgrade head
   ```

5. **Run**

   ```bash
   uvicorn app.main:app --reload
   ```

   API: `http://127.0.0.1:8000`, docs: `http://127.0.0.1:8000/docs`.

## Troubleshooting

**`role "postgres" does not exist`**  
On macOS (e.g. Homebrew), PostgreSQL often creates a role matching your **OS username**, not `postgres`. In `.env` use:

- `DATABASE_URL=postgresql+asyncpg://YOUR_OS_USERNAME@localhost:5432/chat_db`
- `DATABASE_URL_SYNC=postgresql://YOUR_OS_USERNAME@localhost:5432/chat_db`

Then `createdb chat_db` if needed and `alembic upgrade head` again.

## API overview

- **Auth**: `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`
- **Users**: `GET /api/users` (sidebar: other users + online flag)
- **Messages (REST)**: under `/api/messages` — global create/edit/delete, pin/unpin, moderation-related flows as implemented
- **Moderation**: under `/api/users` — ban, role updates (moderator/admin)
- **Upload**: `POST /upload` (returns URL for messages)
- **Private**: `GET /api/private/me`, `GET /api/private/conversations`, `GET /api/private/messages/{user_id}?limit=20` (optional `before_id` for older pages; optional `skip` when `before_id` omitted)
- **Global history**: `GET /api/messages/global/history?before_id=&limit=20` (messages older than `before_id`)
- **WebSocket**: `WS /ws/chat?token=<access_token>`
  - On connect: pin state, last **20** global messages, then `{"type":"global_history_ready"}`.
  - Global: `{"text": "...", "content_type": "text"|"image"|"gif", ...}`.
  - Private: include `recipient_id`.
- **Static**: `GET /uploads/<filename>` serves uploaded files (default upload dir is `uploads/` relative to the process working directory — run from `backend/` so files land under `backend/uploads/`).

All timestamps are stored and returned in UTC.
