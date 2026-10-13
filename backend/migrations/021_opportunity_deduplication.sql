-- Migration 021: Source-Aware Opportunity Deduplication and Unique Protection
-- Adds dedup_key to opportunities and ingestion_candidates,
-- Safely cleans up existing duplicates by re-pointing foreign keys to canonical records,
-- and creates unique protection against concurrent ingestion duplicates.

-- 1. Add dedup_key column to opportunities
ALTER TABLE opportunities
ADD COLUMN IF NOT EXISTS dedup_key VARCHAR(128);

-- 2. Add dedup_key column to ingestion_candidates
ALTER TABLE ingestion_candidates
ADD COLUMN IF NOT EXISTS dedup_key VARCHAR(128);

-- 3. Populate dedup_key for existing opportunities
UPDATE opportunities
SET dedup_key = CASE
  WHEN advertisement_number IS NOT NULL AND TRIM(advertisement_number) <> '' THEN
    'ad:' || SUBSTRING(encode(sha256((LOWER(TRIM(organization)) || '::' || LOWER(TRIM(advertisement_number)))::bytea), 'hex') FROM 1 FOR 32)
  ELSE
    'fp:' || SUBSTRING(encode(sha256((
      COALESCE(source_id::text, 'no-src') || '::' ||
      LOWER(TRIM(organization)) || '::' ||
      LOWER(TRIM(title)) || '::' ||
      LOWER(TRIM(COALESCE(location, ''))) ||
      CASE
        WHEN application_opening IS NOT NULL THEN '::cycle:' || TO_CHAR(application_opening AT TIME ZONE 'UTC', 'YYYY-MM')
        ELSE ''
      END
    )::bytea), 'hex') FROM 1 FOR 32)
END;

-- 4. Populate dedup_key for existing ingestion_candidates
UPDATE ingestion_candidates
SET dedup_key = CASE
  WHEN (candidate_data->>'advertisement_number') IS NOT NULL AND TRIM(candidate_data->>'advertisement_number') <> '' THEN
    'ad:' || SUBSTRING(encode(sha256((LOWER(TRIM(COALESCE(candidate_data->>'organization', ''))) || '::' || LOWER(TRIM(candidate_data->>'advertisement_number')))::bytea), 'hex') FROM 1 FOR 32)
  ELSE
    'fp:' || SUBSTRING(encode(sha256((
      COALESCE((SELECT r.source_id::text FROM ingestion_runs r WHERE r.id = ingestion_candidates.run_id), 'no-src') || '::' ||
      LOWER(TRIM(COALESCE(candidate_data->>'organization', ''))) || '::' ||
      LOWER(TRIM(COALESCE(candidate_data->>'title', ''))) || '::' ||
      LOWER(TRIM(COALESCE(candidate_data->>'location', ''))) ||
      CASE
        WHEN (candidate_data->>'application_opening') IS NOT NULL AND candidate_data->>'application_opening' ~ '^\d{4}-\d{2}' THEN
          '::cycle:' || SUBSTRING(candidate_data->>'application_opening' FROM 1 FOR 7)
        ELSE ''
      END
    )::bytea), 'hex') FROM 1 FOR 32)
END;

-- 5. Deduplicate existing opportunities safely within transaction
DO $$
DECLARE
  grp RECORD;
  canonical_id UUID;
  dup_ids UUID[];
BEGIN
  FOR grp IN (
    SELECT dedup_key, ARRAY_AGG(id ORDER BY created_at ASC, id ASC) AS ids
    FROM opportunities
    GROUP BY dedup_key
    HAVING COUNT(*) > 1
  ) LOOP
    canonical_id := grp.ids[1];
    dup_ids := grp.ids[2:ARRAY_LENGTH(grp.ids, 1)];

    -- Repoint eligibility checks
    UPDATE eligibility_checks
    SET opportunity_id = canonical_id
    WHERE opportunity_id = ANY(dup_ids);

    -- Delete conflicting career_opportunities before repointing
    DELETE FROM career_opportunities co_dup
    WHERE co_dup.opportunity_id = ANY(dup_ids)
      AND EXISTS (
        SELECT 1 FROM career_opportunities co_canon
        WHERE co_canon.opportunity_id = canonical_id AND co_canon.career_id = co_dup.career_id
      );

    -- Repoint remaining career_opportunities
    UPDATE career_opportunities
    SET opportunity_id = canonical_id
    WHERE opportunity_id = ANY(dup_ids);

    -- Clean up opportunity_requirements
    IF EXISTS (SELECT 1 FROM opportunity_requirements WHERE opportunity_id = canonical_id) THEN
      DELETE FROM opportunity_requirements WHERE opportunity_id = ANY(dup_ids);
    ELSE
      UPDATE opportunity_requirements SET opportunity_id = canonical_id WHERE opportunity_id = ANY(dup_ids);
    END IF;

    -- Delete duplicate opportunity rows
    DELETE FROM opportunities WHERE id = ANY(dup_ids);
  END LOOP;
END $$;

-- 6. Add uniqueness constraint on opportunities(dedup_key)
ALTER TABLE opportunities
ALTER COLUMN dedup_key SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_opportunities_dedup_key
ON opportunities (dedup_key);

CREATE INDEX IF NOT EXISTS idx_ingestion_candidates_dedup_key
ON ingestion_candidates (dedup_key);
