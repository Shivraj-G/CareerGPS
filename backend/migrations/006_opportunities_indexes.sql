CREATE INDEX IF NOT EXISTS idx_opportunities_published_status_deadline
  ON opportunities(status, application_deadline)
  WHERE record_status = 'published';

CREATE INDEX IF NOT EXISTS idx_opportunities_published_location
  ON opportunities(location)
  WHERE record_status = 'published';

CREATE INDEX IF NOT EXISTS idx_opportunities_published_type
  ON opportunities(opportunity_type)
  WHERE record_status = 'published';

CREATE INDEX IF NOT EXISTS idx_career_opportunities_opportunity
  ON career_opportunities(opportunity_id, career_id);

CREATE INDEX IF NOT EXISTS idx_opportunity_requirements_opportunity
  ON opportunity_requirements(opportunity_id, verification_status);
