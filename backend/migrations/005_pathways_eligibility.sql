CREATE TABLE eligibility_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  outcome VARCHAR(50) NOT NULL CHECK (outcome IN ('meets_listed_requirements', 'does_not_meet_listed_requirements', 'unable_to_determine')),
  results JSONB NOT NULL DEFAULT '[]'::jsonb,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (jsonb_typeof(results) = 'array')
);

CREATE INDEX idx_eligibility_checks_user_created
  ON eligibility_checks(user_id, created_at DESC);
CREATE INDEX idx_eligibility_checks_opportunity
  ON eligibility_checks(opportunity_id, created_at DESC);

CREATE INDEX idx_pathways_career_status
  ON pathways(career_id, record_status, pathway_type);
CREATE INDEX idx_pathway_steps_pathway_order
  ON pathway_steps(pathway_id, step_order);
CREATE INDEX idx_user_pathways_user_status
  ON user_pathways(user_id, status, updated_at DESC);
CREATE INDEX idx_user_pathway_steps_user_pathway
  ON user_pathway_steps(user_pathway_id, status);
CREATE INDEX idx_opportunity_requirements_opportunity
  ON opportunity_requirements(opportunity_id, verification_status);
