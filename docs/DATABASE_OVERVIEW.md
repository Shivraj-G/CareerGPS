# Database Overview

## Schema Overview
The CareerGPS application uses a PostgreSQL database. The schema is defined by 16 SQL migration files located in `backend/migrations/`.

### Core Entities

1. **Users & Profiles**
   - `users`: Core identity (id, email, password_hash, role, account_status).
   - `user_profiles`: User details (education, experience, interests, preferred_locations, career_goal).
   - `user_skills`: Intersection of users and skills they possess with proficiency levels.

2. **Career Intelligence Catalogue**
   - `skills`: Technical, soft, and domain skills.
   - `careers`: Validated career profiles with descriptions, responsibilities, entry routes.
   - `career_skills`: Skills required for a career (with importance level).
   - `career_qualifications`: Qualifications required for a career.
   - `ai_career_profiles`: (Generated) Fallback/dynamically generated careers via AI.

3. **Education & Institutions**
   - `institutions`: Educational institutions.
   - `courses`: Degrees, diplomas, and certification courses offered by institutions.
   - `course_eligibility_rules`: Rules defining who can enroll in a course.
   - `course_careers`: Relationships between courses and target careers.

4. **Pathways**
   - `pathways`: Verified learning/career pathway templates.
   - `pathway_steps`: Individual steps in a pathway.
   - `user_pathways` & `user_pathway_steps`: User progression against a pathway.

5. **Opportunities**
   - `opportunities`: Government jobs, recruitment notices, etc.
   - `opportunity_requirements`: Eligibility requirements for opportunities.
   - `career_opportunities`: Target careers for an opportunity.

6. **Ingestion & Auditing**
   - `sources`, `source_documents`, `source_evidence`: Provenance of data extracted from web/PDF sources.
   - `ingestion_runs`, `ingestion_candidates`: Background ingestion pipeline state.
   - `audit_logs`: Entity creation and modification tracking.

7. **User Engagement**
   - `saved_items`: Bookmarks for careers, courses, opportunities, and pathways.
   - `conversations`, `conversation_messages`: Chatbot history.

## Design Patterns & Constraints

- **UUIDs**: All primary keys are `gen_random_uuid()`.
- **Timestamps**: Most tables include `created_at` and `updated_at` (managed by trigger).
- **JSONB**: Used heavily for arrays (like `responsibilities` and `qualifications` in careers, `education` in profiles) and flexible schemas (`rule_data`, `generated_context`).
- **Enums as Text with Check Constraints**: Statuses use VARCHAR with `CHECK (col IN (...))` rather than native Postgres ENUMs, facilitating easier migrations.
- **Record Status**: Many catalogue tables (`careers`, `courses`, `institutions`, `pathways`, `opportunities`) implement a `record_status` (draft, published, needs_review, archived) to support a review queue workflow.
- **Verification Status**: Catalogue items also have a `verification_status` to distinguish human-verified content from unverified or AI-generated data.
- **Source Tracking**: All catalogue items have foreign keys to `sources` to maintain data provenance.

## Current State & Risks
- Data structures are extensive and well-normalized.
- AI integration dynamically generates `careers` and `skills` if they don't exist in the verified catalogue, marking them as `ai_generated`.
- There are performance optimizations like `idx_careers_title_lower` for fast matching.
- **Risk**: The reliance on JSONB arrays for `responsibilities`, `qualifications`, and `entry_routes` inside `careers` makes querying specific nested elements complex, although it reduces join overhead.
