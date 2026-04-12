-- Fix cron job for cleaning up abandoned private game rooms
-- Runs pg_cron job through a SECURITY DEFINER function that bypasses RLS checks

CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- Remove any previous definition of the job to keep things idempotent
DO $$
BEGIN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname = 'cleanup-abandoned-private-rooms';
EXCEPTION
    WHEN undefined_table THEN NULL;
    WHEN OTHERS THEN NULL;
END $$;

-- Allow the postgres role (used by pg_cron) to delete stale private rooms
DROP POLICY IF EXISTS "Cron cleanup can delete private rooms" ON rooms;
CREATE POLICY "Cron cleanup can delete private rooms" ON rooms
    FOR DELETE TO postgres
    USING (true);

DROP POLICY IF EXISTS "Cron cleanup can inspect room membership" ON room_players;
CREATE POLICY "Cron cleanup can inspect room membership" ON room_players
    FOR SELECT TO postgres
    USING (true);

-- Helper to remove abandoned private rooms older than 7 days with no active players
CREATE OR REPLACE FUNCTION public.cleanup_abandoned_private_rooms()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM rooms
    WHERE COALESCE((settings ->> 'isPrivate')::boolean, false) = true
      AND status = 'abandoned'
      AND COALESCE(last_activity_at, updated_at, created_at) < NOW() - INTERVAL '7 days'
      AND NOT EXISTS (
          SELECT 1
          FROM room_players
          WHERE room_players.room_id = rooms.id
      );
END;
$$;

COMMENT ON FUNCTION public.cleanup_abandoned_private_rooms IS
    'Deletes game rooms marked as private and abandoned once they are inactive for 7+ days and have no players.';

-- Schedule the job to execute daily at 02:00 UTC
SELECT cron.schedule(
    'cleanup-abandoned-private-rooms',
    '0 2 * * *',
    $$
    SELECT public.cleanup_abandoned_private_rooms();
    $$
);
