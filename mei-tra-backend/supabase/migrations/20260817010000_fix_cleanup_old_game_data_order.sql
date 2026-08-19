-- cleanup_old_game_data (20260111090000) deletes room_players before rooms,
-- but reject_room_player_seat_delete (20260810100000) raises PT422 for any
-- room_players delete whose room still exists — so whenever a >30-day-old seat
-- coexists with a still-live room at 03:00 UTC, the whole job aborts and none
-- of the stale game data is purged. Delete rooms first instead: the ON DELETE
-- CASCADE to room_players passes the trigger because the parent room row is
-- already gone when the cascaded delete fires, and a seat can never outlive
-- its room, so the standalone room_players delete was redundant anyway.
-- The anonymous-guest cleanup (20260817000000) relies on this pipeline to
-- release finished rooms and their memberships.

CREATE OR REPLACE FUNCTION public.cleanup_old_game_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM game_history WHERE "timestamp" < NOW() - INTERVAL '30 days';
    DELETE FROM game_states WHERE updated_at < NOW() - INTERVAL '30 days';
    DELETE FROM rooms WHERE updated_at < NOW() - INTERVAL '30 days';
END;
$$;
