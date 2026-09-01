import http from 'k6/http';
import { check, sleep } from 'k6';

const baseUrl = (__ENV.BASE_URL || 'http://127.0.0.1:3333').replace(/\/$/, '');
const virtualUsers = Number(__ENV.K6_VUS || 10);
const duration = __ENV.K6_DURATION || '30s';

export const options = {
  scenarios: {
    health_reads: {
      executor: 'constant-vus',
      exec: 'readHealth',
      vus: virtualUsers,
      duration,
    },
    socket_handshakes: {
      executor: 'constant-vus',
      exec: 'openSocketHandshake',
      vus: Math.max(1, Math.ceil(virtualUsers / 4)),
      duration,
    },
  },
  thresholds: {
    checks: ['rate>0.99'],
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000'],
  },
};

export function readHealth() {
  const response = http.get(`${baseUrl}/api/health`, {
    tags: { endpoint: 'health' },
  });
  check(response, {
    'health returns 200': (result) => result.status === 200,
    'health returns an accepted state': (result) => {
      try {
        const status = result.json('status');
        return status === 'ok' || status === 'degraded';
      } catch {
        return false;
      }
    },
  });
  sleep(0.2);
}

export function openSocketHandshake() {
  const response = http.get(
    `${baseUrl}/socket.io/?EIO=4&transport=polling&t=${Date.now()}`,
    { tags: { endpoint: 'socket-handshake' } },
  );
  check(response, {
    'socket handshake returns 200': (result) => result.status === 200,
    'socket handshake returns an Engine.IO session': (result) =>
      typeof result.body === 'string' && result.body.startsWith('0{'),
  });
  sleep(0.5);
}
