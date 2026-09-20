from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from redis.asyncio import Redis
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.api.v1.health import router as health_router
from app.api.v1.auth import router as auth_router
from app.api.v1.organization import router as organization_router
from app.api.v1.customers import router as customers_router
from app.api.v1.product_stages import router as product_stages_router
from app.api.v1.profile_media import router as profile_media_router
from app.api.v1.csv_imports import router as csv_imports_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.tasks import router as tasks_router
from app.api.v1.finance import router as finance_router
from app.api.v1.reports import router as reports_router
from app.api.v1.audit_logs import router as audit_logs_router
from app.core.config import get_settings
from app.db.session import create_engine, create_session_factory

settings = get_settings()
if settings.app_env == "production" and (not settings.postgres_password or not settings.session_cookie_secure):
    raise RuntimeError("Production database password and secure session cookies are required")


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.db_engine = create_engine(settings)
    app.state.session_factory = create_session_factory(app.state.db_engine)
    app.state.redis = Redis.from_url(settings.redis_url, decode_responses=True)
    yield
    await app.state.redis.aclose()
    await app.state.db_engine.dispose()


app = FastAPI(title="AMAFH v2 API", version="0.1.0", lifespan=lifespan)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_hosts)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["Content-Type"],
)


@app.middleware("http")
async def limit_request_body(request: Request, call_next):
    if request.method not in {"GET", "HEAD", "OPTIONS"} and request.cookies.get("amafh_session"):
        origin = request.headers.get("origin")
        fetch_site = request.headers.get("sec-fetch-site")
        allowed = set(settings.allowed_origins)
        if settings.app_env != "production":
            allowed.update({"http://127.0.0.1:5182", "http://localhost:5182", "http://127.0.0.1:5173", "http://localhost:5173"})
        if fetch_site == "cross-site" or (origin and origin.rstrip("/") not in allowed):
            return security_headers(JSONResponse({"error": {"code": "csrf_rejected", "message": "Request origin is not allowed"}}, status_code=403))
    size = request.headers.get("content-length")
    if size and (not size.isdecimal() or int(size) > settings.max_request_bytes):
        return security_headers(JSONResponse({"error": {"code": "request_too_large", "message": "Request body too large"}}, status_code=413))
    response = await call_next(request)
    return security_headers(response)


def security_headers(response):
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
    if settings.app_env == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


@app.exception_handler(RequestValidationError)
async def validation_error(_: Request, exc: RequestValidationError):
    return JSONResponse({"error": {"code": "validation_error", "message": "Invalid request"}}, status_code=422)


@app.exception_handler(StarletteHTTPException)
async def http_error(_: Request, exc: StarletteHTTPException):
    return JSONResponse({"error": {"code": "http_error", "message": str(exc.detail)}}, status_code=exc.status_code)


@app.get("/health", include_in_schema=False)
async def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(health_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(organization_router, prefix="/api/v1")
app.include_router(customers_router, prefix="/api/v1")
app.include_router(product_stages_router, prefix="/api/v1")
app.include_router(profile_media_router, prefix="/api/v1")
app.include_router(csv_imports_router, prefix="/api/v1")
app.include_router(notifications_router, prefix="/api/v1")
app.include_router(tasks_router, prefix="/api/v1")
app.include_router(finance_router, prefix="/api/v1")
app.include_router(reports_router, prefix="/api/v1")
app.include_router(audit_logs_router, prefix="/api/v1")
