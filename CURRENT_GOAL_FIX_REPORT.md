# CareerGPS Current Goal Fix — Implementation Report

## Root causes addressed

1. The frontend used one `classification` value as though it represented both AI fit and formal eligibility. The backend returns eligibility in the A–E vocabulary, while the AI uses separate fit classifications. That mismatch could produce misleading alignment labels.
2. The live-validation path could cache a goal before a successful response and did not consistently clear loading state after an obsolete request was cancelled. The legacy profile validator also depended on `validationData`, which could retrigger the effect and cancel the request that was being started.
3. The backend treated request-stream `close` as a client disconnect. A request stream may close after its body is read; cancellation must instead depend on whether the response was actually abandoned.
4. A goal missing from the seeded `careers` table could be returned early instead of being passed to the AI goal interpreter. Missing catalogue data therefore blocked recognition of legitimate unlisted goals.
5. AI fallback paths could return positive-looking `GREEN` / `DIRECT_FIT`-style defaults without evidence.
6. Validation used only persisted user skills in some cases, even while onboarding had a different selection in the current form. Current form skills, custom skill names, location, and study-mode preferences are now passed to the evaluator. An explicit empty skill list no longer falls back to stale saved skills.
7. The response lacked the `career_id` alias used by existing save callers; it now returns the canonical career ID under both `canonical_id` and `career_id`.

## Main changes

- `frontend/src/utils/goalValidation.js` — normalized display model separates direct eligibility status from AI pathway fit; no default “highly aligned” label.
- `frontend/src/components/onboarding/GoalValidationCard.jsx` — structured card displays goal recognition, relevant gaps, route candidates, and verification caveats.
- `frontend/src/main.jsx` and `frontend/src/pages/LegacyPages.jsx` — repaired live-validation lifecycle in onboarding and profile flows, added clear retry/error states, used the shared card, and removed outdated blocking logic based on the old meaning of `classification`.
- `frontend/src/api/client.js` — correctly classifies intentional external aborts as `CANCELLED` and covers response-body reading in the timeout window.
- `backend/src/modules/profiles/profile.routes.js` — fixed disconnect cancellation, allows AI evaluation for unlisted goal strings, handles current selected/custom skills, returns separate goal-resolution / direct-route / AI-fit fields, and preserves compatibility fields.
- `backend/src/modules/pathways/pathway.service.js` — a RED direct-route warning no longer blocks alternative-path exploration; only genuinely invalid/unsupported goals are rejected.
- `ai-service/app/main.py` — revised goal-validation instructions and output validation so the model does not claim verified eligibility, and deterministic fallback returns unknown/unverified where evidence is missing. Profile summaries include volunteered constraints when provided.
- `frontend/src/api/__tests__/goalValidation.test.mjs`, `frontend/src/api/__tests__/client.test.mjs`, `backend/tests/goal-engine-current-goal.test.js`, `ai-service/tests/test_goal_validation.py` — targeted regression tests.
- `ai-service/tests/test_llm.py` — corrected the Gemini 2.5 Flash-specific test to explicitly select the model whose thinking-budget behaviour it asserts.

## Verification performed

- Frontend Node test suite: **13 passed** (goal view-model, API client, and cancellation cases).
- AI-service pytest subset: **39 passed** (`test_goal_validation.py`, `test_main.py`, `test_llm.py`).
- Backend JavaScript syntax check: **passed** for production backend modules.
- Manual goal-engine checks: **3 passed** (High Court Judge and Backend Developer remain status E without a matching formal rule; the existing MBBS/PCB rule still evaluates to A in the fixture).
- Python compile check for `ai-service/app/main.py`: **passed**.

## Verification not completed

- A full Vite production build could not be run because frontend dependency installation failed in this environment with an npm registry DNS/network error. The JSX should be built and smoke-tested in the user's development environment before deployment.
- The backend Vitest suite and the actual endpoint against the user's PostgreSQL/AI runtime were not run here because project dependencies, environment secrets, and the user's live database are not available in this execution environment.
- The PDF's entire 50-case QA matrix has not been executed as a complete end-to-end suite. The added tests are targeted regression tests, not a claim that all 50 cases pass.

## Safe local verification

1. Back up the existing working tree.
2. Extract this archive over the project source, keeping the machine's existing `.env` files outside the archive. The archive intentionally excludes actual `.env` files and dependency folders.
3. In `backend`, install dependencies if needed and run `npm run check` and `npm test`.
4. In `ai-service`, install `requirements.txt` in the project's virtual environment and run `pytest -q tests/test_goal_validation.py tests/test_main.py tests/test_llm.py`.
5. In `frontend`, install dependencies and run `npm test` and `npm run build`.
6. Start the backend, AI service, and frontend locally. Test `Backend Developer`, `Doctor`, `High court judge`, and an unsupported phrase. Ensure the displayed result matches the latest input, the loader settles, and unsupported input never receives a fabricated positive-pathway result.
7. Review any failed tests and verify current official eligibility sources before production deployment.

The project archive omits ad-hoc debug, scratch, ping, and database-inspection scripts that contained hard-coded local database credentials, internal-service tokens, or test JWTs. The application source, formal `backend/tests`, migration/seed files, and `.env.example` templates are retained. Rotate any internal-service token that was previously committed or shared in those scripts.
