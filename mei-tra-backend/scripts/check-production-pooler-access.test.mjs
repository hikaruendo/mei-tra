import test from 'node:test';
import assert from 'node:assert/strict';
import { checkProductionPoolerAccess } from './check-production-pooler-access.mjs';

const credentials = { accessToken: 'test-token', projectRef: 'test-project' };

test('accepts a primary pooler config without logging its connection string', async () => {
  await assert.doesNotReject(checkProductionPoolerAccess({
    ...credentials,
    fetchImpl: async (url, options) => {
      assert.equal(url, 'https://api.supabase.com/v1/projects/test-project/config/database/pooler');
      assert.equal(options.headers.Authorization, 'Bearer test-token');
      return {
        ok: true,
        json: async () => [{ database_type: 'PRIMARY', connection_string: 'postgresql://secret' }],
      };
    },
  }));
});

test('explains the extra scoped-token permission on 403', async () => {
  await assert.rejects(
    checkProductionPoolerAccess({
      ...credentials,
      fetchImpl: async () => ({ status: 403, ok: false }),
    }),
    /Connection Pooling: Read/,
  );
});

test('rejects an unusable pooler response', async () => {
  await assert.rejects(
    checkProductionPoolerAccess({
      ...credentials,
      fetchImpl: async () => ({ ok: true, json: async () => [] }),
    }),
    /primary IPv4 pooler connection string/,
  );
});
