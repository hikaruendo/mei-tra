import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Env } from './env';

export function createSupabaseClient(env: Env): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}
