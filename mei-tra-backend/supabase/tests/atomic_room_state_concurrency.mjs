import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL_DEV;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY_DEV;

assert.ok(supabaseUrl, 'SUPABASE_URL_DEV is required');
assert.ok(serviceRoleKey, 'SUPABASE_SERVICE_ROLE_KEY_DEV is required');

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});
const roomId = randomUUID();

try {
  const { error: roomError } = await supabase.from('rooms').insert({
    id: roomId,
    name: 'Atomic concurrency test',
    host_id: 'concurrency-host',
  });
  assert.ifError(roomError);

  const { error: stateError } = await supabase.from('game_states').insert({
    room_id: roomId,
    state_data: { players: [], playerStates: {} },
    team_assignments: {},
  });
  assert.ifError(stateError);

  const updateRound = (roundNumber) =>
    supabase.rpc('atomic_update_game_state', {
      p_room_id: roomId,
      p_state_patch: {},
      p_scalar_patch: { roundNumber },
      p_expected_version: 0,
    });

  const results = await Promise.all([updateRound(2), updateRound(3)]);
  const successfulResults = results.filter((result) => !result.error);
  const failedResults = results.filter((result) => result.error);

  assert.equal(successfulResults.length, 1, 'exactly one update must succeed');
  assert.equal(failedResults.length, 1, 'exactly one update must conflict');
  console.log(
    JSON.stringify({
      failedUpdate: failedResults[0].error,
    }),
  );
  assert.equal(failedResults[0].error.code, 'PT409');

  const { data: persistedState, error: readError } = await supabase
    .from('game_states')
    .select('version, round_number')
    .eq('room_id', roomId)
    .single();
  assert.ifError(readError);
  assert.equal(persistedState.version, 1);
  assert.ok(
    persistedState.round_number === 2 || persistedState.round_number === 3,
    `unexpected round number: ${persistedState.round_number}`,
  );

  console.log(
    JSON.stringify({
      roomId,
      successfulRound: persistedState.round_number,
      conflictCode: failedResults[0].error.code,
      version: persistedState.version,
    }),
  );
} finally {
  await supabase.from('rooms').delete().eq('id', roomId);
}
