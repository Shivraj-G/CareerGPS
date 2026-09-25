ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS constraints JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_constraints_object;

ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_constraints_object
  CHECK (jsonb_typeof(constraints) = 'object');
