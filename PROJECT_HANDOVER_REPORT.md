# CareerGPS — Technical Handover & Project Reconnaissance Report

## 1. Executive Summary
CareerGPS is a robust, decoupled career intelligence platform tailored for students and job seekers in Goa, India. The project features a well-architected backend API (Node.js/Express) connected to a PostgreSQL database, a dedicated internal AI service (Python/FastAPI) leveraging LLMs (Gemini/Groq) for dynamic insights, and an extraction worker for opportunity data ingestion. 

**Critical Finding**: While the backend and AI services are highly developed, feature-rich, and interconnected, the frontend (React/Vite) is almost entirely unwritten. Aside from a `FoundationPage`, all routes map to placeholder components.

## 2. Verified Project Identity and Repository Structure
- **Root Directory**: Monorepo structured logically by service.
- **`backend/`**: Node.js/Express API containing models, controllers, routers, and database migrations.
- **`ai-service/`**: Python/FastAPI application strictly operating as an internal service for LLM integration.
- **`frontend/`**: React/Vite SPA scaffold.
- **`ingestion-worker/`**: Node.js worker scripts for extracting external government opportunities via web scraping/PDF parsing.
- **`docs/`**: Generated markdown documentation detailing specific system segments.
- **`scratch/`**: Developer test scripts and playgrounds.

## 3. Actual Architecture
The system employs a microservices approach where the Node.js Backend serves as the primary gateway and Source of Truth. The Frontend communicates exclusively with the Backend via REST. The Backend delegates complex natural language reasoning and generative tasks (like career drafting, skill gap analysis) to the AI Service via an internal authenticated HTTP API. The AI Service does not mutate the PostgreSQL database; state persistence is solely managed by the Backend.

See the complete diagram in [ARCHITECTURE.md](docs/ARCHITECTURE.md).

## 4. Technology Stack and Service Responsibilities
- **Frontend**: React 18, React Router DOM v6, Vite. (Responsibility: UI/UX - *Currently incomplete*).
- **Backend**: Node.js v20+, Express v5, PostgreSQL, `pg` (Node Postgres), Zod (validation). (Responsibility: Authentication, DB interface, Business Logic, AI orchestration).
- **AI Service**: Python 3.10+, FastAPI, HTTPX. (Responsibility: Stateless LLM abstraction, prompt engineering, provider fallbacks).
- **Ingestion Worker**: Node.js. (Responsibility: URL fetching, hashing, forwarding candidates to Backend).

## 5. File-by-file/Module-by-module Implementation Map
- **Backend Modules**:
  - `auth`: Registration, Login, Token generation.
  - `careers`: Career catalogue retrieval, AI enrichment orchestration, Explore search.
  - `skills`: Skills management and gap analysis.
  - `pathways`: Learning pathway CRUD and generation.
  - `eligibility`: Rules engine for checking user credentials against course/opportunity requirements.
  - `ingestion`: Webhook receiver for the ingestion worker.
  - `assistant`: Conversational AI context builder.
- **AI Service Modules**:
  - `main.py`: Core routing and deterministic fallback logic.
  - `llm.py`: Provider agnostic (Gemini/Groq) adapter with budget-aware retry logic.

## 6. API Inventory and Integration Contracts
The backend exposes over 40+ REST endpoints. The AI service exposes 6+ internal operational endpoints.
Detailed listing available in [API_INVENTORY.md](docs/API_INVENTORY.md).

## 7. Database Schema and Relationship Overview
PostgreSQL database built with 16 sequential migrations. Features highly relational models utilizing `UUID` primary keys, intertwined with `JSONB` structures for flexible attributes.
Detailed schema documentation in [DATABASE_OVERVIEW.md](docs/DATABASE_OVERVIEW.md).

## 8. Feature-by-Feature Implementation Status
| Feature | Backend | AI Service | Frontend | DB Schema |
|---------|---------|------------|----------|-----------|
| User Auth (JWT) | ✅ Complete | N/A | ❌ Placeholder | ✅ Complete |
| Profile Management | ✅ Complete | N/A | ❌ Placeholder | ✅ Complete |
| Career Catalogue | ✅ Complete | ✅ Enriches | ❌ Placeholder | ✅ Complete |
| AI Career Explore | ✅ Complete | ✅ Generates| ❌ Placeholder | ✅ Complete |
| Skill Gap Analysis | ✅ Complete | ✅ Complete | ❌ Placeholder | ✅ Complete |
| Pathways | ✅ Complete | ✅ Complete | ❌ Placeholder | ✅ Complete |
| Opportunities | ✅ Complete | N/A | ❌ Placeholder | ✅ Complete |
| Eligibility Check | ✅ Complete | ✅ Explains | ❌ Placeholder | ✅ Complete |
| AI Assistant Chat | ✅ Complete | ✅ Complete | ❌ Placeholder | ✅ Complete |
| Data Ingestion | ✅ Complete | N/A | N/A | ✅ Complete |

## 9. AI Service and Ingestion Internals
**AI Service**: Strongly adheres to time budgets to prevent backend connection drops. Implements caching (`cache_set`, `cache_get`) for repetitive operations like eligibility explanations. Uses `gemini-2.5-flash` natively, falling back to `groq` upon failures.

**Ingestion Worker**: A manual/cron script that downloads target URLs, strips HTML, hashes contents, and posts `candidate_data` to the backend for human review. Fails gracefully if sources are unapproved.

## 10. Bugs and Issues Ranked by Severity
- **CRITICAL**: Frontend is entirely unwritten except for the routing shell.
- **MEDIUM**: Ingestion worker cannot infer document publication dates accurately.
- **MEDIUM**: Database relies heavily on JSONB for standard arrays, restricting indexed querying capabilities.
See [BUG_AND_RISK_REGISTER.md](docs/BUG_AND_RISK_REGISTER.md) for details.

## 11. Security, Reliability, and Performance Findings
- **Security**: Backend uses robust JWT authentication and password hashing. AI Service uses an internal pre-shared key (`INTERNAL_SERVICE_TOKEN`).
- **Reliability**: The AI Service aggressively prevents timeouts by measuring remaining budget before firing LLM requests.
- **Performance**: High reliance on index-assisted Postgres queries.

## 12. Build, Testing, and Deployment Status
- **Backend**: Uses Vitest. Tests exist in `backend/tests/` (e.g., `ai.endpoints.test.js`, `eligibility.service.test.js`).
- **AI Service**: Uses pytest. Tests located in `ai-service/tests/`.
- **Deployment**: Configured for Railway/Vercel (presence of `vercel.json`). Wait scripts and smoke checks exist.

## 13. Missing Configuration and Unresolved Dependencies
- `INTERNAL_SERVICE_TOKEN` must be mutually configured across backend, ingestion worker, and AI service.
- Production environment configurations are pending deployment infrastructure selection.

## 14. Known Limitations and Unverified Assumptions
- The database schema is assumed correct and properly migrated; no structural destructive operations were executed during this audit.
- AI logic assumes Gemini/Groq APIs do not drastically alter their JSON formats.

## 15. Prioritized Remediation Plan
1. **Frontend Development**: This is the absolute highest priority. Build out UI components mapping to the 40+ available endpoints.
2. **AI Service Security**: Enforce `INTERNAL_SERVICE_TOKEN` presence regardless of the environment setting to prevent accidental exposure.
3. **Ingestion Metadata Extraction**: Improve extraction capabilities in the worker.

## 16. Recommended Next Development Steps
1. Initialize a design system (e.g., Tailwind or vanilla CSS as requested) in the frontend.
2. Build the Authentication context (Login/Register/Session).
3. Build the Dashboard and Profile UI.
4. Hook up the AI Chatbot UI to the `/assistant/chat` endpoint.
5. Create the Career Explorer interface.

## 17. Local Setup and Verification
See [DEVELOPMENT_SETUP.md](docs/DEVELOPMENT_SETUP.md) for environment configuration and run instructions.

## 18. CURRENT PROJECT STATE (For Future AI Assistants)
**WHAT EXISTS NOW**: A highly stable, production-ready Node.js backend integrated with a robust PostgreSQL schema and an advanced, budget-aware Python AI service. The data models and business logic (eligibility, pathway generation, career recommendation) are complete and tested.

**WHAT IS WORKING**: The entire backend API, authentication mechanisms, database migrations, and AI text generation/fallback pipelines.

**WHAT IS BROKEN/INCOMPLETE**: The frontend is non-existent. It is a React shell with a routing file that points everything to a `RoutePlaceholderPage`.

**KEY ENTRY POINTS**: 
- Backend: `backend/src/app.js`, `backend/src/routes/index.js`
- AI Service: `ai-service/app/main.py`
- Frontend: `frontend/src/routes/routes.jsx`

**STRICT DIRECTIVE**: Do NOT attempt to rewrite the backend or the AI service. They are functionally complete. Focus all future efforts on building the React frontend to consume these existing, well-documented APIs.
