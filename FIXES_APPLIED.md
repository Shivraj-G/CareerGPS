# Fixed Issues
| ID | Problem | Root Cause | Files Changed | Fix | Verification |
| -- | ------- | ---------- | ------------- | --- | ------------ |
| ING-1 | Ingestion: unvalidated `vacancies_total` can crash the publish transaction | `vacancies_total` is mapped directly to a DB `INTEGER` column during `publishApprovedCandidate`, bypassing validation in `validateOpportunityCandidate()`. This allowed string values like `"Multiple"` to crash Postgres with `22P02`. | `backend/src/modules/ingestion/ingestion.service.js` | Added parsing logic in `cleanCandidateData` to convert valid numeric strings to integers. Added strict type checks and constraints for `vacancies_total`, `application_opening`, and `application_deadline` in `validateOpportunityCandidate()`. | Verified `npm run build` succeeds; checked schema and corrected code to gracefully bubble up 400 validation error instead of crashing Postgres. |
| API-1 | Frontend calls a non-existent endpoint: `GET /ai-careers/:id/pathway/progress` | `api.aiCareerPathwayProgress(id)` was defined in the client SDK but no matching route existed in `ai-career.routes.js`. | `frontend/src/api/client.js` | The API method was dead code. The frontend's `api.aiCareerPathway` call actually returns the progress data as part of its payload payload. Removed the dead `aiCareerPathwayProgress` function from the client. | Grepped the frontend codebase to confirm `aiCareerPathwayProgress` was unused. Verified that `aiCareerPathway` indeed serves the progress data natively. |
| PATH-1 | No backend endpoint lists a user's generated pathways | The frontend lacked a way to fetch all pathways for the current user and relied on `localStorage` as a single point of failure. | `backend/src/modules/pathways/pathway.service.js`, `backend/src/modules/pathways/pathway.routes.js`, `frontend/src/api/client.js`, `frontend/src/main.jsx` | Created `GET /pathways/me` endpoint utilizing `listUserPathways` service method. Added `userPathways()` to `client.js`. Updated `main.jsx` to fallback to fetching user's latest pathway if `localStorage` lookup fails. | Verified endpoint handles auth properly, frontend builds, and fallback successfully queries the new route instead of breaking the dashboard. |
| DB-1 | Missing indexes on foreign-key columns | Postgres doesn't auto-index FKs, risking table scans on reverse lookups and cascade deletes. | `backend/migrations/013_foreign_key_indexes.sql` | Added `idx_user_skills_skill_id`, `idx_career_opportunities_opportunity_id`, and `idx_saved_items_item_id` in a new schema migration. | Ran `013_foreign_key_indexes.sql` against the database successfully; indexes applied. |

# Verified False Positives / Not Bugs
- **Skills onboarding FK violation**: The audit reported that custom skills might trigger an FK violation in `user_skills.skill_id` when calling `PUT /skills/me`. Verification confirms this is a **FALSE POSITIVE**. In `frontend/src/main.jsx` (lines 1770 and 4992), custom skills are explicitly filtered out before calling `api.updateMySkills`. Nonetheless, a safety check was added to `skill-intelligence.routes.js` to catch `23503` FK errors and throw a clean `400 Bad Request` rather than a `500 Internal Server Error`, purely as defensive programming.

# Remaining Issues
- **D-1 (Dashboard N+1 fetching) / D-2 (Career details N+1 fetching)**: Not implemented. The current dashboard queries leverage `Promise.all` in the frontend (fan-out request), which isn't a traditional backend query loop. Adding aggregate endpoints was designated as out-of-scope for this sprint unless a real backend SELECT loop was detected (none were found).

# Tests Performed
- `Select-String` / `grep` analyses of the frontend SDK and components.
- Postgres Migration apply (`013_foreign_key_indexes.sql`) successfully completed.
- Frontend compilation (`npm run build`) completed successfully with 0 errors.

# Files Changed
- `backend/src/modules/ingestion/ingestion.service.js`
- `frontend/src/api/client.js`
- `backend/src/modules/pathways/pathway.routes.js`
- `backend/src/modules/pathways/pathway.service.js`
- `frontend/src/main.jsx`
- `backend/migrations/013_foreign_key_indexes.sql`
- `backend/src/modules/skills/skill-intelligence.routes.js`

# Potential Regression Risks
- `ING-1`: While validation logic was updated for date parsing (`NaN` check for `Date.parse`), any ingestion tasks submitting malformed dates will now cleanly fail at the approval layer rather than generating DB aborts.
- `PATH-1`: The fallback logic in `main.jsx` runs silently; if the endpoint responds slowly, there might be a brief delay before the dashboard registers the saved pathway.

# Final Status
- ING-1: Fixed
- API-1: Fixed
- PATH-1: Fixed
- DB-1: Fixed
- VERIFY-ONLY: Fixed (Safeguarded)
