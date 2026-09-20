# AMAFH v2 technical foundation

AMAFH v2 is an internal AMAFH business application. This repository is a new, isolated project. It does not import or copy the older AMAFH website or its database.

## Architecture

- Frontend: React, strict TypeScript, Vite SPA, Tailwind CSS. `components.json` prepares shadcn/ui; Radix dependencies are added only with a component that uses them. Lucide, Motion, and TanStack Query are installed for later application work. There is no SSR, Next.js, or SEO layer.
- API: Python FastAPI with Pydantic validation and `/api/v1/` REST routes. REST is the primary operation interface. The only API route now is health. There is no placeholder authentication, CRUD, or business API.
- Database: isolated PostgreSQL is the source of truth. SQLAlchemy 2.0 async engine and session factory use bounded pooling. Alembic starts with an empty baseline revision; no business tables exist.
- Redis: transient cache, rate-limit storage, and Pub/Sub when those features are implemented. It is not durable business storage.
- Real time: future mutations commit PostgreSQL first, then publish an event to a scoped Redis channel. WebSocket subscribers will receive only authorized company, branch, department, team, or user events. Pub/Sub is best effort: clients must refetch authoritative REST state after reconnect or missed events. No WebSocket endpoint or broadcast mechanism is implemented in this phase.
- Expected load: about 300 concurrent users in 3 locations. No capacity claim is made. Later load tests should measure 100, 200, 300, then 500 users.

## Deployment and security boundaries

Docker Compose runs PostgreSQL, Redis, FastAPI, Vite, and a development Nginx gateway on loopback port 8080. PostgreSQL and Redis have no host ports. This Nginx config serves local HTTP only. Production deployment requires a separate TLS certificate and HTTPS Nginx configuration, secure cookie settings for later authentication, trusted proxy policy, and capacity testing.

FastAPI restricts CORS to configured origins and validates Host. Nginx caps request bodies at 1 MiB; FastAPI also checks Content-Length. Pydantic validates future request schemas. Error responses use a structured `error` envelope. Future authorization must be enforced server-side using the authenticated principal and database scope, never frontend supplied IDs as proof. Future rate limiting uses Redis with per-principal and per-route policy. Future audit records must be written transactionally with mutations and without secrets. No authentication, authorization, audit log, or rate limiting is falsely claimed as implemented.

## Dependencies and testing

Dependencies are pinned to exact stable registry versions, recorded in `docs/VERSIONS.md` and the frontend lockfile. Frontend: Vitest and React Testing Library. Backend: Pytest. Browser smoke: Playwright. The smoke tests cover only foundation health and frontend/API reachability. Indexing, pagination, selective query design, query authorization, and WebSocket implementation belong to future business modules.

Excluded: business screens, copied legacy UI, GraphQL, Prisma, MongoDB, Express, Hono, Redux, RabbitMQ, microservices, and all prerelease packages.
