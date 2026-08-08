CREATE OR REPLACE FUNCTION public.reject_deleting_room_player_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = NEW.user_id
      AND account_deletion_started_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'account_deletion_in_progress user=%', NEW.user_id
      USING ERRCODE = 'PT403';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reject_deleting_room_player_user ON public.room_players;

CREATE TRIGGER reject_deleting_room_player_user
BEFORE INSERT OR UPDATE OF user_id ON public.room_players
FOR EACH ROW
EXECUTE FUNCTION public.reject_deleting_room_player_user();

CREATE OR REPLACE FUNCTION public.reject_deleting_room_host()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.host_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.host_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE id = NEW.host_id::uuid
        AND account_deletion_started_at IS NOT NULL
    )
  THEN
    RAISE EXCEPTION 'account_deletion_in_progress host=%', NEW.host_id
      USING ERRCODE = 'PT403';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reject_deleting_room_host ON public.rooms;

CREATE TRIGGER reject_deleting_room_host
BEFORE INSERT OR UPDATE OF host_id ON public.rooms
FOR EACH ROW
EXECUTE FUNCTION public.reject_deleting_room_host();
