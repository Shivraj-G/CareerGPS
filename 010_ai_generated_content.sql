-- 008_ai_generated_content.sql
--
-- Persistence for AI-generated careers, skills and pathways, kept OUTSIDE the curated catalogue.
--
-- Design rule: these tables only point INTO existing tables (users, careers). Nothing in the existing
-- schema points at them, and no existing table, column, constraint or query changes. Dropping these
-- three tables returns the database to exactly how it was before this migration.
--
-- Adapt naming, id defaults and updated_at handling to match your existing migrations
-- (this file assumes UUID primary keys via gen_random_uuid(), as in the rest of the project).

BEGIN;

-- 1) Shared library of AI-generated career profiles.
--    One row per career (deduplicated by normalized title), so the second person who searches "chef"
--    gets the saved profile instantly instead of triggering another LLM call, and the profile survives
--    AI-service restarts. Every row is UNVERIFIED until an admin promotes or archives it.
CREATE TABLE IF NOT EXISTS ai_career_profiles (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_title   TEXT NOT NULL UNIQUE,
  title              TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  profile            JSONB NOT NULL CHECK (jsonb_typeof(profile) = 'object'),
  pathway_draft      JSONB CHECK (pathway_draft IS NULL OR jsonb_typeof(pathway_draft) = 'object'),
  origin_query       TEXT,
  status             TEXT NOT NULL DEFAULT 'unverified'
                       CHECK (status IN ('unverified', 'promoted', 'archived')),
  promoted_career_id UUID REFERENCES careers(id) ON DELETE SET NULL,
  created_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_career_profiles_status ON ai_career_profiles (status);

-- 2) A user's saved AI careers (what they picked), plus their progress on the AI pathway draft.
--    pathway_progress is an array of completed step numbers, e.g. [1, 2, 4].
CREATE TABLE IF NOT EXISTS user_ai_career_saves (
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ai_career_id     UUID NOT NULL REFERENCES ai_career_profiles(id) ON DELETE CASCADE,
  pathway_progress JSONB NOT NULL DEFAULT '[]'::jsonb
                     CHECK (jsonb_typeof(pathway_progress) = 'array'),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, ai_career_id)
);

-- 3) Skills a user picked that are NOT in the curated `skills` table (private to that user).
--    Skills that DO exist in the catalogue keep using the normal user_skills table with a real skill_id.
CREATE TABLE IF NOT EXISTS user_custom_skills (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  normalized_name TEXT NOT NULL,
  level           TEXT NOT NULL DEFAULT 'unknown'
                    CHECK (level IN ('beginner', 'intermediate', 'advanced', 'expert', 'unknown')),
  category        TEXT,
  origin          TEXT NOT NULL DEFAULT 'ai_generated'
                    CHECK (origin IN ('ai_generated', 'user_added')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, normalized_name)
);

COMMIT;
