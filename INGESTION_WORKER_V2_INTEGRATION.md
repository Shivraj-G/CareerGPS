# CareerGPS updated ingestion-worker v2 — integration guide

This update converts the prior one-URL worker into an approved-source registry runner for government recruitment, private-sector jobs, and internships. It includes limited public ATS adapters, same-host HTML crawling, role classification, date normalization, crawl boundaries, duplicate-candidate protection, and run creation per registered source.

## Files in this update bundle

- `CareerGPS/ingestion-worker/` — updated worker, extraction/provider/robots modules, tests, `.env.example`, README, generic source templates, suggested public private/internship starter boards (not pre-approved), and `scripts/import-starter-sources.mjs` for one-time source registration.
- `CareerGPS/backend/src/modules/ingestion/ingestion.service.js` — includes approved-source listing and repeat-run candidate deduplication.
- `CareerGPS/backend/src/modules/ingestion/ingestion.routes.js` — adds internal-token-protected approved-source list and create-run endpoints.
- `CareerGPS/backend/src/modules/opportunities/opportunity.service.js` — normalizes underscores/hyphens when filtering opportunity types, so the `Private Job` UI filter matches stored `private_job` records.
- `CareerGPS/frontend/src/main.jsx` and `CareerGPS/frontend/src/pages/LegacyPages.jsx` — format opportunity types for display and add private-job, internship, apprenticeship, graduate-programme, and scholarship filters.

Extract this bundle over the root of your existing CareerGPS project after making a backup. Existing `.env` files are not included or overwritten by the update bundle.

## Required backend deployment

The worker now uses these new internal endpoints:

- `GET /internal/v1/ingestion/sources` — returns only approved source records.
- `POST /internal/v1/ingestion/runs` — creates a fresh run for an already-approved source.

Both routes are protected by the existing `requireInternalService` middleware and use the existing `INTERNAL_SERVICE_TOKEN`. Do not expose them publicly or remove that middleware. The candidate submission/status endpoints continue using the current contract.

## Register private and internship sources

The file `ingestion-worker/starter-private-internship-sources.json` contains suggested public Lever boards for an initial review. Entries are marked `is_approved: false` deliberately. Confirm each source is still active and allowed before adding it through the admin source registry. The supported Lever, Greenhouse, Ashby and SmartRecruiters adapters use their respective public job feeds when the source URL identifies the board. Greenhouse publicly documents unauthenticated GET access for its public Job Board API. See [Greenhouse Job Board API documentation](https://docs.greenhouse.io/job-board.html).

The worker cannot invent a source list or safely scrape the entire internet. An admin must add each public source and approve it in CareerGPS first.

Use `ingestion-worker/starter-private-internship-sources.json` for suggested public Lever boards. They were identified from publicly listed career pages and should be rechecked before use. You may use `node scripts/import-starter-sources.mjs` with `ADMIN_BEARER_TOKEN` set to your own admin JWT to register these starter records as unapproved, or add records through the admin UI. Then use `ingestion-worker/source-record-examples.json` for additional boards: replace all uppercase placeholders with actual public employer career-board URLs and the employer name. Confirm each source is public and permitted to fetch, then approve it through the admin workflow. If a source is a multi-employer aggregator, avoid putting the platform name in the organization field, or the worker could incorrectly label all postings as that platform's jobs.

Recommended `source_type` values:

- `government_recruitment`
- `private_careers`
- `internship_board`
- `apprenticeship`
- `graduate_programme`
- `scholarship`

The worker automatically classifies individual postings by title/content as internship, apprenticeship, scholarship, graduate programme or private job where the page provides enough signal. `source_type` is still useful for filtering and for pages that lack clear text signals.

## Run

1. In `CareerGPS/backend`, install dependencies if needed and run the project's tests/checks; restart the backend after applying the route/service patch.
2. In `CareerGPS/ingestion-worker`, run `npm ci`; copy `.env.example` to `.env`; set `BACKEND_URL` and the same `INTERNAL_SERVICE_TOKEN` as the backend.
3. Optionally set `ADMIN_BEARER_TOKEN` in your shell and run `node scripts/import-starter-sources.mjs` to create the suggested sources as unapproved. Never share or commit this token.
4. Review source records in CareerGPS Admin and approve only the sources you intend to fetch.
5. Run `npm run test:native`; after dependency installation, run `npm test` for the Vitest suites too.
6. Run `npm run ingest:dry-run` to preview source discoveries without creating runs or candidates.
7. Run `npm run ingest` to create one ingestion run per approved source and send candidate records.
8. Review discovered candidates in the existing admin review queue and approve/publish them through the existing process. They intentionally do not appear in public Opportunities merely because the worker fetched them.

For a limited run set `SOURCE_TYPES=private_careers,internship_board` and/or set `INGESTION_SOURCE_ID` to one approved source UUID. Leave those values blank to process all approved sources.

## Supported fetching strategies

- Greenhouse public Job Board API.
- Lever public postings feed (global/EU-hosted boards).
- Ashby public Job Postings API.
- SmartRecruiters public postings endpoint where the public board URL identifies the company.
- Generic public HTML career pages with bounded same-host link discovery and schema.org `JobPosting` parsing.

Sources requiring login, CAPTCHA solving, scraping restrictions, private APIs, or paywall bypass are not supported. The worker respects robots.txt and uses page, candidate, response-size, timeout, redirect-host and request-delay controls. PDF links are skipped with a clear message in this version; do not mistake a skipped PDF for an ingested opportunity.

## Validation that was possible in this environment

- Node syntax checks were run on the modified worker/provider/extractor/robots modules and backend ingestion service/routes.
- Native Node.js smoke tests cover extraction, date normalization, private/internship classification, same-host discovery, public ATS feed mapping, and robots.txt behaviour.
- The complete backend/PostgreSQL integration and live calls to individual employer boards must be run in the user's configured local environment.
