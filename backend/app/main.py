"""FastAPI application: routes, static files, CORS."""

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.core.config import settings
from app.api import auth, upload, private, websocket, users, messages, moderation, read_state, chats_read_status


def _cors_origins() -> list[str]:
    parsed = settings.cors_origin_list()
    if settings.debug:
        return parsed or [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]
    return parsed


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        return response


app = FastAPI(
    title=settings.app_name,
    debug=settings.debug,
)

app.add_middleware(SecurityHeadersMiddleware)

_cors = _cors_origins()
if _cors:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Accept"],
    )

app.include_router(auth.router)
app.include_router(upload.router)
app.include_router(private.router)
app.include_router(users.router)
# REST under /api so the Vite dev proxy (and clients using /api/...) match OpenAPI paths.
app.include_router(messages.router, prefix="/api")
app.include_router(read_state.router, prefix="/api")
app.include_router(chats_read_status.router, prefix="/api")
app.include_router(moderation.router, prefix="/api")
app.include_router(websocket.router)

# Serve uploaded files at /uploads
upload_dir = Path(settings.upload_dir)
upload_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(upload_dir)), name="uploads")


@app.get("/health")
def health():
    return {"status": "ok"}
