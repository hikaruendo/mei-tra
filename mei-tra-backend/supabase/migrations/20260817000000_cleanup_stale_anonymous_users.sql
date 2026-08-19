-- Anonymous (guest) accounts are created via signInAnonymously and abandoned
-- freely, so purge the ones that have been inactive for 30 days. Deleting the
-- auth.users row cascades to user_profiles, active_room_memberships,
-- room_membership_events, chat_members, push_tokens and push_receipts;
-- room_players.user_id / game_participants.user_id / chat_messages.sender_id
-- are ON DELETE SET NULL so game history keeps its name snapshots.
--
-- Avatars are deliberately left alone here. storage.objects has no FK to
-- auth.users, so the rows survive and the folder becomes a genuine orphan once
-- user_profiles cascades away; AvatarOrphanCleanupService then removes it
-- through the Storage API. Deleting the rows with SQL would only drop the
-- metadata, leave the file on the storage backend, and hide it from that
-- sweeper (which enumerates the bucket via those same rows) forever.

-- Ensure idempotency: remove prior job with same name
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'cleanup_stale_anonymous_users_daily';

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
      );

    IF array_length(stale_user_ids, 1) IS NULL THEN
        RETURN;
    END IF;

    DELETE FROM auth.users WHERE id = ANY (stale_user_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_stale_anonymous_users() FROM PUBLIC, anon, authenticated;

-- Run the cleanup every day at 04:00 UTC (chat/room/game cleanups run 02:00-03:00)
SELECT cron.schedule(
    'cleanup_stale_anonymous_users_daily',
    '0 4 * * *',
    $$ SELECT public.cleanup_stale_anonymous_users(); $$
);
