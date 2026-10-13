-- 024_user_full_name.sql
-- Add canonical full_name column to users and user_profiles tables
-- to support persistent user identity and avoid deriving names from email or IDs.

ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(250);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS full_name VARCHAR(250);

-- Also ensure user_profiles has an index or matches existing pattern if needed
CREATE INDEX IF NOT EXISTS idx_users_full_name ON users(full_name);
