# Installed version record

Verified on 2026-09-19. Package versions were checked against the npm and PyPI registries before installation. These values were then confirmed from the installed environment, lockfile, or running containers.

## Frontend

| Package | Installed version |
| --- | --- |
| React / React DOM | 19.3.0 / 19.3.0 |
| Vite / React plugin | 8.3.0 / 6.1.1 |
| TypeScript | 7.0.2 |
| Tailwind CSS / Vite plugin | 4.3.3 / 4.3.3 |
| shadcn CLI | 4.21.0 |
| Lucide React | 1.47.0 |
| Motion | 13.4.0 |
| TanStack Query | 5.103.1 |
| Radix Select | 2.3.7 |
| Radix Dropdown Menu / Popover / Tooltip | 2.1.24 / 1.1.23 / 1.2.16 |
| Fontsource Manrope / IBM Plex Sans | 5.3.0 / 5.3.0 |
| Vitest | 5.0.1 |
| React Testing Library | 16.3.3 |
| Playwright Test | 1.63.0 |

Radix primitives are installed for shared select and floating controls. The shadcn Vite configuration remains available for future components.

## Backend

| Package | Installed version |
| --- | --- |
| Python | 3.12.13 |
| FastAPI | 0.141.1 |
| Pydantic / Pydantic Settings | 2.13.5 / 2.15.0 |
| SQLAlchemy | 2.0.54 (stable 2.x) |
| Alembic | 1.20.0 |
| asyncpg | 0.31.0 |
| redis-py | 8.1.0 |
| Uvicorn | 0.53.0 |
| Pytest | 9.1.1 |
| HTTPX | 0.28.1 |

## Runtime and infrastructure

| Component | Verified version |
| --- | --- |
| Node.js | 24.18.0 |
| pnpm | 11.24.0 (already installed; used for this foundation) |
| PostgreSQL server | 18.4 |
| Redis server | 8.2.9 |
| Nginx | 1.29.8 |
| Docker Engine | 29.7.2 |
| Docker Compose | 5.5.1 |

The Compose image tags are `postgres:18.4-alpine`, `redis:8.2-alpine`, `nginx:1.29-alpine`, `node:24.18.0-alpine`, and `python:3.12.13-slim`. Their resolved contents can change if mutable tags are republished; lock digests before a production release.
