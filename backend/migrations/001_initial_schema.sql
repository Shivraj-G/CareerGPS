CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(320) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(30) NOT NULL DEFAULT 'USER' CHECK (role IN ('USER', 'ADMIN', 'REVIEWER')),
  account_status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'suspended', 'disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  education JSONB NOT NULL DEFAULT '[]'::jsonb,
  experience JSONB NOT NULL DEFAULT '[]'::jsonb,
  interests JSONB NOT NULL DEFAULT '[]'::jsonb,
  preferred_locations JSONB NOT NULL DEFAULT '[]'::jsonb,
  career_goal TEXT,
  profile_status VARCHAR(30) NOT NULL DEFAULT 'draft' CHECK (profile_status IN ('draft', 'complete')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (jsonb_typeof(education) = 'array'),
  CHECK (jsonb_typeof(experience) = 'array'),
  CHECK (jsonb_typeof(interests) = 'array'),
  CHECK (jsonb_typeof(preferred_locations) = 'array')
);

CREATE TABLE skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL UNIQUE,
  description TEXT,
  category VARCHAR(100),
  record_status VARCHAR(30) NOT NULL DEFAULT 'needs_review' CHECK (record_status IN ('draft', 'published', 'needs_review', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_skills (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE RESTRICT,
  level VARCHAR(30) NOT NULL DEFAULT 'beginner' CHECK (level IN ('beginner', 'intermediate', 'advanced', 'expert', 'unknown')),
  years_experience NUMERIC(4,1) CHECK (years_experience IS NULL OR years_experience >= 0),
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, skill_id)
);

CREATE TABLE careers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL UNIQUE,
  description TEXT,
  responsibilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  qualifications JSONB NOT NULL DEFAULT '[]'::jsonb,
  entry_routes JSONB NOT NULL DEFAULT '[]'::jsonb,
  record_status VARCHAR(30) NOT NULL DEFAULT 'needs_review' CHECK (record_status IN ('draft', 'published', 'needs_review', 'archived')),
  verification_status VARCHAR(30) NOT NULL DEFAULT 'needs_review' CHECK (verification_status IN ('verified', 'needs_review', 'unverified')),
  source_id UUID,
  source_url TEXT,
  source_document_url TEXT,
  source_last_checked_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (jsonb_typeof(responsibilities) = 'array'),
  CHECK (jsonb_typeof(qualifications) = 'array'),
  CHECK (jsonb_typeof(entry_routes) = 'array')
);

CREATE TABLE career_skills (
  career_id UUID NOT NULL REFERENCES careers(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE RESTRICT,
  importance VARCHAR(30) NOT NULL DEFAULT 'useful' CHECK (importance IN ('required', 'important', 'useful')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (career_id, skill_id)
);

CREATE TABLE career_qualifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  career_id UUID NOT NULL REFERENCES careers(id) ON DELETE CASCADE,
  qualification TEXT NOT NULL,
  requirement_type VARCHAR(30) NOT NULL DEFAULT 'common' CHECK (requirement_type IN ('required', 'preferred', 'common', 'alternative')),
  notes TEXT,
  source_id UUID,
  source_url TEXT,
  verification_status VARCHAR(30) NOT NULL DEFAULT 'needs_review' CHECK (verification_status IN ('verified', 'needs_review', 'unverified')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE institutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(250) NOT NULL UNIQUE,
  description TEXT,
  location TEXT,
  website_url TEXT,
  record_status VARCHAR(30) NOT NULL DEFAULT 'needs_review' CHECK (record_status IN ('draft', 'published', 'needs_review', 'archived')),
  verification_status VARCHAR(30) NOT NULL DEFAULT 'needs_review' CHECK (verification_status IN ('verified', 'needs_review', 'unverified')),
  source_id UUID,
  source_url TEXT,
  source_document_url TEXT,
  source_last_checked_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL,
  title VARCHAR(250) NOT NULL,
  course_type VARCHAR(50),
  qualification VARCHAR(200),
  duration_text VARCHAR(100),
  mode VARCHAR(30) CHECK (mode IS NULL OR mode IN ('online', 'offline', 'hybrid')),
  location TEXT,
  subject TEXT,
  fees_text TEXT,
  description TEXT,
  record_status VARCHAR(30) NOT NULL DEFAULT 'needs_review' CHECK (record_status IN ('draft', 'published', 'needs_review', 'archived')),
  verification_status VARCHAR(30) NOT NULL DEFAULT 'needs_review' CHECK (verification_status IN ('verified', 'needs_review', 'unverified')),
  source_id UUID,
  source_url TEXT,
  source_document_url TEXT,
  source_last_checked_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE course_eligibility_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  rule_type VARCHAR(50) NOT NULL,
  rule_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_id UUID,
  source_url TEXT,
  verification_status VARCHAR(30) NOT NULL DEFAULT 'needs_review' CHECK (verification_status IN ('verified', 'needs_review', 'unverified')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (jsonb_typeof(rule_data) = 'object')
);

CREATE TABLE course_careers (
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  career_id UUID NOT NULL REFERENCES careers(id) ON DELETE CASCADE,
  relation_type VARCHAR(30) NOT NULL DEFAULT 'related' CHECK (relation_type IN ('related', 'recommended', 'qualifying')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (course_id, career_id)
);

CREATE TABLE pathways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  career_id UUID NOT NULL REFERENCES careers(id) ON DELETE CASCADE,
  title VARCHAR(250) NOT NULL,
  description TEXT,
  pathway_type VARCHAR(30) NOT NULL DEFAULT 'template' CHECK (pathway_type IN ('template', 'generated')),
  record_status VARCHAR(30) NOT NULL DEFAULT 'needs_review' CHECK (record_status IN ('draft', 'published', 'needs_review', 'archived')),
  verification_status VARCHAR(30) NOT NULL DEFAULT 'needs_review' CHECK (verification_status IN ('verified', 'needs_review', 'unverified')),
  source_id UUID,
  source_url TEXT,
  source_document_url TEXT,
  source_last_checked_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE pathway_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pathway_id UUID NOT NULL REFERENCES pathways(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL CHECK (step_order > 0),
  title VARCHAR(250) NOT NULL,
  description TEXT,
  step_type VARCHAR(50),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (pathway_id, step_order),
  CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE TABLE user_pathways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pathway_id UUID NOT NULL REFERENCES pathways(id) ON DELETE RESTRICT,
  title VARCHAR(250),
  status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  generated_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (jsonb_typeof(generated_context) = 'object')
);

CREATE TABLE user_pathway_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_pathway_id UUID NOT NULL REFERENCES user_pathways(id) ON DELETE CASCADE,
  pathway_step_id UUID NOT NULL REFERENCES pathway_steps(id) ON DELETE RESTRICT,
  status VARCHAR(30) NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_pathway_id, pathway_step_id)
);

CREATE TABLE opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(300) NOT NULL,
  organization VARCHAR(250) NOT NULL,
  opportunity_type VARCHAR(50),
  location TEXT,
  advertisement_number VARCHAR(150),
  application_opening TIMESTAMPTZ,
  application_deadline TIMESTAMPTZ,
  vacancies_total INTEGER CHECK (vacancies_total IS NULL OR vacancies_total >= 0),
  description TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'unknown' CHECK (status IN ('upcoming', 'open', 'closed', 'cancelled', 'unknown')),
  record_status VARCHAR(30) NOT NULL DEFAULT 'needs_review' CHECK (record_status IN ('draft', 'published', 'needs_review', 'archived')),
  verification_status VARCHAR(30) NOT NULL DEFAULT 'needs_review' CHECK (verification_status IN ('verified', 'needs_review', 'unverified')),
  source_id UUID,
  source_url TEXT,
  source_document_url TEXT,
  source_last_checked_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization, advertisement_number)
);

CREATE TABLE opportunity_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  requirement_type VARCHAR(50) NOT NULL,
  requirement_text TEXT NOT NULL,
  rule_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  verification_status VARCHAR(30) NOT NULL DEFAULT 'needs_review' CHECK (verification_status IN ('verified', 'needs_review', 'unverified')),
  source_id UUID,
  source_url TEXT,
  source_document_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (jsonb_typeof(rule_data) = 'object')
);

CREATE TABLE career_opportunities (
  career_id UUID NOT NULL REFERENCES careers(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  relation_type VARCHAR(30) NOT NULL DEFAULT 'related' CHECK (relation_type IN ('related', 'target_role', 'alternative')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (career_id, opportunity_id)
);

CREATE TABLE sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(250) NOT NULL,
  source_type VARCHAR(50) NOT NULL,
  base_url TEXT NOT NULL,
  organization VARCHAR(250),
  is_approved BOOLEAN NOT NULL DEFAULT FALSE,
  access_notes TEXT,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE source_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES sources(id) ON DELETE RESTRICT,
  url TEXT NOT NULL,
  document_title TEXT,
  content_hash VARCHAR(128),
  fetched_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  raw_text TEXT,
  extraction_version VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_id, url, content_hash)
);

CREATE TABLE source_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_document_id UUID NOT NULL REFERENCES source_documents(id) ON DELETE RESTRICT,
  entity_type VARCHAR(80) NOT NULL,
  entity_id UUID NOT NULL,
  field_name VARCHAR(150),
  evidence_text TEXT,
  reference_locator TEXT,
  extraction_version VARCHAR(100),
  review_status VARCHAR(30) NOT NULL DEFAULT 'needs_review' CHECK (review_status IN ('needs_review', 'approved', 'rejected')),
  reviewer_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ingestion_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES sources(id) ON DELETE SET NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'running', 'completed', 'failed', 'cancelled')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  discovered_count INTEGER NOT NULL DEFAULT 0 CHECK (discovered_count >= 0),
  extracted_count INTEGER NOT NULL DEFAULT 0 CHECK (extracted_count >= 0),
  accepted_count INTEGER NOT NULL DEFAULT 0 CHECK (accepted_count >= 0),
  rejected_count INTEGER NOT NULL DEFAULT 0 CHECK (rejected_count >= 0),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ingestion_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES ingestion_runs(id) ON DELETE CASCADE,
  entity_type VARCHAR(80) NOT NULL,
  candidate_data JSONB NOT NULL,
  source_document_id UUID REFERENCES source_documents(id) ON DELETE SET NULL,
  extraction_version VARCHAR(100),
  extraction_status VARCHAR(30) NOT NULL DEFAULT 'needs_review' CHECK (extraction_status IN ('needs_review', 'approved', 'rejected', 'published')),
  review_status VARCHAR(30) NOT NULL DEFAULT 'needs_review' CHECK (review_status IN ('needs_review', 'approved', 'rejected', 'request_review')),
  reviewer_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (jsonb_typeof(candidate_data) = 'object')
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(80),
  entity_id UUID,
  before_data JSONB,
  after_data JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (before_data IS NULL OR jsonb_typeof(before_data) = 'object'),
  CHECK (after_data IS NULL OR jsonb_typeof(after_data) = 'object'),
  CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE TABLE saved_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_type VARCHAR(30) NOT NULL CHECK (item_type IN ('career', 'course', 'opportunity', 'pathway')),
  item_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, item_type, item_id)
);

CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(250),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role VARCHAR(30) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (jsonb_typeof(citations) = 'array')
);

ALTER TABLE careers ADD CONSTRAINT careers_source_fk FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE SET NULL;
ALTER TABLE career_qualifications ADD CONSTRAINT career_qualifications_source_fk FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE SET NULL;
ALTER TABLE institutions ADD CONSTRAINT institutions_source_fk FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE SET NULL;
ALTER TABLE courses ADD CONSTRAINT courses_source_fk FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE SET NULL;
ALTER TABLE course_eligibility_rules ADD CONSTRAINT course_rules_source_fk FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE SET NULL;
ALTER TABLE pathways ADD CONSTRAINT pathways_source_fk FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE SET NULL;
ALTER TABLE opportunities ADD CONSTRAINT opportunities_source_fk FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE SET NULL;
ALTER TABLE opportunity_requirements ADD CONSTRAINT opportunity_requirements_source_fk FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE SET NULL;

CREATE INDEX idx_user_skills_skill_id ON user_skills(skill_id);
CREATE INDEX idx_career_skills_skill_id ON career_skills(skill_id);
CREATE INDEX idx_career_qualifications_career_id ON career_qualifications(career_id);
CREATE INDEX idx_careers_record_status ON careers(record_status);
CREATE INDEX idx_careers_title_lower ON careers (LOWER(title));
CREATE INDEX idx_institutions_location ON institutions(location);
CREATE INDEX idx_courses_institution_id ON courses(institution_id);
CREATE INDEX idx_courses_record_status ON courses(record_status);
CREATE INDEX idx_courses_title_lower ON courses (LOWER(title));
CREATE INDEX idx_course_rules_course_id ON course_eligibility_rules(course_id);
CREATE INDEX idx_course_careers_career_id ON course_careers(career_id);
CREATE INDEX idx_pathways_career_id ON pathways(career_id);
CREATE INDEX idx_pathways_record_status ON pathways(record_status);
CREATE INDEX idx_pathway_steps_pathway_id_order ON pathway_steps(pathway_id, step_order);
CREATE INDEX idx_user_pathways_user_id_status ON user_pathways(user_id, status);
CREATE INDEX idx_user_pathway_steps_user_pathway_id ON user_pathway_steps(user_pathway_id);
CREATE INDEX idx_opportunities_status_deadline ON opportunities(status, application_deadline);
CREATE INDEX idx_opportunities_record_status ON opportunities(record_status);
CREATE INDEX idx_opportunities_title_lower ON opportunities (LOWER(title));
CREATE INDEX idx_opportunity_requirements_opportunity_id ON opportunity_requirements(opportunity_id);
CREATE INDEX idx_career_opportunities_opportunity_id ON career_opportunities(opportunity_id);
CREATE INDEX idx_sources_approved ON sources(is_approved);
CREATE INDEX idx_source_documents_source_id ON source_documents(source_id);
CREATE INDEX idx_source_documents_hash ON source_documents(content_hash);
CREATE INDEX idx_source_evidence_entity ON source_evidence(entity_type, entity_id);
CREATE INDEX idx_source_evidence_document_id ON source_evidence(source_document_id);
CREATE INDEX idx_ingestion_runs_source_started ON ingestion_runs(source_id, started_at DESC);
CREATE INDEX idx_ingestion_candidates_run_id ON ingestion_candidates(run_id);
CREATE INDEX idx_ingestion_candidates_review_status ON ingestion_candidates(review_status);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_user_id, created_at DESC);
CREATE INDEX idx_saved_items_user ON saved_items(user_id, created_at DESC);
CREATE INDEX idx_conversations_user_updated ON conversations(user_id, updated_at DESC);
CREATE INDEX idx_conversation_messages_conversation_created ON conversation_messages(conversation_id, created_at);

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'users','user_profiles','skills','user_skills','careers','career_qualifications',
    'institutions','courses','course_eligibility_rules','pathways','pathway_steps',
    'user_pathways','user_pathway_steps','opportunities','opportunity_requirements',
    'sources','source_documents','source_evidence','ingestion_runs','ingestion_candidates',
    'audit_logs','conversations'
  ] LOOP
    EXECUTE format('CREATE TRIGGER %I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', table_name, table_name);
  END LOOP;
END $$;
