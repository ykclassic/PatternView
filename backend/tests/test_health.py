from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_is_live_without_external_dependencies() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "patternview-api",
        "version": "1.0.0",
    }


def test_readiness_has_a_stable_contract() -> None:
    response = client.get("/ready")

    assert response.status_code == 200
    assert response.json()["status"] == "ready"
