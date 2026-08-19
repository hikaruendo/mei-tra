-- Anonymous sign-ins use the `authenticated` role, so every policy written for
-- authenticated users now also applies to throwaway guest accounts. That turned
-- the self-service write policies on user_profiles into an open door: a guest
-- could PATCH their own row through PostgREST and set display_name, username,
-- stats, or avatar_url to anything, skipping the backend's validation entirely.
-- Pointing avatar_url at an external image also side-stepped the guest upload
-- block added in 20260819000000, since that only guards our storage bucket.
--
-- Every client write already goes through the backend (PUT /api/user-profile/:id)
-- on the service role; the only direct client access is a SELECT to load the
-- signed-in user's own profile. So drop the self-service write policies and
-- revoke the matching table privileges, leaving reads untouched.
--
-- Profile creation is unaffected: handle_new_user is SECURITY DEFINER owned by
-- postgres and user_profiles does not FORCE row level security, so the trigger
-- bypasses RLS. The service role keeps full access through its own policy.

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;

REVOKE INSERT, UPDATE, DELETE ON public.user_profiles FROM anon, authenticated;
