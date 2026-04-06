"""Application configuration. All timestamps stored in UTC."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Backend root (directory containing app/)
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
_ENV_FILE = _PROJECT_ROOT / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE) if _ENV_FILE.exists() else None,
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # App
    app_name: str = "Chat API"
    debug: bool = False

    # Database (PostgreSQL)
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/chat_db"
    database_url_sync: str = "postgresql://postgres:postgres@localhost:5432/chat_db"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # JWT
    secret_key: str = "change-me-in-production-use-long-random-string"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    # CORS — comma-separated origins, e.g. "https://app.example.com,https://www.example.com"
    # When debug is False, this list is used as-is (empty means no cross-origin browser access).
    # When debug is True and empty, main.py falls back to local Vite defaults.
    cors_origins: str = ""

    # Uploads
    upload_dir: Path = Path("uploads")
    max_upload_size_mb: int = 10
    allowed_image_extensions: set[str] = {"png", "jpg", "jpeg", "gif", "webp"}

    @property
    def max_upload_size_bytes(self) -> int:
        return self.max_upload_size_mb * 1024 * 1024

    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @model_validator(mode="after")
    def reject_weak_jwt_secret_in_production(self) -> Settings:
        if self.debug:
            return self
        weak = "change-me-in-production-use-long-random-string"
        if self.secret_key == weak or len(self.secret_key) < 32:
            raise ValueError(
                "When DEBUG is false, SECRET_KEY must be set to a random string of at least 32 characters."
            )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
