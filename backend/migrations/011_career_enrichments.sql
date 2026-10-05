CREATE TABLE IF NOT EXISTS career_enrichments (
    career_id UUID PRIMARY KEY REFERENCES careers(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    key_information JSONB NOT NULL DEFAULT '{}'::jsonb,
    responsibilities JSONB NOT NULL DEFAULT '[]'::jsonb,
    qualifications JSONB NOT NULL DEFAULT '[]'::jsonb,
    generated_by VARCHAR(50) NOT NULL DEFAULT 'ai_service',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
