# CareerGPS — Frontend ↔ Backend API Integration Map

This document reflects the **actual backend source code** (`backend/src/modules/**`,
`backend/src/middleware/**`, `backend/migrations/*.sql`), not the placeholder
endpoint list from the original brief. Where the two disagreed, the backend
source won. Everything below was read from the backend, not guessed.

## Global contract

- Base path: `/api/v1` (mounted in `backend/src/app.js`).
- Success (single object): `{ "data": { ... } }`
- Success (paginated list — careers, pathway templates, opportunities):
  `{ "data": [...], "pagination": { "page", "limit", "total", "total_pages" } }`
- Success (plain list — skills, institutions, courses, career sub-resources):
  `{ "data": [...] }`
- **Error (always):** `{ "error": { "code": "...", "message": "...", "details"?: [...] } }`
  — never `{ "message": "..." }`. The original frontend read `payload.message`,
  which is always `undefined` against this backend; every error banner in the
  app showed a generic fallback instead of the real message. Fixed in
  `src/api/client.js`.
- Auth: `Authorization: Bearer <accessToken>` (HS256 JWT, claims `sub` = user id,
  `role` = `USER | ADMIN | REVIEWER`). Enforced by `middleware/authenticate.js`.
- CORS: `cors({ origin: env.CORS_ORIGIN, credentials: true })`, and
  `CORS_ORIGIN` defaults to `http://localhost:5173` (Vite's default dev port) —
  confirm the deployed backend's `CORS_ORIGIN` matches wherever this frontend
  is actually served from.

## Authentication

| Method | Endpoint | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/auth/register` | none | `{ email, password, role?: 'USER' }` (strict — no other keys, no `name`) | 201 `{ user: {...}, accessToken }` |
| POST | `/auth/login` | none | `{ email, password }` | 200 `{ user: {...}, accessToken }` |

- `user` = `{ id, email, role, account_status, created_at, updated_at }`.
- **There is no `name`/`full_name` field anywhere in the schema** (not in
  register, not in `/users/me`, not in the profile). The signup form still
  collects a "Full name" for a nicer UI, but it is stored client-side only
  (`localStorage`) and never sent to the backend.
- The token field is **`accessToken`**, not `token` or `access_token`.
- Rate-limited: 20 requests / 15 min per IP on both routes.
- Register on a duplicate email → 409 `EMAIL_ALREADY_EXISTS`.

## Current user

| Method | Endpoint | Auth | Response |
|---|---|---|---|
| GET | `/users/me` | required | `{ data: { id, email, role, account_status, created_at, updated_at } }` |

## Profile

| Method | Endpoint | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/profiles/me` | required | — | `{ data: profile }` |
| PUT | `/profiles/me` | required | see below | `{ data: profile }` |
| GET | `/profiles/me/completeness` | required | — | `{ data: { completed_fields, total_fields, percentage, missing_fields } }` |

`profileSchema` (strict — extra keys rejected):
```
{
  education?: [{ qualification: string(1-200), status: string(1-50), year?: int }],
  skills?: [{ name: string(1-150), level?: 'beginner'|'intermediate'|'advanced'|'expert'|'unknown', years_experience?: number }],
  experience?: [object],           // free-form objects, no fixed shape
  interests?: [string],
  preferred_locations?: [string],
  career_goal?: string(max 250) | null,
  constraints?: object             // free-form
}
```
`profile` (GET response) = `{ id, education, experience, interests, preferred_locations, career_goal, constraints, profile_status, created_at, updated_at, skills: [{ name, level, years_experience, verified }] }`.

There is **no `target_career_id` / linked-career field** on the profile —
`career_goal` is free text only.

## Careers (public)

| Method | Endpoint | Query | Response |
|---|---|---|---|
| GET | `/careers` | `search?, page?, limit?(max 50)` | paginated list |
| GET | `/careers/:careerId` | — | `{ data: career }` |
| GET | `/careers/:careerId/skills` | — | `{ data: [{ id, name, description, importance }] }` |
| GET | `/careers/:careerId/courses` | — | `{ data: [{ id, title, course_type, qualification, duration_text, mode, location, subject, fees_text, institution_id, institution_name }] }` |
| GET | `/careers/:careerId/pathways` | — | `{ data: [{ id, title, description, record_status, verification_status, source_url, verified_at }] }` |
| GET | `/careers/:careerId/opportunities` | — | `{ data: [opportunity summaries] }` |
| GET | `/careers/:careerId/related` | — | `{ data: [{ id, title, description }] }` |
| GET | `/careers/:careerId/sources` | — | `{ data: [source evidence rows] }` |

`career` = `{ id, title, description, responsibilities: [string], qualifications: [string], entry_routes: [string], verification_status, source_url, source_document_url, source_last_checked_at, verified_at }`.

**There is no `industry`, `location`, `salary`, `growth`, or `career_type`
field on careers, and `/careers` has no filter for any of those** — the only
query params are `search`, `page`, `limit`. The original brief's "Explore
careers" screenshot (industry/location/career-type filters) does not match
what the backend can actually filter on. The rebuilt Careers page only
offers keyword search and says so explicitly in the UI rather than drawing
non-functional filter controls.

## Skills

| Method | Endpoint | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/skills` | none | `?search=` | `{ data: [{ id, name, description, category }] }` |
| GET | `/skills/me` | required | — | `{ data: [{ id, name, description, level, years_experience, verified }] }` |
| PUT | `/skills/me` | required | `{ skills: [{ skill_id (uuid), level?, years_experience?, verified? }] }` | `{ data: [...] }` |
| POST | `/skills/gap-analysis` | required | `{ target_career_id (uuid) }` | `{ data: { target_career_id, career_title, matched_skills: [{skill_id, skill, level, importance}], missing_skills: [{skill_id, skill, importance}] } }` |

This is the real backend capability behind **"is this career for you?"** —
there is no career-level eligibility endpoint. The rebuilt Career Detail page
links to `/skill-gap?career=<id>`, which calls this, instead of the
originally-wired (and wrong) `POST /eligibility/check` with a `career_id`.

## Recommendations

| Method | Endpoint | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/recommendations/careers` | required | `{ goal?, preferred_locations?, constraints? }` | 201 `{ data: { recommendation_id, results: [...] } }` |
| GET | `/recommendations/:recommendationId` | required (owner only) | — | `{ data: { id, goal, preferences, results, status, created_at } }` |
| POST | `/recommendations/:recommendationId/feedback` | required (owner only) | `{ rating: 'helpful'|'not_helpful', comment?: string(max 1000) }` | 201 `{ data: { saved: true } }` |

`results` is whatever the AI service returns, passed through as opaque JSON
by `recommendation.routes.js` — the backend does not itself define its
shape. `src/api/client.js`/`main.jsx` normalize a few likely field names
(`career_id`/`careerId`/`id`, `title`/`career_title`/`name`, etc.) rather than
assuming one. If the AI service (`AI_SERVICE_URL`) isn't configured, this
endpoint returns 503 `AI_SERVICE_UNAVAILABLE` — surfaced as a normal error in
the UI, not a silent failure.

The "Find careers for me" button (previously a static, unwired button) now
calls this endpoint for real and shows results + a helpful/not-helpful
feedback control.

## Pathways

| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| GET | `/pathways` | none | **Public template catalogue** — `?search, career_id, page, limit`. This is *not* "the current user's pathways". |
| GET | `/pathways/:pathwayId` | none | One template, with its `steps`. |
| GET | `/pathways/:pathwayId/steps` | none | Just the steps array. |
| POST | `/pathways/generate` | required | `{ pathway_id? (uuid), career_id? (uuid), goal?, preferences? }` — one of `pathway_id`/`career_id` required. Returns the new personalized pathway incl. `steps` (status `not_started`) and `pathway_id` (the template it came from). |
| GET | `/pathways/generated/:userPathwayId` | required (owner) | Full personalized pathway: `{ id, user_id, pathway_id, title, status, career_id, career_title, steps: [{id, pathway_step_id, step_order, title, description, step_type, status, started_at, completed_at, notes}], ... }` |
| GET | `/pathways/:pathwayId/progress` | required | Accepts **either** a `user_pathway` id or a template `pathway_id`. Returns `{ user_pathway_id, status, steps }` (no `pathway_id` — use `/generated/:id` if you need that). |
| POST | `/pathways/:pathwayId/progress` | required | `{ steps: [{ pathway_step_id (uuid), status: 'not_started'\|'in_progress'\|'completed', notes? }] }` |
| POST | `/pathways/:pathwayId/save` | required | Saves the **template** pathway (by its own id) to `saved_items`. 201 `{ saved: true, pathway_id }` |
| DELETE | `/pathways/:pathwayId/save` | required | 204 |

### Backend gap: no "list my pathways" endpoint

There is no route that returns "every pathway the current user has
generated". The only ways to reach a personalized pathway are: (a) you just
generated it and have the response in hand, or (b) you already know its
`user_pathway_id` or its template `pathway_id`. There's also no `saved` flag
ever returned by any route in practice — `getPathway()` in
`pathway.service.js` accepts an optional `userId` to populate a `saved`
field, but every route that calls it (`GET /pathways/:pathwayId`) calls it
with a single argument, so `saved` is always `undefined` in every real
response.

**Workaround used in this frontend (not a fabricated backend route):** after
generating or opening a pathway, its `user_pathway_id` is remembered in
`localStorage`, scoped to the logged-in user and (optionally) the career it
was generated for (`getLastPathwayId` / `setLastPathwayId` in `main.jsx`).
The Pathway page and Dashboard use that remembered id to re-fetch the
pathway via `GET /pathways/generated/:id` on reload, and fall back to
generating a fresh one if the remembered id is stale (404) or was never set.
The "Save" button on the Pathway page calls the real save/unsave endpoints
against the template `pathway_id`, but because the backend never reports
back whether something is saved, the UI's saved/unsaved toggle is optimistic
client-side state for the current session, not a persisted read.

**This should be closed on the backend** with a real
`GET /users/me/pathways` (or similar) list endpoint, and by actually passing
`req.user?.id` into `getPathway()` from the public route so `saved` is
populated when a token is present.

## Eligibility (opportunity-scoped, not career-scoped)

| Method | Endpoint | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/eligibility/check` | required | `{ opportunity_id (uuid) }` | 201 `{ data: { id, user_id, opportunity_id, outcome, results, evaluated_at, opportunity, explanation? } }` |
| GET | `/eligibility/checks/:checkId` | required (owner) | — | `{ data: {...} }` |

`outcome` ∈ `meets_listed_requirements | does_not_meet_listed_requirements | unable_to_determine`.
`results[]` = `{ requirement_id, requirement_type, requirement_text, status: 'satisfied'|'not_satisfied'|'unable_to_determine', reason?, source_url, source_document_url }`.
`explanation` is an optional AI-generated string (only present if `AI_SERVICE_URL` is configured and reachable).

**This checks a single opportunity's structured requirements, not "is this
career for me".** The original frontend called this with `{ career_id }`,
which fails the endpoint's own `z.object({ opportunity_id: z.string().uuid() }).strict()`
validation outright — it's a different concept from a different table
(`opportunity_requirements`, tied to specific job/exam postings, not
careers). This is now correctly wired from the new **Opportunity Detail**
page, not from the career guide (which uses skill-gap analysis instead —
see above).

## Opportunities (public)

| Method | Endpoint | Query | Response |
|---|---|---|---|
| GET | `/opportunities` | `search?, status?('upcoming'\|'open'\|'closed'\|'cancelled'\|'unknown'), opportunity_type?, location?, career_id?(uuid), page?, limit?(max 50)` | paginated list |
| GET | `/opportunities/:opportunityId` | — | `{ data: { ...fields, requirements: [...], related_careers: [{career_id, title, relation_type}] } }` |
| GET | `/opportunities/:opportunityId/requirements` | — | `{ data: { opportunity: {...}, requirements: [...] } }` |

This matches the brief's guessed field list closely — `search`, `status`,
`opportunity_type`, `location`, `career_id`, `page`, `limit` are all real.
`career_id` filters by an opportunity's linked careers (existence check
against `career_opportunities`).

`normalizeOpportunity()` maps: `title, organization → org, opportunity_type → type, location, application_deadline → deadline, status, description, vacancies_total, advertisement_number, source_url, verification_status`.

A **"Closing soon" toggle** on the Opportunities page is a real client-side
filter over the real `application_deadline` field (≤ 30 days out), not a
separate backend endpoint — there's no server-side "closing soon" filter.

## Institutions (public)

| Method | Endpoint | Query | Response |
|---|---|---|---|
| GET | `/institutions` | `search?` | `{ data: [{ id, name, description, location, website_url, verification_status, source_url, ... }] }` |
| GET | `/institutions/:institutionId` | — | `{ data: {...} }` |

**This genuinely exists on the backend.** The original frontend hardcoded
three institutions (Goa College of Engineering, Don Bosco College, ITI
Panaji) as a static array with a comment saying no backend endpoint existed
— that assumption was wrong. The Institutions page and a new Institution
Detail page (`/institutions/:id`) now call this for real.

## Courses (public)

| Method | Endpoint | Query | Response |
|---|---|---|---|
| GET | `/courses` | `search?, mode?('online'\|'offline'\|'hybrid'), location?` | `{ data: [{ id, title, course_type, qualification, duration_text, mode, location, subject, fees_text, institution_id, institution_name, ... }] }` (max 100 rows, no pagination) |
| GET | `/courses/:courseId` | — | `{ data: {...} }` |
| GET | `/courses/:courseId/eligibility` | — | `{ data: [{ id, rule_type, rule_data, verification_status, source_url }] }` |

**There is no `course_type` query filter** — only `search`, `mode`, and
`location`. Course browsing in this frontend currently happens per-career
(the Career Detail "Courses" tab, via `/careers/:id/courses`); a dedicated
course-search UI on the Institutions page is a reasonable next addition but
wasn't built out further to keep this pass focused, since `client.js`
already exposes `api.courses()` / `api.course()` / `api.courseEligibility()`
for it.

## Assistant

`POST /assistant/chat`, `GET/DELETE /assistant/conversations[/:id]` all
exist, are correctly wired in `src/api/client.js`, and are now fully wired
into the UI on two surfaces:

1. **Floating widget** (`AssistantWidget`) — available on every authenticated
   page via the bottom-left FAB button.
2. **Dedicated `/assistant` page** (`AssistantPage`) — full-width inline chat
   UI with conversation history, new chat, and delete; uses the same backend
   API calls. This is a standalone page accessible from the nav.

Both surfaces share the same API contract:
- `POST /assistant/chat { conversation_id?, message }` → `{ data: { conversation_id, message: { id, role, content, citations?, created_at } } }`
- `GET /assistant/conversations` → `{ data: [{ id, title, created_at }] }`
- `GET /assistant/conversations/:id` → `{ data: { id, messages: [] } }`
- `DELETE /assistant/conversations/:id` → 204

## Courses

`GET /courses`, `GET /courses/:courseId`, `GET /courses/:courseId/eligibility`
are now wired into:

1. **`/courses`** — dedicated courses listing page with `search`, `mode` and
   `location` filters (the only three query params the backend supports; there
   is no `course_type` filter).
2. **`/courses/:id`** — course detail page with eligibility rules if available.

Courses are also still accessible via the Career Detail `/careers/:id` "Courses"
tab (unchanged from before).

## Recommendations

`POST /recommendations/careers` is wired on two surfaces:

1. **"Find careers for me" button** on the `/careers` page — quick inline
   recommendation shown above the career listing.
2. **`/recommendations` page** — dedicated full-page recommendations experience
   with feedback controls.

## Admin / ingestion (not applicable to this frontend)

`/admin/sources`, `/admin/ingestion/runs`, `/admin/review-queue`,
`/admin/audit-log` all require `ADMIN`/`REVIEWER` roles and are unrelated to
the public/USER-facing app in this repo. Not wired here; no admin UI exists
in this frontend and none was requested.

---

## Backend gaps (confirmed absent from the backend source — not invented, not worked around by inventing a fake route)

1. **No "list my generated pathways" endpoint.** Worked around client-side
   with a remembered `user_pathway_id` in `localStorage` (see Pathways
   section above). Recommend adding `GET /pathways/mine` or similar.
2. **No "list my saved items" endpoint of any kind**, for careers or
   pathways. Only `POST`/`DELETE /pathways/:pathwayId/save` (a toggle)
   exist; nothing reads them back as a list, and the one code path that
   could report a per-item `saved` boolean (`getPathway(id, userId)`) is
   never called with a `userId` from any route. The **Saved** page now says
   this plainly instead of calling a fabricated `/users/me/saved` (which is
   what the previous version of this frontend did — it would have 404'd
   every time) or showing fake data.
3. **No way to save a plain career** (as opposed to a pathway) — there is
   no `saved_items` usage anywhere for `item_type = 'career'`, and no
   route accepts one. The Career Detail page's previous "Save" bookmark
   button called a nonexistent endpoint; it has been removed from that
   page. The one real, working save action in this app is on the
   **Pathway** page, against a pathway's own save/unsave endpoints.
4. **No `GET /dashboard`.** The Dashboard page is now composed client-side
   from `GET /profiles/me` (for the goal) and the public `GET /careers`
   (for "careers to explore"), plus the remembered pathway id above.
5. **No career-level eligibility/fit endpoint.** The closest real
   capability is `POST /skills/gap-analysis`; genuine
   `POST /eligibility/check` is opportunity-scoped only (see above).
6. **No `industry`/`location`/`salary`/`growth`/`career_type` fields or
   filters on careers.** The Careers page only offers keyword search.
7. **No `course_type` filter on `/courses`** (only `mode`, `location`,
   `search`).

None of the above were "fixed" by adding a matching route to the backend —
per the brief, the backend is out of scope for this pass and its source is
the source of truth. Each is instead handled by either a documented,
clearly-labelled client-side workaround (gaps 1 and 6/7, where a real
substitute exists) or an honest "not available yet" UI state (gaps 2, 3, 4
in their purest form) rather than a silent failure or fabricated data.

## Verification status (current)

- `npm test` (`node --test src/api/__tests__/client.test.mjs`): **8/8 pass**
- `npm run build` (`vite build`): **clean build, zero errors**,
  output ~95 kB (index JS gzipped ~24 kB)

Both commands can be run from the `frontend/` directory:

```bash
npm test
npm run build
```

`frontend/.env` (and `frontend/.env.example`) are correctly configured with
`VITE_API_BASE_URL=http://localhost:5000/api/v1` matching the backend's
default `PORT=5000` from `backend/.env`.
