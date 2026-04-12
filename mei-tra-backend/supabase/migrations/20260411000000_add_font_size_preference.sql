ALTER TABLE user_profiles
ALTER COLUMN preferences SET DEFAULT '{
  "notifications": true,
  "sound": true,
  "theme": "light",
  "fontSize": "standard"
}'::jsonb;

UPDATE user_profiles
SET preferences = jsonb_set(
  COALESCE(preferences, '{}'::jsonb),
  '{fontSize}',
  '"standard"'::jsonb,
  true
)
WHERE COALESCE(preferences->>'fontSize', '') = '';
