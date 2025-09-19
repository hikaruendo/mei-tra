-- Enable pg_cron extension used for scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Ensure idempotency: remove prior job with same name
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'cleanup_game_data_daily';

-- Function to delete stale gameplay data while keeping auth accounts
CREATE OR REPLACE FUNCTION public.cleanup_old_game_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM game_history WHERE "timestamp" < NOW() - INTERVAL '30 days';
    DELETE FROM game_states WHERE updated_at < NOW() - INTERVAL '30 days';
    DELETE FROM room_players WHERE joined_at < NOW() - INTERVAL '30 days';
    DELETE FROM rooms WHERE updated_at < NOW() - INTERVAL '30 days';
END;
$$;

-- Run the cleanup every day at 03:00 UTC
SELECT cron.schedule(
    'cleanup_game_data_daily',
    '0 3 * * *',
    $$ CALL public.cleanup_old_game_data(); $$
);
