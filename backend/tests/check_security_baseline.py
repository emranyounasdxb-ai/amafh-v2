"""Security headers, browser origin defense, cookie flags and login throttling."""

import asyncio
from uuid import uuid4

from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.db.models import User, UserType
from app.db.session import create_engine, create_session_factory
from app.main import app
from app.security.passwords import hash_password

PASSWORD = "security check password"


async def seed():
    engine = create_engine(get_settings())
    try:
        async with create_session_factory(engine)() as db:
            user_type = UserType(name=f"Security Check {uuid4()}", description="Isolated", active=True)
            db.add(user_type)
            await db.flush()
            user = User(email=f"security-check-{uuid4()}@example.test", full_name="Security Check",
                        password_hash=hash_password(PASSWORD), user_type_id=user_type.id,
                        organization_scope="organization", active=True)
            db.add(user)
            await db.commit()
            return user.email
    finally:
        await engine.dispose()


def main():
    email = asyncio.run(seed())
    with TestClient(app, base_url="http://localhost") as client:
        login = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
        assert login.status_code == 200, login.text
        assert "httponly" in login.headers["set-cookie"].lower()
        assert "samesite=lax" in login.headers["set-cookie"].lower()
        assert login.headers["x-content-type-options"] == "nosniff"
        assert login.headers["x-frame-options"] == "DENY"
        assert client.post("/api/v1/auth/logout", headers={"Origin": "https://attacker.example"}).status_code == 403
        assert client.get("/api/v1/auth/session").status_code == 200
        assert client.post("/api/v1/auth/logout", headers={"Origin": "http://localhost:8080"}).status_code == 200
        for _ in range(10):
            assert client.post("/api/v1/auth/login", json={"email": email, "password": "wrong"}).status_code == 401
        assert client.post("/api/v1/auth/login", json={"email": email, "password": "wrong"}).status_code == 429
    print("Security headers, cookie flags, origin defense and login rate limit passed")


if __name__ == "__main__":
    main()
