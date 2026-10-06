"""Thin, provider-agnostic LLM client for the CareerGPS AI service.

Design rules (why this file looks the way it does):
- The AI service must NEVER break the website. Every function here returns None
  (or raises LLMError internally) on any failure, and main.py falls back to the
  deterministic logic. Node only waits 8s (15s for the assistant), so every call
  runs against a hard time budget.
- Providers are tried in order (LLM_PROVIDER, then LLM_FALLBACK_PROVIDER). A 429
  or timeout on Gemini transparently moves on to Groq.
- API keys are read from the environment only, are never logged, and never leave
  this service.
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import time
from collections import OrderedDict
from typing import Any

import httpx

log = logging.getLogger("careergps.llm")

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"


class LLMError(Exception):
    """Any provider/network/parse failure. Always handled by falling back."""


# ---------------------------------------------------------------------------
# Configuration (read at call time so env changes / tests take effect)
# ---------------------------------------------------------------------------

def _env(name: str, default: str = "") -> str:
    return (os.getenv(name) or default).strip()


def _api_key(provider: str) -> str:
    if provider == "gemini":
        return _env("GEMINI_API_KEY") or _env("GOOGLE_API_KEY")
    if provider == "groq":
        return _env("GROQ_API_KEY")
    return ""


def model_name(provider: str) -> str:
    if provider == "gemini":
        return _env("GEMINI_MODEL", "gemini-3.8-flash")
    return _env("GROQ_MODEL", "llama3-8b-8192")


def provider_chain() -> list[str]:
    """Ordered list of usable providers (only those that have an API key)."""
    primary = _env("LLM_PROVIDER").lower()
    if primary == "none":
        return []
    fallback = _env("LLM_FALLBACK_PROVIDER").lower()
    if primary:
        order = [primary, fallback]
    else:  # auto-detect from whichever keys are present
        order = ["gemini", "groq", fallback]
    chain: list[str] = []
    for name in order:
        if name in ("gemini", "groq") and name not in chain and _api_key(name):
            chain.append(name)
    return chain


def llm_enabled() -> bool:
    return bool(provider_chain())


# ---------------------------------------------------------------------------
# HTTP + provider adapters
# ---------------------------------------------------------------------------

def _post(url: str, headers: dict[str, str], payload: dict[str, Any], timeout: float) -> dict[str, Any]:
    try:
        response = httpx.post(
            url,
            headers=headers,
            json=payload,
            timeout=httpx.Timeout(timeout, connect=min(timeout, 4.0)),
        )
    except httpx.TimeoutException as exc:
        raise LLMError(f"timeout after {timeout:.1f}s") from exc
    except httpx.HTTPError as exc:
        raise LLMError(f"network error: {type(exc).__name__}") from exc
    if response.status_code != 200:
        raise LLMError(f"HTTP {response.status_code}: {response.text[:300]}")
    try:
        return response.json()
    except ValueError as exc:
        raise LLMError("provider returned invalid JSON") from exc


def _normalize_messages(messages: list[dict[str, Any]]) -> list[dict[str, str]]:
    """Merge consecutive same-role turns, start with a user turn, end with a user turn."""
    out: list[dict[str, str]] = []
    for message in messages:
        role = "assistant" if message.get("role") == "assistant" else "user"
        text = str(message.get("content") or "").strip()
        if not text:
            continue
        if out and out[-1]["role"] == role:
            out[-1]["content"] += "\n\n" + text
        else:
            out.append({"role": role, "content": text})
    while out and out[0]["role"] != "user":
        out.pop(0)
    while out and out[-1]["role"] != "user":
        out.pop()
    return out


def _call_gemini(system: str, messages: list[dict[str, str]], json_mode: bool,
                 max_tokens: int, temperature: float, timeout: float) -> str:
    model = model_name("gemini")
    generation: dict[str, Any] = {"temperature": temperature, "maxOutputTokens": max_tokens}
    if json_mode:
        generation["responseMimeType"] = "application/json"
    # Gemini 2.5 Flash "thinks" by default, which adds seconds of latency we can't afford
    # inside Node's 8s timeout. (Pro models cannot disable thinking, so only touch Flash.)
    if model.startswith("gemini-2.5-flash"):
        generation["thinkingConfig"] = {"thinkingBudget": 0}
    payload = {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": [
            {"role": "model" if m["role"] == "assistant" else "user", "parts": [{"text": m["content"]}]}
            for m in messages
        ],
        "generationConfig": generation,
    }
    data = _post(
        GEMINI_URL.format(model=model),
        {"content-type": "application/json", "x-goog-api-key": _api_key("gemini")},
        payload,
        timeout,
    )
    try:
        parts = data["candidates"][0]["content"]["parts"]
        text = "".join(part.get("text", "") for part in parts)
    except (KeyError, IndexError, TypeError) as exc:
        reason = (data.get("promptFeedback") or {}).get("blockReason") if isinstance(data, dict) else None
        raise LLMError(f"gemini returned no candidate{f' (blocked: {reason})' if reason else ''}") from exc
    if not text.strip():
        raise LLMError("gemini returned empty text")
    return text


def _call_groq(system: str, messages: list[dict[str, str]], json_mode: bool,
               max_tokens: int, temperature: float, timeout: float) -> str:
    model = model_name("groq")
    body: dict[str, Any] = {
        "model": model,
        "messages": [{"role": "system", "content": system}] + messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if "gpt-oss" in model:
        # reasoning models spend output tokens on thinking: keep it short, leave headroom
        body["reasoning_effort"] = "low"
        body["max_tokens"] = max_tokens + 600
    headers = {"content-type": "application/json", "authorization": f"Bearer {_api_key('groq')}"}

    def run(with_json_format: bool) -> str:
        payload = dict(body)
        if with_json_format:
            payload["response_format"] = {"type": "json_object"}
        data = _post(GROQ_URL, headers, payload, timeout)
        try:
            text = data["choices"][0]["message"]["content"] or ""
        except (KeyError, IndexError, TypeError) as exc:
            raise LLMError("groq returned no choices") from exc
        if not text.strip():
            raise LLMError("groq returned empty text")
        return text

    try:
        return run(json_mode)
    except LLMError as exc:
        # some models reject response_format; the prompt already demands JSON, so retry plain
        if json_mode and str(exc).startswith("HTTP 400"):
            return run(False)
        raise


ADAPTERS = {"gemini": _call_gemini, "groq": _call_groq}


# ---------------------------------------------------------------------------
# Public helpers
# ---------------------------------------------------------------------------

def generate(system: str, messages: list[dict[str, Any]], *, json_mode: bool, max_tokens: int,
             temperature: float, budget: float) -> str | None:
    """Try each configured provider within a shared time budget. None on total failure."""
    chain = provider_chain()
    if not chain:
        return None
    normalized = _normalize_messages(messages)
    if not normalized:
        return None
    deadline = time.monotonic() + budget
    for index, name in enumerate(chain):
        remaining = deadline - time.monotonic()
        if remaining < 1.0:
            break
        has_more = index < len(chain) - 1
        attempt_timeout = remaining * 0.7 if has_more else remaining  # leave room for the fallback
        started = time.monotonic()
        try:
            text = ADAPTERS[name](system, normalized, json_mode, max_tokens, temperature, attempt_timeout)
            log.info("llm ok provider=%s model=%s ms=%d", name, model_name(name), (time.monotonic() - started) * 1000)
            return text
        except LLMError as exc:
            log.warning("llm failed provider=%s model=%s: %s", name, model_name(name), str(exc)[:200])
    return None


def parse_json_object(text: str | None) -> dict[str, Any] | None:
    if not text:
        return None
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip(), flags=re.IGNORECASE).strip()
    try:
        value = json.loads(cleaned)
    except ValueError:
        start, end = cleaned.find("{"), cleaned.rfind("}")
        if start == -1 or end <= start:
            return None
        try:
            value = json.loads(cleaned[start:end + 1])
        except ValueError:
            return None
    return value if isinstance(value, dict) else None


def chat_json(system: str, messages: list[dict[str, Any]], *, max_tokens: int = 900,
              temperature: float = 0.3, budget: float = 6.0) -> dict[str, Any] | None:
    text = generate(system, messages, json_mode=True, max_tokens=max_tokens,
                    temperature=temperature, budget=budget)
    parsed = parse_json_object(text)
    if text and parsed is None:
        log.warning("llm returned non-JSON output (first 120 chars): %r", text[:120])
    return parsed


def ping() -> dict[str, Any]:
    """Tiny live check of every configured provider (used by GET /internal/v1/llm/ping)."""
    chain = provider_chain()
    if not chain:
        return {"ok": False, "error": "no LLM provider configured (set LLM_PROVIDER and an API key)"}
    results = []
    for name in chain:
        started = time.monotonic()
        try:
            text = ADAPTERS[name]("Reply with the single word: pong",
                                  [{"role": "user", "content": "ping"}], False, 16, 0.0, 10.0)
            results.append({"provider": name, "model": model_name(name), "ok": True,
                            "latency_ms": int((time.monotonic() - started) * 1000), "sample": text.strip()[:40]})
        except LLMError as exc:
            results.append({"provider": name, "model": model_name(name), "ok": False, "error": str(exc)[:240]})
    return {"ok": any(item["ok"] for item in results), "providers": results}


# ---------------------------------------------------------------------------
# Tiny in-memory cache (eligibility explanations are requested on every GET)
# ---------------------------------------------------------------------------

_CACHE: "OrderedDict[str, tuple[float, Any]]" = OrderedDict()


def cache_key(*parts: Any) -> str:
    return hashlib.sha256(json.dumps(parts, sort_keys=True, default=str).encode()).hexdigest()


def cache_get(key: str, ttl: float = 3600.0) -> Any | None:
    hit = _CACHE.get(key)
    if not hit:
        return None
    stored_at, value = hit
    if time.monotonic() - stored_at > ttl:
        _CACHE.pop(key, None)
        return None
    _CACHE.move_to_end(key)
    return value


def cache_set(key: str, value: Any, max_items: int = 256) -> None:
    _CACHE[key] = (time.monotonic(), value)
    _CACHE.move_to_end(key)
    while len(_CACHE) > max_items:
        _CACHE.popitem(last=False)
