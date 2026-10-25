from fastapi.testclient import TestClient

from app.main import app
from app.security import _REQUESTS

client = TestClient(app)


def test_cors_allows_configured_local_frontend_origin() -> None:
    response = client.options(
        "/api/v1/markets",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "content-type",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
    assert response.headers.get("access-control-allow-credentials") != "true"


def test_cors_does_not_reflect_unapproved_origin() -> None:
    response = client.options(
        "/api/v1/markets",
        headers={
            "Origin": "https://attacker.example",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert "access-control-allow-origin" not in response.headers


def test_api_rate_limit_returns_bounded_429_and_retry_after(monkeypatch) -> None:
    _REQUESTS.clear()
    monkeypatch.setattr(app.state, "rate_limit_requests_per_minute", 1)

    first = client.get("/api/v1/markets")
    second = client.get("/api/v1/markets")

    assert first.status_code == 200
    assert second.status_code == 429
    assert second.headers["retry-after"].isdigit()
    assert second.json()["detail"]["code"] == "rate_limited"
    assert "attacker" not in second.text
    monkeypatch.setattr(app.state, "rate_limit_requests_per_minute", 120)
    _REQUESTS.clear()
