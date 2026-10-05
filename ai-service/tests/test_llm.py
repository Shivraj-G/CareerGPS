"""Offline tests for llm.py. No network: httpx.post is replaced with a fake."""
import httpx
import pytest

from app import llm


class FakeResponse:
    def __init__(self, status_code=200, payload=None, text=""):
        self.status_code = status_code
        self._payload = payload
        self.text = text or str(payload)

    def json(self):
        if self._payload is None:
            raise ValueError("no json")
        return self._payload


def gemini_ok(text):
    return FakeResponse(200, {"candidates": [{"content": {"parts": [{"text": text}]}}]})


def groq_ok(text):
    return FakeResponse(200, {"choices": [{"message": {"content": text}}]})


@pytest.fixture
def keys(monkeypatch):
    def setup(**values):
        for name in ("LLM_PROVIDER", "LLM_FALLBACK_PROVIDER", "GEMINI_API_KEY", "GOOGLE_API_KEY", "GROQ_API_KEY"):
            monkeypatch.delenv(name, raising=False)
        for name, value in values.items():
            monkeypatch.setenv(name, value)
    return setup


# ---- provider selection ----------------------------------------------------

def test_no_keys_means_llm_disabled(keys):
    keys()
    assert llm.provider_chain() == [] and llm.llm_enabled() is False
    assert llm.chat_json("sys", [{"role": "user", "content": "hi"}]) is None


def test_provider_none_disables_even_when_keys_exist(keys):
    keys(LLM_PROVIDER="none", GEMINI_API_KEY="k")
    assert llm.llm_enabled() is False


def test_chain_order_follows_config_and_skips_providers_without_keys(keys):
    keys(LLM_PROVIDER="gemini", LLM_FALLBACK_PROVIDER="groq", GEMINI_API_KEY="g", GROQ_API_KEY="q")
    assert llm.provider_chain() == ["gemini", "groq"]
    keys(LLM_PROVIDER="gemini", LLM_FALLBACK_PROVIDER="groq", GROQ_API_KEY="q")
    assert llm.provider_chain() == ["groq"]  # no gemini key -> skipped


def test_auto_detects_provider_from_available_keys(keys):
    keys(GROQ_API_KEY="q")
    assert llm.provider_chain() == ["groq"]


# ---- Gemini adapter --------------------------------------------------------

def test_gemini_success_parses_text_and_sends_key_in_header_not_url(keys, monkeypatch):
    keys(LLM_PROVIDER="gemini", GEMINI_API_KEY="SECRET-G")
    seen = {}

    def fake_post(url, headers=None, json=None, timeout=None):
        seen.update(url=url, headers=headers, body=json)
        return gemini_ok('{"answer": "hi"}')

    monkeypatch.setattr(httpx, "post", fake_post)
    parsed = llm.chat_json("system text", [{"role": "user", "content": "hello"}])
    assert parsed == {"answer": "hi"}
    assert "SECRET-G" not in seen["url"]
    assert seen["headers"]["x-goog-api-key"] == "SECRET-G"
    assert seen["body"]["systemInstruction"]["parts"][0]["text"] == "system text"
    assert seen["body"]["generationConfig"]["responseMimeType"] == "application/json"
    assert seen["body"]["generationConfig"]["thinkingConfig"] == {"thinkingBudget": 0}  # flash: no slow thinking


def test_gemini_maps_assistant_role_to_model_role(keys, monkeypatch):
    keys(LLM_PROVIDER="gemini", GEMINI_API_KEY="g")
    seen = {}
    monkeypatch.setattr(httpx, "post", lambda url, headers=None, json=None, timeout=None: (seen.update(body=json), gemini_ok("{}"))[1])
    llm.chat_json("s", [{"role": "user", "content": "a"}, {"role": "assistant", "content": "b"}, {"role": "user", "content": "c"}])
    assert [c["role"] for c in seen["body"]["contents"]] == ["user", "model", "user"]


# ---- Groq adapter + fallback chain -----------------------------------------

def test_groq_success_uses_bearer_auth_and_system_message(keys, monkeypatch):
    keys(LLM_PROVIDER="groq", GROQ_API_KEY="SECRET-Q")
    seen = {}

    def fake_post(url, headers=None, json=None, timeout=None):
        seen.update(url=url, headers=headers, body=json)
        return groq_ok('{"reasoning": "ok"}')

    monkeypatch.setattr(httpx, "post", fake_post)
    assert llm.chat_json("sys", [{"role": "user", "content": "hi"}]) == {"reasoning": "ok"}
    assert seen["headers"]["authorization"] == "Bearer SECRET-Q"
    assert seen["body"]["messages"][0] == {"role": "system", "content": "sys"}


def test_falls_back_to_groq_when_gemini_is_rate_limited(keys, monkeypatch):
    keys(LLM_PROVIDER="gemini", LLM_FALLBACK_PROVIDER="groq", GEMINI_API_KEY="g", GROQ_API_KEY="q")
    calls = []

    def fake_post(url, headers=None, json=None, timeout=None):
        calls.append(url)
        if "googleapis" in url:
            return FakeResponse(429, None, "quota exceeded")
        return groq_ok('{"ok": true}')

    monkeypatch.setattr(httpx, "post", fake_post)
    assert llm.chat_json("s", [{"role": "user", "content": "hi"}]) == {"ok": True}
    assert len(calls) == 2 and "googleapis" in calls[0] and "groq" in calls[1]


def test_returns_none_when_every_provider_fails(keys, monkeypatch):
    keys(LLM_PROVIDER="gemini", LLM_FALLBACK_PROVIDER="groq", GEMINI_API_KEY="g", GROQ_API_KEY="q")
    monkeypatch.setattr(httpx, "post", lambda *a, **k: FakeResponse(500, None, "boom"))
    assert llm.chat_json("s", [{"role": "user", "content": "hi"}]) is None


def test_timeouts_and_network_errors_become_none_not_exceptions(keys, monkeypatch):
    keys(LLM_PROVIDER="gemini", GEMINI_API_KEY="g")

    def boom(*args, **kwargs):
        raise httpx.ConnectTimeout("slow")

    monkeypatch.setattr(httpx, "post", boom)
    assert llm.chat_json("s", [{"role": "user", "content": "hi"}]) is None


def test_gemini_safety_block_is_handled(keys, monkeypatch):
    keys(LLM_PROVIDER="gemini", GEMINI_API_KEY="g")
    monkeypatch.setattr(httpx, "post", lambda *a, **k: FakeResponse(200, {"promptFeedback": {"blockReason": "SAFETY"}}))
    assert llm.chat_json("s", [{"role": "user", "content": "hi"}]) is None


def test_api_key_never_appears_in_error_logs(keys, monkeypatch, caplog):
    keys(LLM_PROVIDER="gemini", GEMINI_API_KEY="TOP-SECRET-KEY")
    monkeypatch.setattr(httpx, "post", lambda *a, **k: FakeResponse(403, None, "forbidden"))
    with caplog.at_level("INFO", logger="careergps.llm"):
        llm.chat_json("s", [{"role": "user", "content": "hi"}])
    assert "TOP-SECRET-KEY" not in caplog.text


# ---- JSON extraction --------------------------------------------------------

@pytest.mark.parametrize("text,expected", [
    ('{"a": 1}', {"a": 1}),
    ('```json\n{"a": 1}\n```', {"a": 1}),
    ('Sure! Here you go: {"a": 1} hope that helps', {"a": 1}),
    ("not json at all", None),
    ("[1, 2, 3]", None),
    ("", None),
    (None, None),
])
def test_parse_json_object(text, expected):
    assert llm.parse_json_object(text) == expected


def test_non_json_model_output_returns_none(keys, monkeypatch):
    keys(LLM_PROVIDER="gemini", GEMINI_API_KEY="g")
    monkeypatch.setattr(httpx, "post", lambda *a, **k: gemini_ok("I am sorry, I cannot do that."))
    assert llm.chat_json("s", [{"role": "user", "content": "hi"}]) is None


# ---- message normalisation --------------------------------------------------

def test_normalize_messages_merges_same_roles_and_fixes_start_and_end():
    out = llm._normalize_messages([
        {"role": "assistant", "content": "leading assistant"},
        {"role": "user", "content": "a"}, {"role": "user", "content": "b"},
        {"role": "assistant", "content": "c"}, {"role": "user", "content": ""},
    ])
    assert out == [{"role": "user", "content": "a\n\nb"}]


# ---- cache ------------------------------------------------------------------

def test_cache_round_trip_and_key_is_order_independent():
    llm._CACHE.clear()
    key = llm.cache_key("x", {"b": 1, "a": 2})
    assert key == llm.cache_key("x", {"a": 2, "b": 1})
    assert llm.cache_get(key) is None
    llm.cache_set(key, "value")
    assert llm.cache_get(key) == "value"


def test_ping_reports_disabled_without_keys(keys):
    keys()
    assert llm.ping()["ok"] is False