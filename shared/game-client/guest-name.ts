/**
 * The name a guest types before signing in anonymously.
 *
 * It travels as `display_name` in the Supabase sign-in metadata, which the
 * `handle_new_user` trigger copies into `user_profiles.display_name`, and from
 * there onto the player's seat plate. The column is `VARCHAR(100) NOT NULL`
 * with a `char_length >= 1` check, and the trigger swallows constraint errors
 * — so an over-long or empty name would create an auth user with no profile
 * row, which the backend then rejects on every token check. Hence the clamp
 * and the fallback below rather than letting whatever was typed through.
 */

/** Well under the column's 100, and about as much as a seat plate can show. */
export const GUEST_NAME_MAX_LENGTH = 20;

export const randomGuestNumber = (): number =>
  Math.floor(1000 + Math.random() * 9000);

export const normalizeGuestName = (input: string, fallback: string): string => {
  const trimmed = input.trim().replace(/\s+/gu, ' ');
  return trimmed ? trimmed.slice(0, GUEST_NAME_MAX_LENGTH) : fallback;
};
