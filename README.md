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

API: `http://127.0.0.1:8000` · OpenAPI: `/docs`

**Frontend**:

```bash
cd frontend
npm install
npm run dev -- --host
```

Dev UI: `http://127.0.0.1:5173` — Vite proxies `/api`, `/auth`, `/upload`, `/uploads`, and `/ws` to the backend on port 8000.

## Docker

PostgreSQL, the API (with migrations on startup), and an **nginx** front serving the built SPA and proxying `/api`, `/auth`, `/upload`, `/uploads`, `/ws`, and `/docs` to the backend.

```bash
cp compose.env.example compose.env
# Edit compose.env: set SECRET_KEY (≥ 32 characters)
docker compose --env-file compose.env up --build
```

Open **`http://localhost:8080`** (override with `HTTP_PORT` in `compose.env`). Uploads and the database persist in Docker volumes (`uploads`, `pgdata`).

## GitHub and Docker Hub

**Push the project to GitHub** (one-time):

```bash
git init   # if this folder is not already a repo
git remote add origin https://github.com/YOUR_ORG/chat_sib.git
git branch -M main
git add -A && git commit -m "Initial commit"
git push -u origin main
```

Use SSH (`git@github.com:YOUR_ORG/chat_sib.git`) if you prefer SSH keys.

**Publish images from GitHub to Docker Hub**: the workflow [`.github/workflows/docker-publish.yml`](.github/workflows/docker-publish.yml) builds `backend/` and `frontend/` and pushes:

- `YOUR_DOCKERHUB_USER/chat_sib-backend`
- `YOUR_DOCKERHUB_USER/chat_sib-frontend`

**Repository secrets** (GitHub → *Settings* → *Secrets and variables* → *Actions*):

| Secret | Value |
|--------|--------|
| `DOCKERHUB_USERNAME` | Your Docker Hub username or organization name |
| `DOCKERHUB_TOKEN` | A [Docker Hub access token](https://docs.docker.com/security/for-developers/access-tokens/) (not your account password) |

Runs on every push to **`main`**, on **`v*`** tags (semver tags on images), and on **workflow dispatch**. Images are tagged with `latest` (main only), short Git SHA, and semver when you push a version tag.

**Pull locally** (after a successful run):

```bash
docker pull YOUR_DOCKERHUB_USER/chat_sib-backend:latest
docker pull YOUR_DOCKERHUB_USER/chat_sib-frontend:latest
```

Use those image names in your own compose or orchestration, or keep building from this repo with `docker compose ... up --build`.

## Configuration note

Environment variables for the API live in **`backend/.env`** (see `backend/.env.example`). If you previously used a `.env` at the repository root, move or copy it into `backend/`.

## Documentation

- Backend setup and API overview: [`backend/README.md`](backend/README.md)
- Frontend scripts and env: [`frontend/README.md`](frontend/README.md)
- Architecture (full): [`architecture.mdc`](architecture.mdc)
