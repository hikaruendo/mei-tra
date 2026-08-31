import test from 'node:test';
import assert from 'node:assert/strict';
import { findDirectDatabaseCalls } from './check-no-direct-db-access.mjs';

test('detects renamed Supabase imports and local aliases', () => {
  const source = `
    import { supabase as authClient } from '@/lib/supabase';
    const database = authClient;
    database.from('user_profiles').select('*');
    authClient.rpc('unsafe_write');
  `;

  assert.deepEqual(findDirectDatabaseCalls(source), [4, 5]);
});

test('allows auth-only calls on the imported Supabase client', () => {
  const source = `
    import { supabase } from '@/lib/supabase';
    await supabase.auth.getSession();
    await supabase.auth.signOut();
  `;

  assert.deepEqual(findDirectDatabaseCalls(source), []);
});
