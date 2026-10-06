-- Update user_pathways status constraint to allow 'generated'
ALTER TABLE user_pathways DROP CONSTRAINT IF EXISTS user_pathways_status_check;
ALTER TABLE user_pathways ADD CONSTRAINT user_pathways_status_check CHECK (status IN ('active', 'completed', 'archived', 'generated'));
