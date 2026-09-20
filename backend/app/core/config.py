from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import URL


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    postgres_user: str = "amafh_v2"
    postgres_password: str = ""
    postgres_db: str = "amafh_v2_dev"
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    redis_url: str = "redis://localhost:6379/0"
    trusted_hosts: str = "localhost,127.0.0.1,backend"
    cors_origins: str = "http://localhost:8080,http://127.0.0.1:8080"
    db_pool_size: int = 10
    db_max_overflow: int = 5
    max_request_bytes: int = 2_100_000
    profile_media_root: str = "/app/profile-media"
    session_cookie_secure: bool = True
    session_hours: int = 8
    session_idle_minutes: int = 30
    setup_link_minutes: int = 30
    app_env: str = "development"

    @property
    def database_url(self) -> URL:
        return URL.create(
            "postgresql+asyncpg",
            username=self.postgres_user,
            password=self.postgres_password,
            host=self.postgres_host,
            port=self.postgres_port,
            database=self.postgres_db,
        )

    @property
    def allowed_hosts(self) -> list[str]:
        return [value.strip() for value in self.trusted_hosts.split(",") if value.strip()]

    @property
    def allowed_origins(self) -> list[str]:
        return [value.strip() for value in self.cors_origins.split(",") if value.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
