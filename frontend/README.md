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

## UI kit

Design tokens and reusable primitives live under `frontend/src/ui/`.

| Resource | Location |
|----------|----------|
| Semantic colors (`@theme`) | `src/index.css` |
| Token → class map | `src/ui/tokens/colors.ts` |
| **Element → color map** | `src/ui/tokens/elementColors.ts` |
| Components | `src/ui/components/` |

**Dev gallery** (component previews + full element→color table):

```bash
npm run dev
# open http://localhost:5173/dev/ui-kit
```

The `/dev/ui-kit` route is registered only in development builds.

**Usage:**

```tsx
import { Button, Input, Label, Card, elementColors } from "./ui";
```

Migrate feature code incrementally; new UI should use kit primitives and semantic tokens (`bg-primary`, `text-foreground-muted`) instead of raw `slate-*` / `violet-*` classes.

**Exceptions (not fixed tokens):**

- Per-user username colors: `lib/usernameColor.ts` (inline `style`)
- Sonner toasts: third-party palette (`richColors`)

## Backend integration

- REST: `/auth/register`, `/auth/login`, `/api/private/me`, `/api/users`, `/api/private/conversations`, `/api/private/messages/{id}`, `/upload`
- WebSocket: **`/ws/chat?token=...`** — global messages as JSON without `recipient_id`; private messages include `recipient_id` (there is no separate `/ws/private` in the current API).

Tokens are stored in `localStorage` via Zustand persist (`chat-auth`).
