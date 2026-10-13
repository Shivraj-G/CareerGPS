# Bug and Risk Register

## Overview
This register catalogs the findings from the comprehensive repository audit. Issues are classified by severity and domain.

---

### BUG-001: Frontend Application is Incomplete (Stubbed Routes)
- **Severity**: CRITICAL
- **Category**: Frontend / Implementation
- **Location**: `frontend/src/routes/routes.jsx`
- **Evidence**: The route configuration maps 25+ essential endpoints (e.g., `/dashboard`, `/careers`, `/profile`) to a `RoutePlaceholderPage`. Only the `FoundationPage` (`/`) is genuinely implemented.
- **Expected Behavior**: The frontend should have working React components communicating with the robust backend APIs.
- **Actual Behavior**: Navigating to almost any application route renders a placeholder.
- **Risk**: The system cannot be used by end-users despite the backend being functionally complete.
- **Recommended Fix**: Implement the UI components for the planned routes, connecting them to the respective endpoints documented in `API_INVENTORY.md`.

---

### BUG-002: Ingestion Worker Date Extraction Limitations
- **Severity**: MEDIUM
- **Category**: Ingestion / Reliability
- **Location**: `ingestion-worker/src/worker.js:123`
- **Evidence**: `published_at: null, // worker cannot determine a source's original publish date from HTML alone`
- **Expected Behavior**: The ingestion worker should accurately capture publication dates for government opportunities to verify deadlines.
- **Actual Behavior**: The worker passes `null` for `published_at` by default.
- **Risk**: Opportunity deadlines and relevance may be skewed or unverifiable.
- **Recommended Fix**: Implement heuristic-based HTML meta-tag parsing (e.g., `article:published_time`) or regex matching for common date formats in the parsed text.

---

### RISK-001: Heavy Reliance on JSONB for Relational Data
- **Severity**: MEDIUM
- **Category**: Database / Architecture
- **Location**: `backend/migrations/001_initial_schema.sql`
- **Evidence**: The `careers` table stores `responsibilities`, `qualifications`, and `entry_routes` as JSONB arrays instead of normalized relational tables.
- **Risk**: While it improves read performance by avoiding joins, it makes searching for specific qualifications or responsibilities across careers computationally expensive and difficult to index efficiently.
- **Recommended Fix**: If cross-career qualification querying becomes necessary, normalize these fields into a `career_qualifications` or `career_responsibilities` junction table.

---

### RISK-002: Hardcoded Timeout Mismatches
- **Severity**: LOW
- **Category**: Configuration
- **Location**: `backend/src/modules/careers/career.routes.js:81` and `ai-service/app/main.py:57`
- **Evidence**: Node sets hard timeouts via `AbortController` (e.g., 15s or 20s), while the AI service has its own internal budgets (e.g., `REC_BUDGET = 5.5`).
- **Risk**: If the AI service approaches the upper bounds of Node's timeout due to network latency, Node will sever the connection, leading to unhandled promise rejections or dropped responses even if the AI service successfully completes the task moments later.
- **Recommended Fix**: Ensure that the AI service budgets + latency overhead are strictly less than Node's `AbortController` timeouts. Centralize timeout configuration via environment variables.

---

### RISK-003: AI Service Token Authentication in Production
- **Severity**: HIGH
- **Category**: Security
- **Location**: `ai-service/app/main.py:50`
- **Evidence**: 
  ```python
  if ENV == "production" and not TOKEN:
      log.error("INTERNAL_SERVICE_TOKEN is required in production.")
      raise RuntimeError("INTERNAL_SERVICE_TOKEN is required in production.")
  ```
- **Risk**: If `NODE_ENV` is accidentally not set to `production` in a live environment, the AI Service will run unauthenticated, exposing potentially expensive LLM endpoints to the public.
- **Recommended Fix**: Fail fast if `INTERNAL_SERVICE_TOKEN` is missing, regardless of the environment. Require explicit opt-out for local development rather than implicit opt-in for production.

---

### RISK-004: Ingestion Worker Silent Exit on Failure
- **Severity**: LOW
- **Category**: Ingestion
- **Location**: `ingestion-worker/src/worker.js:176`
- **Evidence**: The worker uses `process.exit(1)` upon catching an error.
- **Risk**: If the worker is orchestrated by a job queue without proper error trapping or restarts, a single faulty URL will silently terminate the ingestion pipeline.
- **Recommended Fix**: Ensure the orchestrating system (e.g., cron, queue) captures the exit code and triggers alerts.
