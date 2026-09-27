-- CareerGPS: enable verified development/demo pathway templates.
-- The pathway generation API intentionally refuses published templates whose
-- verification_status is not 'verified'. The development catalogue is seeded
-- as the controlled demo dataset, so these templates are explicitly marked
-- verified for local/demo use. Production datasets should use the review flow.

UPDATE pathways
SET verification_status = 'verified'
WHERE pathway_type = 'template'
  AND record_status = 'published'
  AND source_url = 'https://careergps.local/catalogue';
