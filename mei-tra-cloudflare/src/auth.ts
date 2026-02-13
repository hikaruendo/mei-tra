import { SupabaseClient } from '@supabase/supabase-js';

export async function validateToken(
  supabase: SupabaseClient,
  token: string,
): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return null;
    }

    return data.user.id;
  } catch {
    return null;
  }
}
