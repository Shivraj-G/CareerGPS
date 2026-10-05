-- Add origin and verification_status to tables to support AI-generated content

ALTER TABLE careers 
ADD COLUMN origin VARCHAR(30) NOT NULL DEFAULT 'curated' CHECK (origin IN ('curated', 'ai_generated'));

ALTER TABLE skills 
ADD COLUMN origin VARCHAR(30) NOT NULL DEFAULT 'curated' CHECK (origin IN ('curated', 'ai_generated')),
ADD COLUMN verification_status VARCHAR(30) NOT NULL DEFAULT 'verified' CHECK (verification_status IN ('verified', 'needs_review', 'unverified'));

ALTER TABLE career_skills 
ADD COLUMN origin VARCHAR(30) NOT NULL DEFAULT 'curated' CHECK (origin IN ('curated', 'ai_generated')),
ADD COLUMN verification_status VARCHAR(30) NOT NULL DEFAULT 'verified' CHECK (verification_status IN ('verified', 'needs_review', 'unverified'));

ALTER TABLE pathways 
ADD COLUMN origin VARCHAR(30) NOT NULL DEFAULT 'curated' CHECK (origin IN ('curated', 'ai_generated'));

ALTER TABLE pathway_steps 
ADD COLUMN origin VARCHAR(30) NOT NULL DEFAULT 'curated' CHECK (origin IN ('curated', 'ai_generated')),
ADD COLUMN verification_status VARCHAR(30) NOT NULL DEFAULT 'verified' CHECK (verification_status IN ('verified', 'needs_review', 'unverified'));
