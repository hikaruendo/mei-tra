import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateHealthResponse } from './health-monitor.mjs';

const now = Date.parse('2026-08-31T00:00:00.000Z');
const healthyPayload = {
  status: 'ok',
  timestamp: now,
  uptime: 12,
  activity: { activeConnections: 2 },
  memory: { rss: 120 },
};

test('accepts a fresh healthy or idle response below thresholds', () => {
  assert.deepEqual(
    evaluateHealthResponse(healthyPayload, { now, responseMs: 500 }),
    [],
  );
  assert.deepEqual(
    evaluateHealthResponse(
      { ...healthyPayload, status: 'degraded' },
      { now, responseMs: 500 },
    ),
    [],
  );
});

test('rejects stale timestamps and invalid connection counts', () => {
  const failures = evaluateHealthResponse(
    {
      ...healthyPayload,
      timestamp: now - 61_000,
      activity: { activeConnections: -1 },
    },
    { now, responseMs: 500 },
  );

  assert.ok(failures.includes('timestamp is missing or stale'));
  assert.ok(failures.includes('active connection count is invalid'));
});

test('rejects memory and response latency at their limits', () => {
  const failures = evaluateHealthResponse(
    { ...healthyPayload, memory: { rss: 450 } },
    { now, responseMs: 30_000 },
  );

  assert.ok(failures.includes('RSS memory 450MB reached 450MB'));
  assert.ok(failures.includes('response took 30000ms (limit 30000ms)'));
});
