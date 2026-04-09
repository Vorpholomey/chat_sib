# Chat (chat_sib)

Monorepo for a real-time web chat: **global room**, **private messaging**, **JWT authentication**, **file uploads**, **WebSockets**, and **moderation** (roles, public bans, pinned messages).

## Layout

| Directory | Role |
|-----------|------|
| [`backend/`](backend/) | FastAPI API, SQLAlchemy models, Alembic migrations, WebSocket hub |
| [`frontend/`](frontend/) | React + TypeScript + Vite + Tailwind SPA |

See **[`architecture.mdc`](architecture.mdc)** for a full architecture description (stack, data flow, modules, and configuration).

## Quick start

**Backend** (from repo root):

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env          # edit DATABASE_URL* and SECRET_KEY
alembic upgrade head
uvicorn app.main:app --reload
```

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload
```





API: `http://127.0.0.1:8000` · OpenAPI: `/docs`

**Frontend**:

```bash
cd frontend
npm install
npm run dev -- --host
```

Dev UI: `http://127.0.0.1:5173` — Vite proxies `/api`, `/auth`, `/upload`, `/uploads`, and `/ws` to the backend on port 8000.

## Configuration note

Environment variables for the API live in **`backend/.env`** (see `backend/.env.example`). If you previously used a `.env` at the repository root, move or copy it into `backend/`.

## Documentation

- Backend setup and API overview: [`backend/README.md`](backend/README.md)
- Frontend scripts and env: [`frontend/README.md`](frontend/README.md)
- Architecture (full): [`architecture.mdc`](architecture.mdc)
