CREATE TABLE IF NOT EXISTS ai_career_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  normalized_title VARCHAR(200) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  responsibilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  qualifications JSONB NOT NULL DEFAULT '[]'::jsonb,
  entry_routes JSONB NOT NULL DEFAULT '[]'::jsonb,
  required_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  related_careers JSONB NOT NULL DEFAULT '[]'::jsonb,
  goa_relevance TEXT,
  pathway_draft JSONB,
  promoted_career_id UUID REFERENCES careers(id) ON DELETE SET NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'unverified' CHECK (status IN ('unverified', 'promoted', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_ai_career_saves (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ai_career_id UUID NOT NULL REFERENCES ai_career_profiles(id) ON DELETE CASCADE,
  pathway_progress JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, ai_career_id)
);

CREATE TABLE IF NOT EXISTS user_custom_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  normalized_name VARCHAR(150) NOT NULL,
  level VARCHAR(30) NOT NULL DEFAULT 'beginner' CHECK (level IN ('beginner', 'intermediate', 'advanced', 'expert', 'unknown')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, normalized_name)
);
