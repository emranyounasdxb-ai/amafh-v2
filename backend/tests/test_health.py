from fastapi.testclient import TestClient

from app.main import app


def test_liveness() -> None:
    with TestClient(app, base_url="http://localhost") as client:
        response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_untrusted_host_rejected() -> None:
    with TestClient(app, base_url="http://localhost") as client:
        response = client.get("/health", headers={"host": "untrusted.example"})
    assert response.status_code == 400
