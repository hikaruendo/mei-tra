ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS account_deletion_started_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_user_profiles_account_deletion_started_at
  ON public.user_profiles(account_deletion_started_at)
  WHERE account_deletion_started_at IS NOT NULL;

DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;
CREATE POLICY "Users can update their own profile" ON public.user_profiles
  FOR UPDATE
  USING (auth.uid() = id AND account_deletion_started_at IS NULL)
  WITH CHECK (auth.uid() = id AND account_deletion_started_at IS NULL);
