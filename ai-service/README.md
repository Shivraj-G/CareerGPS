# AI Service — Phase 4

FastAPI internal service for career recommendation reasoning.

Phase 4 uses a deterministic structured MVP matcher so the system can run without an external LLM/API key. It does not write to PostgreSQL. Node.js remains responsible for database access and persistence.

Run from `ai-service`:

```bash
python -m venv .venv
# Windows: .venv\\Scripts\\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Set the same `INTERNAL_SERVICE_TOKEN` in the backend and AI service environments.
