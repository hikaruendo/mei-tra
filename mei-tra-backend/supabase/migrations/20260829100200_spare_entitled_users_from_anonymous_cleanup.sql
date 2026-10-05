-- cleanup_stale_anonymous_users (20260817000000) deletes idle anonymous
-- accounts outright, and entitlements.user_id cascades from auth.users — so a
-- guest holding a paid grant (a webhook race, a TRANSFER, or any future gap in
-- the purchase gating) would be purged together with their purchase. Purchases
-- are supposed to require a registered account; this guard makes the purge
-- safe even when that assumption breaks. The cron schedule itself is
-- unchanged, so only the function body is redefined (same approach as
-- 20260817010000).

CREATE OR REPLACE FUNCTION public.cleanup_stale_anonymous_users()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    stale_user_ids UUID[];
BEGIN
    -- A missing user_profiles row means the creation trigger failed; those
    -- accounts can never authenticate, so age them out by created_at instead.
    -- Users mid-upgrade are spared: updateUser({email}) leaves is_anonymous
    -- true until the confirmation link is clicked, storing the address in
    -- email_change — deleting them would destroy an account the player
    -- believes they registered.
    SELECT COALESCE(array_agg(u.id), '{}') INTO stale_user_ids
    FROM auth.users u
    LEFT JOIN public.user_profiles p ON p.id = u.id
    WHERE u.is_anonymous = true
      AND u.email IS NULL
      AND COALESCE(u.email_change, '') = ''
      AND (
        p.last_seen_at < NOW() - INTERVAL '30 days'
        OR (p.id IS NULL AND u.created_at < NOW() - INTERVAL '30 days')
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.active_room_memberships m
        WHERE m.user_id = u.id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.entitlements e
        WHERE e.user_id = u.id
      );

    IF array_length(stale_user_ids, 1) IS NULL THEN
        RETURN;
    END IF;

    DELETE FROM auth.users WHERE id = ANY (stale_user_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_stale_anonymous_users() FROM PUBLIC, anon, authenticated;
