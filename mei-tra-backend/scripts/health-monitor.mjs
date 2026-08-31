import { pathToFileURL } from 'node:url';

const DEFAULT_MAX_RESPONSE_MS = 30_000;
const DEFAULT_MAX_RSS_MB = 450;
const MAX_TIMESTAMP_AGE_MS = 60_000;

export function evaluateHealthResponse(
  payload,
  {
    now = Date.now(),
    responseMs,
    maxResponseMs = DEFAULT_MAX_RESPONSE_MS,
    maxRssMb = DEFAULT_MAX_RSS_MB,
  },
) {
  const failures = [];

  if (payload === null || typeof payload !== 'object') {
    return ['response body is not an object'];
  }
  if (payload.status !== 'ok' && payload.status !== 'degraded') {
    failures.push(`unexpected status: ${String(payload.status)}`);
  }
  if (
    payload.dependencies === null ||
    typeof payload.dependencies !== 'object' ||
    payload.dependencies.database !== 'ok'
  ) {
    failures.push('database readiness is unavailable');
  }
  if (
    typeof payload.timestamp !== 'number' ||
    Math.abs(now - payload.timestamp) > MAX_TIMESTAMP_AGE_MS
  ) {
    failures.push('timestamp is missing or stale');
  }
  if (typeof payload.uptime !== 'number' || payload.uptime < 0) {
    failures.push('uptime is invalid');
  }
  if (
    payload.activity === null ||
    typeof payload.activity !== 'object' ||
    typeof payload.activity.activeConnections !== 'number' ||
    payload.activity.activeConnections < 0
  ) {
    failures.push('active connection count is invalid');
  }
  if (
    payload.memory === null ||
    typeof payload.memory !== 'object' ||
    typeof payload.memory.rss !== 'number'
  ) {
    failures.push('RSS memory is unavailable');
  } else if (payload.memory.rss >= maxRssMb) {
    failures.push(`RSS memory ${payload.memory.rss}MB reached ${maxRssMb}MB`);
  }
  if (responseMs >= maxResponseMs) {
    failures.push(`response took ${responseMs}ms (limit ${maxResponseMs}ms)`);
  }

  return failures;
}

async function fetchHealth(url, maxResponseMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), maxResponseMs);
  const startedAt = performance.now();

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    const responseMs = Math.round(performance.now() - startedAt);
    if (!response.ok) {
      throw new Error(`health endpoint returned HTTP ${response.status}`);
    }

    return { payload: await response.json(), responseMs };
  } finally {
    clearTimeout(timeout);
  }
}

export async function monitorHealth({
  url,
  maxResponseMs = DEFAULT_MAX_RESPONSE_MS,
  maxRssMb = DEFAULT_MAX_RSS_MB,
  attempts = 3,
}) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const { payload, responseMs } = await fetchHealth(url, maxResponseMs);
      const failures = evaluateHealthResponse(payload, {
        responseMs,
        maxResponseMs,
        maxRssMb,
      });
      if (failures.length > 0) {
        throw new Error(failures.join('; '));
      }

      return { payload, responseMs, attempt };
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 5_000));
      }
    }
  }

  throw lastError;
}

const isDirectExecution =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  const url = process.env.HEALTH_URL;
  if (!url) {
    console.error('HEALTH_URL is required.');
    process.exit(2);
  }

  try {
    const result = await monitorHealth({
      url,
      maxResponseMs: Number(
        process.env.HEALTH_MAX_RESPONSE_MS || DEFAULT_MAX_RESPONSE_MS,
      ),
      maxRssMb: Number(process.env.HEALTH_MAX_RSS_MB || DEFAULT_MAX_RSS_MB),
      attempts: Number(process.env.HEALTH_ATTEMPTS || 3),
    });
    console.log(
      JSON.stringify({
        status: result.payload.status,
        responseMs: result.responseMs,
        attempt: result.attempt,
        rssMb: result.payload.memory.rss,
        activeConnections: result.payload.activity.activeConnections,
        database: result.payload.dependencies.database,
      }),
    );
  } catch (error) {
    console.error(
      `Backend health monitor failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}
