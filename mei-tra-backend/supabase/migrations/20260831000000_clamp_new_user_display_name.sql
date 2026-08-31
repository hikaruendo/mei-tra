-- Clamp the display name handle_new_user copies out of the sign-up metadata.
--
-- `raw_user_meta_data` is written by whatever calls signUp / signInAnonymously,
-- so it is client-controlled: the guest name field's maxLength is a UX guard,
-- not a boundary. user_profiles.display_name is VARCHAR(100) NOT NULL with a
-- `char_length >= 1` check, and this function swallows every error
-- (RAISE WARNING, RETURN NEW) so the auth user is still created. A name that is
-- too long, blank, or whitespace-only therefore produced an auth user with NO
-- profile row — and AuthService rejects the token of any user without one, so
-- that account could never sign in again and could not be repaired from the
-- client.
--
-- Trim, drop to NULL when nothing is left, fall back to the same 'Player' as
-- before, then cut to the column width. Same for username, whose only
-- constraint is `>= 3` — a 1- or 2-character supplied username hit the same
-- swallowed failure.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    supplied_username TEXT;
    supplied_display_name TEXT;
BEGIN
    supplied_username := NULLIF(btrim(COALESCE(NEW.raw_user_meta_data->>'username', '')), '');
    supplied_display_name := NULLIF(btrim(COALESCE(NEW.raw_user_meta_data->>'display_name', '')), '');

    INSERT INTO public.user_profiles (id, username, display_name)
    VALUES (
        NEW.id,
        CASE
            WHEN char_length(supplied_username) BETWEEN 3 AND 50 THEN supplied_username
            ELSE 'user_' || substr(NEW.id::text, 1, 8)
        END,
        left(COALESCE(supplied_display_name, supplied_username, 'Player'), 100)
    );
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- エラーが発生してもユーザー作成は継続
        RAISE WARNING 'Failed to create user profile: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql;
