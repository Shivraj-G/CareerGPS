# Phase 8 Ingestion Worker

This worker follows the project architecture: it fetches approved public sources and sends extracted candidates to the Node backend's private ingestion endpoints. It does **not** connect to PostgreSQL directly.

## Important

Only ingest sources that are approved by the platform and publicly accessible. Do not bypass login pages, CAPTCHAs, robots/access restrictions, or terms of use.

The included extractor is intentionally conservative. It produces an `opportunity` candidate and marks it `needs_review`; it does not publish anything automatically.

## Run

1. Register and approve a source through the admin API.
2. Create an ingestion run for that source.
3. Copy the returned source UUID and run UUID into `.env`.
4. Set the same `INTERNAL_SERVICE_TOKEN` used by the backend.
5. Set `SOURCE_URL` to a public page/PDF that belongs to the approved source.
6. Run:

```cmd
npm install
npm run ingest
```

The worker submits the fetched content hash, source document metadata, and candidate record. A reviewer must approve the candidate before it can be published.
