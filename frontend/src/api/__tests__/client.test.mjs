// Runs with Node's built-in test runner (no extra deps needed):
//   node --test src/api/__tests__/client.test.mjs
//
// Focused on the parts of the API client that are easy to silently break
// and hard to notice visually: how backend error responses get turned
// into messages, how the token is persisted, and that requests hit the
// right URL. These directly guard the bug this integration pass fixed
// (the client used to read `payload.message` when the backend actually
// sends `payload.error.message`, so every error banner in the app showed
// a generic fallback instead of the backend's real message).

import assert from "node:assert/strict";
import { test, beforeEach } from "node:test";

// --- minimal localStorage polyfill (Node has no global localStorage) ---
class MemoryStorage {
  constructor() { this.store = new Map(); }
  getItem(key) { return this.store.has(key) ? this.store.get(key) : null; }
  setItem(key, value) { this.store.set(key, String(value)); }
  removeItem(key) { this.store.delete(key); }
  clear() { this.store.clear(); }
}
globalThis.localStorage = new MemoryStorage();

const { api, getToken, setToken, clearToken, ApiError } = await import("../client.js");

beforeEach(() => {
  localStorage.clear();
  globalThis.fetch = async () => { throw new Error("fetch should be stubbed per-test"); };
});

function jsonResponse(status, body) {
  return {
    status,
    ok: status >= 200 && status < 300,
    text: async () => JSON.stringify(body),
  };
}

test("token helpers round-trip through localStorage", () => {
  assert.equal(getToken(), null);
  setToken("abc.def.ghi");
  assert.equal(getToken(), "abc.def.ghi");
  clearToken();
  assert.equal(getToken(), null);
});

test("a backend { error: { code, message } } response surfaces the real message and code", async () => {
  globalThis.fetch = async () => jsonResponse(422, {
    error: { code: "VALIDATION_ERROR", message: "The request contains invalid fields.", details: [{ field: "email", message: "Invalid email" }] }
  });
  await assert.rejects(
    () => api.login({ email: "not-an-email", password: "x" }),
    (err) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.status, 422);
      assert.equal(err.code, "VALIDATION_ERROR");
      // This is the exact regression this test guards against: the old
      // client read payload.message (undefined) instead of
      // payload.error.message, so this string would previously have been
      // the generic fallback instead of the backend's real message.
      assert.equal(err.message, "The request contains invalid fields.");
      assert.equal(err.details?.[0]?.field, "email");
      return true;
    }
  );
});

test("a 401 with no JSON body still gets a sensible message and status", async () => {
  globalThis.fetch = async () => ({ status: 401, ok: false, text: async () => "" });
  await assert.rejects(
    () => api.me(),
    (err) => {
      assert.equal(err.status, 401);
      assert.match(err.message, /session has expired/i);
      return true;
    }
  );
});

test("a network failure (fetch throws) is normalized to an ApiError, not a raw TypeError", async () => {
  globalThis.fetch = async () => { throw new TypeError("Failed to fetch"); };
  await assert.rejects(
    () => api.opportunities({}),
    (err) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.isNetworkError, true);
      assert.match(err.message, /unable to connect/i);
      return true;
    }
  );
});

test("a 204 No Content response resolves to null instead of throwing on empty body", async () => {
  globalThis.fetch = async () => ({ status: 204, ok: true, text: async () => "" });
  const result = await api.unsavePathway("11111111-1111-1111-1111-111111111111");
  assert.equal(result, null);
});

test("opportunities() builds the query string and hits the real path, dropping empty filters", async () => {
  let capturedUrl = null;
  globalThis.fetch = async (url) => { capturedUrl = url; return jsonResponse(200, { data: [], pagination: { page: 1, limit: 20, total: 0, total_pages: 0 } }); };
  await api.opportunities({ search: "clerk", status: "", location: undefined, page: 2 });
  assert.match(capturedUrl, /\/opportunities\?/);
  assert.match(capturedUrl, /search=clerk/);
  assert.match(capturedUrl, /page=2/);
  assert.doesNotMatch(capturedUrl, /status=/);
});

test("login() sends credentials to /auth/login and returns the parsed body as-is (no data wrapper)", async () => {
  let capturedUrl = null, capturedBody = null;
  globalThis.fetch = async (url, opts) => {
    capturedUrl = url; capturedBody = JSON.parse(opts.body);
    return jsonResponse(200, { user: { id: "u1", email: "a@b.com", role: "USER" }, accessToken: "tok123" });
  };
  const res = await api.login({ email: "a@b.com", password: "secret123" });
  assert.match(capturedUrl, /\/auth\/login$/);
  assert.deepEqual(capturedBody, { email: "a@b.com", password: "secret123" });
  assert.equal(res.accessToken, "tok123");
});

test("an authenticated request attaches the stored bearer token", async () => {
  setToken("my-token");
  let capturedHeaders = null;
  globalThis.fetch = async (url, opts) => { capturedHeaders = opts.headers; return jsonResponse(200, { data: { id: "u1" } }); };
  await api.me();
  assert.equal(capturedHeaders.Authorization, "Bearer my-token");
});
