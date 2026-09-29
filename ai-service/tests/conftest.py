import os
import sys
from pathlib import Path

# Must be set before `app.main` is imported anywhere, since main.py reads
# INTERNAL_SERVICE_TOKEN at module load time.
os.environ.setdefault("INTERNAL_SERVICE_TOKEN", "test-secret-token")

# Tests must NEVER call a real LLM (slow, costs quota, non-deterministic).
# Assignment (not setdefault) so a key exported in your shell cannot leak in.
os.environ["LLM_PROVIDER"] = "none"

# Let `from app.main import app` resolve when pytest runs from ai-service/.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest  # noqa: E402


@pytest.fixture(autouse=True)
def _clear_llm_cache():
    from app import llm

    llm._CACHE.clear()
    yield
    llm._CACHE.clear()


@pytest.fixture
def fake_llm(monkeypatch):
    """Turns the LLM 'on' and makes chat_json return whatever a test sets."""
    from app import llm

    state = {"reply": None, "calls": []}

    def fake_chat_json(system, messages, **kwargs):
        state["calls"].append({"system": system, "messages": messages, **kwargs})
        return state["reply"]

    monkeypatch.setattr(llm, "llm_enabled", lambda: True)
    monkeypatch.setattr(llm, "chat_json", fake_chat_json)
    return state
