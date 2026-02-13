import { SupabaseClient } from '@supabase/supabase-js';
import { BasicProfile } from '../types';

interface UserProfileRow {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

export async function findProfileById(
  supabase: SupabaseClient,
  id: string,
): Promise<BasicProfile | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, display_name, avatar_url')
    .eq('id', id)
    .single();

  if (error || !data) {
    return null;
  }

  return toBasicProfile(data as UserProfileRow);
}

export async function findProfilesByIds(
  supabase: SupabaseClient,
  ids: string[],
): Promise<Map<string, BasicProfile>> {
  if (ids.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, display_name, avatar_url')
    .in('id', ids);

  if (error || !data) {
    return new Map();
  }

  const map = new Map<string, BasicProfile>();
  for (const row of data as UserProfileRow[]) {
    map.set(row.id, toBasicProfile(row));
  }
  return map;
}

function toBasicProfile(row: UserProfileRow): BasicProfile {
  return {
    userId: row.id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url ?? undefined,
    rankTier: 'bronze',
  };
}
