import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import * as path from 'path';

// Load environment variables from .env.development by default
config({ path: path.resolve(__dirname, '../.env.development') });

async function main() {
  const url = process.env.SUPABASE_URL_DEV;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY_DEV ||
    process.env.SUPABASE_ANON_KEY_DEV;

  if (!url || !key) {
    console.error(
      'Missing SUPABASE_URL_DEV or SUPABASE_SERVICE_ROLE_KEY_DEV/SUPABASE_ANON_KEY_DEV',
    );
    console.error('Make sure .env.development is properly configured.');
    process.exit(1);
  }

  console.log(`Using Supabase URL: ${url}`);

  const supabase = createClient(url, key, {
    auth: { persistSession: false },
  });

  const { count, error: countError } = await supabase
    .from('rooms')
    .select('id', { count: 'exact', head: true });

  if (countError) {
    console.error('Failed to count rooms:', countError.message);
    process.exit(1);
  }

  if (!count || count === 0) {
    console.log('No rooms to delete.');
    return;
  }

  // Delete all rooms - using gte with a timestamp that's definitely before all records
  const { error } = await supabase
    .from('rooms')
    .delete()
    .gte('created_at', '1970-01-01');

  if (error) {
    console.error('Failed to delete rooms:', error.message);
    process.exit(1);
  }

  console.log(`Deleted ${count} rooms (and related records).`);
}

main().catch((error) => {
  console.error('Unexpected error while clearing rooms:', error);
  process.exit(1);
});
