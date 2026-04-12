ALTER TABLE user_profiles
  ALTER COLUMN total_score TYPE NUMERIC(10,1)
  USING total_score::NUMERIC(10,1);

ALTER TABLE user_profiles
  ALTER COLUMN total_score SET DEFAULT 0;
