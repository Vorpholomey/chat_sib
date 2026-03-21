# Chat Backend

FastAPI backend for a web-based chat application: global room, private messaging, JWT auth, WebSockets, file uploads.

## Tech Stack

- **Python** 3.10+
- **FastAPI**
- **PostgreSQL** (primary DB) + **Redis** (planned for caching; WebSockets use in-memory manager)
- **JWT** (access + refresh), **bcrypt** passwords
- **SQLAlchemy 2.0** + **Alembic**

## Setup

1. **Create venv and install deps**

   ```bash
   python3 -m venv .venv
   source .venv/bin/activate  # or .venv\Scripts\activate on Windows
   pip install -r requirements.txt
   ```

2. **PostgreSQL**

   Create a database and set the URL (sync for Alembic, async for app):

   ```bash
   createdb chat_db
   ```

3. **Environment**

   Create `.env` from the example and set your DB user (required for app and Alembic):

   ```bash
   cp .env.example .env
   ```

   Then edit `.env`: set `DATABASE_URL` and `DATABASE_URL_SYNC` to a PostgreSQL user that exists on your machine (see Troubleshooting if you get "role postgres does not exist"). Optionally set `SECRET_KEY`.

4. **Migrations**

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
On macOS (e.g. Homebrew), PostgreSQL often creates a role with your **OS username**, not `postgres`. In `.env` set:

- `DATABASE_URL=postgresql+asyncpg://YOUR_OS_USERNAME@localhost:5432/chat_db`
- `DATABASE_URL_SYNC=postgresql://YOUR_OS_USERNAME@localhost:5432/chat_db`

Use your Mac username (no password if you never set one). Then create the DB if needed: `createdb chat_db`, and run `alembic upgrade head` again.

## API Overview

- **Auth**: `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`
- **Upload**: `POST /upload` (returns URL for use in messages)
- **Private**: `GET /api/private/conversations`, `GET /api/private/messages/{user_id}?skip=0&limit=50`
- **WebSocket**: `WS /ws/chat?token=<access_token>`
  - On connect: last 1000 global messages are sent.
  - Send global message: `{"text": "...", "content_type": "text"|"image"|"gif"}`.
  - Send private message: `{"text": "...", "content_type": "...", "recipient_id": <int>}`.
- **Static**: `GET /uploads/<filename>` serves uploaded files.

All timestamps are stored and returned in UTC.
