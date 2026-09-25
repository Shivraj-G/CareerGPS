# Goa Career Pathway Intelligence Platform — Backend

Phase 1 foundation for the backend described in the project PDF.

## Stack

- Node.js 20+
- Express 5
- PostgreSQL via `pg`
- Zod for environment validation
- Helmet
- CORS
- Vitest + Supertest

## Phase 1 scope

- Express application
- `/api/v1` public API prefix
- PostgreSQL connection pool
- Environment validation
- Health endpoint
- Request IDs and structured JSON logs
- Standard 404/error responses
- Security headers and CORS
- Test scaffolding

Authentication, database migrations/models, business modules, AI integration, eligibility rules, and admin APIs belong to later phases.

## Setup

```bash
npm install
cp .env.example .env
```

Set `DATABASE_URL` in `.env` to an existing PostgreSQL database.

## Run

```bash
npm run dev
```

Production-style start:

```bash
npm start
```

## Test

```bash
npm test
npm run check
```

## Endpoints

- `GET /`
- `GET /api/v1/health`

The health endpoint checks PostgreSQL using `SELECT 1`.
