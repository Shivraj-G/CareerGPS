# NaviGoa / CareerGPS production-readiness audit

Audit date: 2026-10-13  
Scope: `frontend`, `backend`, `ai-service`, `ingestion-worker`, PostgreSQL-backed integration tests, dependency and deployment configuration.

## Verdict

**Not yet deployment-ready.** The main web client builds and its regression suite passes. The backend has strong route and security coverage, but the full integration suite still has five failures caused by local catalogue/test-fixture drift. The AI Python suite could not be executed because `pytest` is not installed in the available environment. No production deployment, hosted database, real provider credentials, or end-to-end deployed smoke test was available in this workspace.

## Architecture observed

- `frontend`: React/Vite SPA, React Router, API client, local view-model utilities, Vercel SPA rewrite.
- `backend`: Node.js/Express API, PostgreSQL through `pg`, JWT authentication, Zod validation, Helmet, CORS, route-level rate limits, internal-token protected ingestion and AI calls.
- `ai-service`: FastAPI internal service. It does not write PostgreSQL; it receives verified records from Node, calls optional Gemini/Groq providers, validates/labels generated output, and has deterministic fallbacks.
- `ingestion-worker`: separate Node worker that reads approved sources through internal backend endpoints, respects robots rules, applies bounded same-host crawling/provider adapters, deduplicates candidates, and submits candidates as `needs_review`.
- `backend/migrations`: ordered SQL migrations are present through the user worktree's `024`; no migration was run by this audit.

## Evidence before repair

- Frontend build passed, but Vite reported a non-blocking large main chunk (~385 kB minified).
- Frontend initially reported two moderate React Router advisories in the installed v6 line.
- Backend baseline: 17 failures out of 301 tests.
- Worker Vitest suite: 51/51 passed; native smoke suite: 15/15 passed.
- AI service: `python -m py_compile app/main.py app/llm.py` passed; `python -m pytest -q` was blocked by `No module named pytest`.
- No Dockerfile, Compose file, CI workflow, or hosted-service deployment manifest was found in the repository scan. `frontend/vercel.json` only provides the SPA rewrite.

## Repairs made in this audit

1. `backend/src/modules/projects/project.service.js`
   - Normalized project recommendation checklists at the service boundary.
   - String tasks now become `{ order, title, description, deliverable_hint }` objects.
   - Object tasks receive a stable title fallback from `title`, `task_name`, or `name`.
   - Both `tasks` and `step_by_step_tasks` are emitted consistently for database, AI, and fallback projects.

2. `backend/src/modules/recommendations/recommendation.service.js`
   - Added deterministic ranking tie-breakers using canonical goal titles before goal score/title.
   - Prevents score caps from placing an alias such as “Contract Specialist” above the requested canonical “Lawyer”.
   - Canonicalizes alias goals such as “GIS Analyst” to the catalogue’s “Geo Analyst” when ranking tied direct matches.

3. `frontend/package.json` and `frontend/package-lock.json`
   - Upgraded `react-router-dom` to `^7.18.4` to leave the vulnerable v6 line.
   - Ran `npm audit fix`; frontend production and development dependency audits are now clean.

4. NaviGoa brand and release metadata
   - Replaced the actively loaded legacy favicon with NaviGoa mark assets at 16/32/48/180/192/512px sizes.
   - Added `frontend/public/manifest.webmanifest` and linked it from `frontend/index.html`.
   - Updated active page titles, descriptions, structured-data logo references, accessibility labels, API copy, and public AI context to NaviGoa.

5. Backend verification hardening
   - Changed the backend test script to use Vitest `--no-file-parallelism`; the database-backed suites share a local PostgreSQL fixture and produced cross-file FK/cleanup races under parallel execution.
   - Classified a three-or-fewer related-career result as a limited verified catalogue in the occupational metadata.
   - Made notification inserts race-safe around concurrent opportunity deduplication/deletion; stale opportunities are skipped without leaking PostgreSQL FK errors.

No database rows, migrations, seeds, production services, or deployment targets were changed by this audit.

## Verification after repair

- Frontend: 148 tests passed.
- Frontend: production build passed; Vite reports a non-blocking 385.24 kB minified main chunk.
- Frontend: `npm audit --omit=dev --audit-level=high` passed with 0 vulnerabilities.
- NaviGoa production preview: `/`, `/careers`, all six PNG icon endpoints, and `/manifest.webmanifest` returned successfully; browser inspection confirmed NaviGoa titles, logo alt text, menu, hero, cards, and footer.
- Backend targeted recommendation regression: 29/29 passed.
- Backend Project Studio critical suite: 25/25 passed.
- Backend full serial suite: 331/336 passed, 5 failed due to the data/fixture mismatches below.
- Backend notifications regression: 13/13 passed in isolation and passes in the serial full-suite run; parallel execution was the source of the observed FK/cleanup races.
- Backend ingestion/notification regression subset: 41/41 passed; the post-fix deduplication/pipeline subset ran 28/28 without FK error output.
- Backend syntax/config check passed after the final targeted repairs.
- Worker test and native smoke results remained green from the baseline audit.
- AI syntax compilation passed; AI behavioral suite remains blocked until the environment has the declared test dependencies installed.

## Remaining blockers

### P1: backend integration fixture/catalogue drift

The local PostgreSQL state does not match several regression assumptions:

- Assistant Professor related-career catalogue currently contains 24 verified candidates, while the regression expects a narrower fixture and limited-catalogue flag.
- `career_projects` currently has three Chef rows for the tested career ID, while the fallback test expects zero rows.
- AI Engineer currently has 19 mapped skills, while the learning regression expects seven.

These cannot be safely “fixed” by deleting rows or changing production logic. Before release, create a disposable test database and deterministic fixture/seed lifecycle, then either update the fixture expectations to the intended catalogue or revise the seed data through an explicit, reviewed migration. Do not run destructive cleanup against the current database.

### P1: AI behavioral verification unavailable

Install the locked Python test dependencies from `ai-service/requirements.txt` plus the test runner required by the project, then run the complete AI suite with provider calls mocked. Real Gemini/Groq credentials are not required for deterministic tests, but provider smoke tests require explicit credentials and network access.

### P1: deployment infrastructure is incomplete

The repository has local env examples and a Vercel SPA rewrite, but no checked-in backend/AI/worker process definitions, CI workflow, migration release job, managed PostgreSQL instructions, or deployed health-check evidence. Add these before claiming a production deployment.

### P2: performance and observability

- Split the frontend’s ~385 kB main chunk with route-level dynamic imports.
- Add CI thresholds for build size, dependency audit, backend/worker tests, Python tests, and migration validation.
- Add a real deployment smoke suite for `/`, `/api/v1/health`, authenticated API flows, internal-token boundaries, and AI fallback behavior.
- Decide and document the policy for unhandled promise rejections; the current backend logs them but keeps the process alive.

## Data and trust posture

The audited code uses parameterized PostgreSQL queries in the inspected paths, validates JWTs with HS256 and an explicit algorithm allowlist, synchronizes internal service tokens with constant-time comparison, protects admin/ingestion routes, and labels AI-generated/fallback material. The ingestion worker constrains schemes, credentials, host redirects, robots policy, response sizes, crawl depth, candidate count, and request delays. These are code-level observations; they do not replace a deployed penetration test or provider/network verification.

## Release sequence

1. Provision a disposable PostgreSQL database and run migrations from a clean state.
2. Load deterministic test fixtures; rerun the full backend suite and resolve the five catalogue/fixture discrepancies without modifying production data.
3. Install Python test dependencies and run the AI suite with mocked providers.
4. Add CI and service deployment definitions, configure secrets (`DATABASE_URL`, strong `JWT_SECRET`, `CORS_ORIGIN`, internal token, AI keys), and enforce HTTPS.
5. Deploy to staging, run smoke and browser checks at desktop and mobile widths, inspect logs/metrics, then promote only after all gates pass.
