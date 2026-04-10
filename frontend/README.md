# Chat frontend (React + TypeScript + Tailwind)

## Scripts

```bash
npm install
npm run dev    # http://localhost:5173 — proxies /api, /auth, /upload, /ws to backend :8000
npm run build
```

## Environment

For **production** builds, leave **`VITE_API_URL` unset** when the SPA is served behind the same host as the API (e.g. Docker nginx), so requests use same-origin paths. Set it when the API lives on another origin:

```env
VITE_API_URL=https://api.example.com
```

In **development**, `VITE_API_URL` is empty and the app calls the same origin (`localhost:5173`); `vite.config.ts` proxies API and WebSocket traffic to the FastAPI server.

## Backend integration

- REST: `/auth/register`, `/auth/login`, `/api/private/me`, `/api/users`, `/api/private/conversations`, `/api/private/messages/{id}`, `/upload`
- WebSocket: **`/ws/chat?token=...`** — global messages as JSON without `recipient_id`; private messages include `recipient_id` (there is no separate `/ws/private` in the current API).

Tokens are stored in `localStorage` via Zustand persist (`chat-auth`).
