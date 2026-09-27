-- CareerGPS Phase 2 foundation seed
-- Purpose:
--   Seed only catalogue entries explicitly represented in the project specification
--   and a small set of current official Goa source registries.
--
-- IMPORTANT:
--   These catalogue records are deliberately NOT published. The project specification
--   says the initial seed is a starting catalogue and must not be treated as fully
--   verified. Review/verify records before changing record_status to 'published'.
--
-- Idempotency:
--   Skills/careers use their natural unique keys.
--   Sources are inserted only when the same name + base_url pair does not already exist.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Official source registry
-- ---------------------------------------------------------------------------
INSERT INTO sources (name, source_type, base_url, organization, is_approved, access_notes)
SELECT
  'Government of Goa - Recruitment',
  'official_government',
  'https://www.goa.gov.in/citizen/recruitment/',
  'Government of Goa',
  FALSE,
  'Official recruitment listing. Source is registered for later ingestion/review; it is not auto-approved by this seed.'
WHERE NOT EXISTS (
  SELECT 1 FROM sources
  WHERE name = 'Government of Goa - Recruitment'
    AND base_url = 'https://www.goa.gov.in/citizen/recruitment/'
);

INSERT INTO sources (name, source_type, base_url, organization, is_approved, access_notes)
SELECT
  'Goa Staff Selection Commission',
  'official_government',
  'https://gssc.goa.gov.in/',
  'Goa Staff Selection Commission',
  FALSE,
  'Official GSSC website. Register first; approve through the admin workflow before ingestion.'
WHERE NOT EXISTS (
  SELECT 1 FROM sources
  WHERE name = 'Goa Staff Selection Commission'
    AND base_url = 'https://gssc.goa.gov.in/'
);

INSERT INTO sources (name, source_type, base_url, organization, is_approved, access_notes)
SELECT
  'Directorate of Technical Education, Goa',
  'official_government',
  'https://www.dte.goa.gov.in/',
  'Government of Goa - Directorate of Technical Education',
  FALSE,
  'Official DTE website for technical/professional education information. Register first; approve through the admin workflow before ingestion.'
WHERE NOT EXISTS (
  SELECT 1 FROM sources
  WHERE name = 'Directorate of Technical Education, Goa'
    AND base_url = 'https://www.dte.goa.gov.in/'
);

-- ---------------------------------------------------------------------------
-- 2. Controlled skill catalogue
-- These names occur explicitly in the project specification/demo examples.
-- They remain needs_review until the data owner verifies the catalogue.
-- ---------------------------------------------------------------------------
INSERT INTO skills (name, record_status)
VALUES
  ('Python', 'needs_review'),
  ('SQL', 'needs_review'),
  ('JavaScript', 'needs_review'),
  ('HTML', 'needs_review'),
  ('Excel', 'needs_review'),
  ('Power BI', 'needs_review'),
  ('Accounting', 'needs_review'),
  ('Reporting', 'needs_review'),
  ('Data Handling', 'needs_review'),
  ('Business Knowledge', 'needs_review'),
  ('Portfolio', 'needs_review')
ON CONFLICT (name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Career catalogue
-- These career titles are explicitly used in the project specification and
-- hackathon-demo examples. No unsupported qualifications/responsibilities or
-- career-skill requirements are invented here.
-- ---------------------------------------------------------------------------
INSERT INTO careers (
  title,
  description,
  responsibilities,
  qualifications,
  entry_routes,
  record_status,
  verification_status
)
VALUES
  (
    'Backend Developer',
    NULL,
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    'needs_review',
    'unverified'
  ),
  (
    'AI Engineer',
    NULL,
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    'needs_review',
    'unverified'
  ),
  (
    'Data Analyst',
    NULL,
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    'needs_review',
    'unverified'
  ),
  (
    'Business Analyst',
    NULL,
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    'needs_review',
    'unverified'
  ),
  (
    'Finance Technology',
    NULL,
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    'needs_review',
    'unverified'
  ),
  (
    'ERP Specialist',
    NULL,
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    'needs_review',
    'unverified'
  )
ON CONFLICT (title) DO NOTHING;

COMMIT;
