BEGIN;

-- Extend the existing skills table
ALTER TABLE skills 
  ADD COLUMN IF NOT EXISTS parent_domain VARCHAR(150),
  ADD COLUMN IF NOT EXISTS relevant_specializations JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS skill_type VARCHAR(50) CHECK (skill_type IN ('technical', 'practical', 'academic', 'analytical', 'creative', 'communication', 'management', 'interpersonal', 'other')),
  ADD COLUMN IF NOT EXISTS relevance_score NUMERIC(5,2) DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS recommendation_rationale TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS provenance JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS verification_status VARCHAR(30) DEFAULT 'needs_review' CHECK (verification_status IN ('verified', 'needs_review', 'unverified'));

-- Create an aliases table so we never duplicate skills
CREATE TABLE IF NOT EXISTS skill_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  alias_name VARCHAR(150) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Many-to-many mapping for education degrees/specializations to skills
CREATE TABLE IF NOT EXISTS skill_education_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  education_level VARCHAR(100),
  degree_name VARCHAR(150),
  specialization VARCHAR(150),
  subject_area VARCHAR(150),
  is_core BOOLEAN DEFAULT false,
  relevance_score NUMERIC(5,2) DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(skill_id, education_level, degree_name, specialization)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_skills_parent_domain ON skills(parent_domain);
CREATE INDEX IF NOT EXISTS idx_skill_aliases_name ON skill_aliases(alias_name);
CREATE INDEX IF NOT EXISTS idx_skill_education_mapping ON skill_education_mappings(degree_name, specialization);

COMMIT;
