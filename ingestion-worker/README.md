# CareerGPS Multi-source Opportunity Ingestion Worker v2

This updates the previous single-URL worker into a registry-driven ingestion system for approved public opportunity sources, including:

- Government recruitment notices
- Private-sector jobs and employer career pages
- Internships and graduate/early-career programmes
- Apprenticeships and fellowships/scholarships where classified by page/source metadata

The worker does not connect to PostgreSQL directly. It requests the list of **approved** source records from CareerGPS's internal API, creates a fresh ingestion run for each source, fetches public pages or supported public ATS feeds, deduplicates discovered links within the run, and submits candidates through the existing internal candidate endpoint. Candidates remain `needs_review`; the worker does not publish them automatically.

## Important setup

1. Apply the two backend integration files included in the update bundle, or merge their changes into your existing `backend/src/modules/ingestion/ingestion.service.js` and `ingestion.routes.js`. They add internal-token-protected endpoints for listing approved sources and creating a run per source.
2. Restart the backend.
3. In CareerGPS Admin, register each public source you want to ingest. Set `name`, `source_type`, `base_url`, and the owning `organization` where it is a single-company board. Approve only sources you are permitted to fetch. Existing government sources continue to work.
4. Use `starter-private-internship-sources.json` for suggested public employer boards to review and register. These records are intentionally not auto-approved. They include Lever boards with private roles and internships; recheck each board before registration. `source-record-examples.json` still has adapter templates for Greenhouse, Lever, Ashby, SmartRecruiters, or generic HTML. The worker only fetches sources present in the approved backend registry; it does not crawl the entire internet or automatically approve domains.
5. To register those starter records without approving them, set `ADMIN_BEARER_TOKEN` to your own admin JWT in the local environment and run `node scripts/import-starter-sources.mjs` from this directory. The script only creates unapproved source records, skips duplicate-conflict responses, and never prints the token. Alternatively, add source records through CareerGPS Admin.
6. Copy `.env.example` to `.env` and set `BACKEND_URL` and `INTERNAL_SERVICE_TOKEN`. Keep the real `.env` secret and do not commit it.
7. Run `npm ci`, then `npm test` and `npm run test:native`, then `npm run ingest:dry-run` to preview discoveries without creating runs or writing candidates. After you review and approve sources in CareerGPS Admin, run `npm run ingest`.


## Supported public ATS feeds

Provider adapters are auto-detected from public board URLs:

- Greenhouse: `https://boards.greenhouse.io/<board-token>`
- Lever: `https://jobs.lever.co/<company-site>` (EU sites are also recognized)
- Ashby: `https://jobs.ashbyhq.com/<job-board-name>`
- SmartRecruiters: `https://careers.smartrecruiters.com/<company>` or `https://jobs.smartrecruiters.com/<company>`

The worker uses public, read-only job feeds where documented. It never submits applications.

For other public career/internship websites, it performs a bounded, same-host HTML crawl and recognizes schema.org `JobPosting` structured data or detail pages with role-specific signals. JavaScript-only pages without public feeds may not expose postings to this fetcher.

## Source types

Use consistent source type values in the admin source registry, for example:

- `government_recruitment`
- `private_careers`
- `internship_board`
- `apprenticeship`
- `graduate_programme`
- `scholarship`

Opportunity records are individually classified when the page title/content indicates an internship, apprenticeship, graduate programme, scholarship, or private job. For a single-employer ATS feed, fill `organization` on the source record so the candidate can inherit it when not present in the page payload.

## Optional crawler settings in `sources.access_notes`

If `access_notes` contains JSON, the worker accepts this optional structure (or a `worker` object wrapping it):

```json
{
  "worker": {
    "adapter": "greenhouse",
    "start_urls": ["https://boards.greenhouse.io/example-company"],
    "allowed_domains": ["boards.greenhouse.io", "boards-api.greenhouse.io"],
    "max_pages": 40,
    "max_candidates": 100,
    "max_depth": 2,
    "delay_ms": 1000,
    "include_patterns": ["jobs|career|internship"],
    "exclude_patterns": ["/login", "/privacy"]
  }
}
```

`adapter` can be `greenhouse`, `lever`, `ashby`, `smartrecruiters`, or `html`. In most cases it is auto-detected. Keep `allowed_domains` narrow. Access notes must remain valid JSON for settings to be applied; normal plain-text notes are also supported.

## What the worker does and does not do

- Fetches only approved, publicly accessible HTTP(S) source pages or documented public read-only job feeds.
- Respects robots.txt `Allow`/`Disallow` rules, source-host boundaries, request timeouts, response-size limits, crawl depth, page/candidate caps, and per-origin delays.
- Never bypasses login, CAPTCHA, access restrictions, or paywalls.
- Does not automatically create or approve sources.
- Does not guarantee comprehensive discovery from JavaScript-only sites or pages that disallow crawling.
- Does not parse PDF files in this version. PDF links are logged and skipped instead of submitting blank candidates; add a reviewed PDF extraction module if notices from PDF-only sources must be ingested.
- Does not automatically publish candidates. Reviewers must approve candidates through CareerGPS's review queue.

## Environment modes

**Registry mode (recommended):** `INGESTION_MODE=registry`. Reads every approved source, creates an ingestion run automatically, and processes each source independently. Failed sources are marked failed while other sources continue.

**Legacy mode:** set `INGESTION_MODE=legacy` and configure `INGESTION_SOURCE_ID`, `INGESTION_RUN_ID`, and `SOURCE_URL`. The run must already be active. This keeps compatibility with the earlier single-source worker.

**Dry run:** `npm run ingest:dry-run` fetches and parses approved sources but does not create ingestion runs or submit candidates. Ensure the backend registry already has approved sources first.

## Official public API notes

- Greenhouse Job Board API: https://docs.greenhouse.io/job-board.html
- Lever Postings API: https://github.com/lever/postings-api
- Ashby Job Postings API: https://developers.ashbyhq.com/docs/public-job-posting-api

Review source-specific terms and current API documentation before adding a source. Only use APIs/pages that are publicly accessible and permitted for the intended use.
