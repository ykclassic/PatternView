# PatternView API

The API is a separate, read-only FastAPI service. It does not connect to exchange accounts, accept exchange credentials, or place trades.

## Local development

Requirements: Python 3.12+.

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
pytest
```

- Liveness: `GET /health`
- Readiness: `GET /ready`
- OpenAPI: `/openapi.json`; interactive docs: `/docs`

The API contract is versioned under `/api/v1`. Market data, detection, interpretation, persistence and production hardening are delivered in the following milestones. The service intentionally starts without required external secrets so local checks and health probes work in isolated environments.
