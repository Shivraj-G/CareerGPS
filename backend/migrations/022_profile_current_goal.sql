-- Migration 022: Ensure current_goal column exists on user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS current_goal JSONB;
