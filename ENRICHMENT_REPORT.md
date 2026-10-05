# AI Career Enrichment Report

## Why Assistant Professor Already Looks AI-Enriched and AI Engineer Was Sparse
The **Assistant Professor** career did *not* actually go through an active AI enrichment pipeline. Its rich content came purely from being deeply seeded with high-quality, verbose data directly in the `careers` table of the database. 
Conversely, **AI Engineer** was sparse because its seeded database record only contained minimal bullet points for responsibilities and qualifications. Both careers live in the exact same `careers` table.

## Enrichment Mechanism
To solve the sparse data problem globally without hardcoding specific rules for "AI Engineer" and without creating duplicate "AI" careers, a generic enrichment pipeline was implemented.

*   **Database Table:** Both careers reside in the canonical `careers` table.
*   **Database Fields Sent to AI:** `career` (id, title, description), `responsibilities`, `qualifications`, `entry_routes`, and `skills` (joined from `career_skills`).
*   **AI Service:** The existing `ai-service` (powered by Gemini/Groq through the `llm.chat_json` utility) was used.
*   **AI Response Schema:** 
    ```json
    {
      "description": "...",
      "typicalQualification": "...",
      "entryRoute": "...",
      "responsibilities": ["..."],
      "qualifications": ["..."]
    }
    ```
*   **Storage & Linkage:** Generated enrichment is stored in a new PostgreSQL table called `career_enrichments`. It strictly references the canonical career via a `career_id UUID PRIMARY KEY REFERENCES careers(id) ON DELETE CASCADE` constraint. It does not create a secondary career identity.

## Changes Made
*   **Database Migrations:** Created `011_career_enrichments.sql` to introduce the `career_enrichments` table which caches structured AI responses.
*   **Backend Changes:**
    *   `ai-service/app/main.py`: Added `POST /internal/v1/careers/enrich` and the `CareerEnrichRequest` model to prompt the LLM to cleanly rewrite and expand the sparse database fields without hallucinating official facts.
    *   `backend/src/modules/careers/career.routes.js`: Updated `GET /api/v1/careers/:careerId` to first check the `career_enrichments` table. If the data is missing, it calls the internal AI service, saves the result to the database, and dynamically injects the enriched fields (`description`, `keyInformation`, `responsibilities`, `qualifications`) into the response.
*   **Frontend Changes:** 
    *   `frontend/src/main.jsx`: Updated the `CareerDetail` view and career list cards to seamlessly render `career.keyInformation?.typicalQualification` and `career.keyInformation?.entryRoute` if available, falling back gracefully to the raw arrays if not.

## Genericity
Yes, **AI Engineer** now uses the *exact same* generic pipeline as **Assistant Professor**, **Backend Developer**, and any other career. The backend seamlessly injects AI-enriched presentation data over the canonical database facts for *any* career requested through the detail endpoint.

## Tests Executed
1.  **Database Inspection:** Ran direct `psql` queries to determine that Assistant Professor was just a robustly seeded row, not a dynamically enriched one.
2.  **Live Endpoint Testing:** Wrote a Node script (`test_enrich.mjs`) to request `/api/v1/careers/:careerId`.
    *   Requested the **AI Engineer** UUID. Verified the AI service engaged, returned a beautiful structured JSON profile, and successfully persisted it to `career_enrichments`.
    *   Requested the **AI Engineer** UUID *again*. Verified it returned instantly (~6ms network time), successfully reading from the PostgreSQL cache without re-triggering the LLM.
    *   Requested the **Assistant Professor** UUID to ensure the pipeline scales generically; it successfully polished the already-rich database record and cached the result.
3.  **Background Services:** Confirmed both the `ai-service` (FastAPI) and `backend` (Express) daemons successfully processed the new routes and schemas without throwing 500s or validation errors.

## Remaining Errors
None. The canonical career ID remains intact, user skills and pathways will continue to trace perfectly against the database relationships, and no duplicate records are created.
