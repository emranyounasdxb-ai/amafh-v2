# AMAFH v2

Internal AMAFH application. React/TypeScript/Vite SPA → Nginx → FastAPI REST (`/api/v1/`) → PostgreSQL and Redis. The current application includes Administration, Customer and Case workflows, Tasks, Notifications, Finance, Reporting, CSV imports and Audit Log.

## Start locally

1. Copy `.env.example` to `.env` and replace `POSTGRES_PASSWORD` with a unique local value. `.env` is ignored by Git.
2. Run `docker compose up --build -d` from this directory.
3. Open `http://127.0.0.1:8080`. Check `http://127.0.0.1:8080/api/v1/health` and `http://127.0.0.1:8080/api/v1/health/ready`.

Only Nginx publishes a host port, bound to loopback. PostgreSQL and Redis are project-owned volumes/network services. Do not point this configuration at any old AMAFH database.

Use `docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build -d` for source-mounted development. Use `docker compose down` to stop services; this retains database volumes.

## Local commands

- Frontend: `cd frontend`; `pnpm install --frozen-lockfile`; `pnpm dev`; `pnpm typecheck`; `pnpm build`; `pnpm test`; `pnpm exec playwright test`.
- Backend: `cd backend`; `py -3.12 -m venv .venv`; `.\.venv\Scripts\python -m pip install -e ".[test]"`; `.\.venv\Scripts\python -m pytest`.
- Migrations in the running backend: `docker compose exec backend alembic upgrade head`; inspect with `docker compose exec backend alembic current`.
- Compose validation: `docker compose config --quiet`.

The local Vite server proxies `/api` and `/health` to `http://localhost:8000` if a backend is running there separately. Docker sets `VITE_API_PROXY_TARGET=http://backend:8000`; Nginx proxies browser requests directly to FastAPI. See [project decisions](docs/PROJECT_CONTEXT.md) and [version record](docs/VERSIONS.md).

## Production configuration and pipeline

`docker-compose.prod.yml` defines a separate five-service production stack. It builds the frontend into a static Nginx image and exposes only the edge Nginx service. Set a production `.env` on the deployment host with unique PostgreSQL credentials, `TRUSTED_HOSTS` for the public hostname, and `CORS_ORIGINS` for its HTTPS origin. Keep that file on the host; it is excluded from the CI file transfer. HTTPS termination and certificates are supplied by the host's external reverse proxy. `SESSION_COOKIE_SECURE=true` and `APP_ENV=production` are set by the production Compose file. Apply migrations with `docker compose -f docker-compose.prod.yml run --rm backend alembic upgrade head` before starting the application services.

The local `.github/workflows/pipeline.yml` runs syntax/whitespace checks, TypeScript, frontend and backend tests, the production build, isolated database integration scripts, browser tests and Docker builds. Deployment runs only from a manual workflow dispatch on `main`, after verification succeeds and the GitHub `production` environment gate. Configure `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_PATH`, `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS` and `DEPLOY_HEALTH_URL` as production environment secrets. The deployment host needs Docker Compose and an existing production `.env`. `DEPLOY_HEALTH_URL` is the externally reachable base URL used for the readiness check.

## Frontend design system

Read [the design system authority](docs/design-system/DESIGN_SYSTEM.md), [component catalogue](docs/design-system/COMPONENTS.md), and [Figma-to-code mapping](docs/design-system/FIGMA_MAPPING.md) before building a feature UI. Shared tokens, components, patterns, and template slots live under `frontend/src/styles`, `components`, `patterns`, and `templates`. The design system preview is available at `http://127.0.0.1:5173/_design-system` while `pnpm dev` runs; the application shell preview is at `/_design-system-shell`. Both previews are development-only. The mapping ledger identifies Figma families that still need work before business screens consume them.
