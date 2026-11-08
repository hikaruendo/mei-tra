// Game load harness for a LOCAL backend and LOCAL Supabase.
//
// Each room is one anonymous guest host (this script) plus three COM seats
// playing real games: auth, room setup, blow, play, round results and state
// writes all go through the backend. Over a measurement window it reports
// server CPU time, heap, and the SQL the backend runs through PostgREST
// (`service_role` statements in pg_stat_statements), per minute and per action.
//
// Usage (from mei-tra-backend/, with the backend built and running):
//   npm run build && node --max-old-space-size=320 dist/main.js
//   ROOMS=10 npm run load:game
//   npm run load:game -- --cleanup   # stop the backend first; see below
//
// Rooms keep playing with COM in every seat after this script disconnects, so
// between runs stop the backend, run --cleanup to delete the `loadtest-` rooms,
// and start it again.
//
// Env: ROOMS (default 1), WARMUP_S (20), MEASURE_S (90),
//      BACKEND_URL (http://localhost:3333),
//      SUPABASE_URL / SUPABASE_ANON_KEY (default: `supabase status`),
//      SESSIONS_FILE (load/.guest-sessions.json), DB_CONTAINER.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const require = createRequire(path.join(backendDir, 'package.json'));
const { io } = require('socket.io-client');
const { createClient } = require('@supabase/supabase-js');

const ROOM_PREFIX = 'loadtest-';
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3333';
const ROOMS = Number(process.env.ROOMS ?? 1);
const WARMUP_S = Number(process.env.WARMUP_S ?? 20);
const MEASURE_S = Number(process.env.MEASURE_S ?? 90);
const SESSIONS_FILE =
  process.env.SESSIONS_FILE ??
  path.join(backendDir, 'load', '.guest-sessions.json');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function fail(message) {
  console.error(message);
  process.exit(1);
}

// The script creates rooms, guest users and real games, so it never points at
// anything but this machine.
function assertLocal(url, what) {
  const { hostname } = new URL(url);
  if (!['localhost', '127.0.0.1', '[::1]', '::1'].includes(hostname)) {
    fail(`${what} must be local, got ${url}`);
  }
}

function dbContainer() {
  if (process.env.DB_CONTAINER) return process.env.DB_CONTAINER;
  const config = fs.readFileSync(
    path.join(backendDir, 'supabase', 'config.toml'),
    'utf8',
  );
  const projectId = config.match(/^project_id\s*=\s*"([^"]+)"/m)?.[1];
  if (!projectId) fail('project_id not found in supabase/config.toml');
  return `supabase_db_${projectId}`;
}

function psql(sql) {
  return execFileSync('docker', [
    'exec',
    dbContainer(),
    'psql',
    '-U',
    'postgres',
    '-tAc',
    sql,
  ])
    .toString()
    .trim();
}

if (process.argv.includes('--cleanup')) {
  const deleted = psql(
    `with removed as (delete from public.rooms where name like '${ROOM_PREFIX}%' returning 1) select count(*) from removed`,
  );
  console.log(`deleted ${deleted} ${ROOM_PREFIX} rooms`);
  process.exit(0);
}

function supabaseConfig() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    return {
      url: process.env.SUPABASE_URL,
      anonKey: process.env.SUPABASE_ANON_KEY,
    };
  }
  const status = execFileSync('npx', ['supabase', 'status', '-o', 'env'], {
    cwd: backendDir,
    stdio: ['ignore', 'pipe', 'ignore'],
  }).toString();
  const read = (key) =>
    status.match(new RegExp(`^${key}="?([^"\\n]+)"?$`, 'm'))?.[1];
  const url = read('API_URL');
  const anonKey = read('ANON_KEY');
  if (!url || !anonKey) fail('Local Supabase is not running');
  return { url, anonKey };
}

// ---------- guest sessions ----------
// Local Supabase allows 30 anonymous sign-ins per hour, so sessions are kept
// and refreshed rather than created on every run.
async function guestSessions(count, supabase) {
  let saved = [];
  try {
    saved = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
  } catch {
    saved = [];
  }
  const sessions = [];
  for (let index = 0; index < count; index += 1) {
    const client = createClient(supabase.url, supabase.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    let session = null;
    if (saved[index]) {
      const { data, error } = await client.auth.refreshSession({
        refresh_token: saved[index].refreshToken,
      });
      if (!error && data.session) session = data;
    }
    if (!session) {
      const { data, error } = await client.auth.signInAnonymously();
      if (error) fail(`Anonymous sign-in ${index} failed: ${error.message}`);
      session = data;
    }
    saved[index] = {
      accessToken: session.session.access_token,
      refreshToken: session.session.refresh_token,
      userId: session.user.id,
    };
    sessions.push(saved[index]);
  }
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(saved));
  return sessions;
}

// ---------- measurement ----------
function serverPid() {
  try {
    const { port } = new URL(BACKEND_URL);
    return execFileSync('lsof', ['-ti', `tcp:${port || 80}`, '-sTCP:LISTEN'])
      .toString()
      .trim()
      .split('\n')[0];
  } catch {
    return null;
  }
}

function cpuSeconds(pid) {
  if (!pid) return null;
  let time = execFileSync('ps', ['-o', 'time=', '-p', pid]).toString().trim();
  let days = 0;
  if (time.includes('-')) {
    const [dayPart, rest] = time.split('-');
    days = Number(dayPart);
    time = rest;
  }
  return (
    days * 86400 +
    time
      .split(':')
      .map(Number)
      .reduce((total, part) => total * 60 + part, 0)
  );
}

// Heap from the backend itself: macOS reports RSS after memory compression,
// which understates it.
async function backendMemory() {
  const response = await fetch(`${BACKEND_URL}/api/health`);
  const body = await response.json();
  return { heapUsed: body.memory.heapUsed, rss: body.memory.rss };
}

// Only the backend's own SQL; local Supabase also runs analytics, realtime and
// cron statements that cloud Supabase keeps out of the project database.
function appSql() {
  try {
    const [calls, ms] = psql(
      "select coalesce(sum(calls),0), coalesce(sum(total_exec_time),0) from pg_stat_statements where userid = (select oid from pg_roles where rolname = 'service_role')",
    )
      .split('|')
      .map(Number);
    return { calls, ms };
  } catch {
    return null;
  }
}

// ---------- players ----------
const stats = {
  roomsStarted: 0,
  actions: 0,
  latencies: [],
  errors: {},
  roundsConfirmed: 0,
  disconnects: 0,
  setupErrors: [],
};
let stopping = false;

const countError = (message) => {
  stats.errors[message] = (stats.errors[message] ?? 0) + 1;
};

const longestSuit = (hand) => {
  const counts = {};
  for (const card of hand) {
    if (card !== 'JOKER')
      counts[card.slice(-1)] = (counts[card.slice(-1)] ?? 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '♠';
};

// Plays as soon as it is this seat's turn: passes every blow, then tries the
// cards in hand until the server accepts one, leading with the JOKER last.
function startHost(index, session) {
  const seat = {
    roomId: null,
    seatId: null,
    player: null,
    hand: [],
    phase: null,
    pending: null,
    candidates: [],
    candidateIndex: 0,
    retries: 0,
  };
  const socket = io(BACKEND_URL, {
    auth: { token: session.accessToken, name: `LT${index}` },
    transports: ['websocket'],
    reconnection: false,
  });

  const readPlayers = (players) => {
    if (!Array.isArray(players)) return;
    const me = players.find((player) => player.userId === session.userId);
    if (!me) return;
    seat.player = me;
    seat.seatId = me.seatId;
    if (Array.isArray(me.hand)) seat.hand = [...me.hand];
  };

  const playCandidate = () => {
    if (seat.candidateIndex >= seat.candidates.length) {
      countError('harness: no card was accepted');
      seat.pending = null;
      return;
    }
    const card = seat.candidates[seat.candidateIndex];
    seat.pending = { card, startedAt: Date.now() };
    socket.emit('play-card', { roomId: seat.roomId, card });
  };

  const act = () => {
    if (!seat.roomId || stopping) return;
    if (seat.phase === 'blow') {
      if (seat.player?.hasRequiredBroken) {
        socket.emit('reveal-broken-hand', { roomId: seat.roomId });
      } else {
        socket.emit('pass-blow', { roomId: seat.roomId });
      }
    } else if (seat.phase === 'play') {
      seat.candidates = [
        ...seat.hand.filter((card) => card !== 'JOKER'),
        ...seat.hand.filter((card) => card === 'JOKER'),
      ];
      seat.candidateIndex = 0;
      seat.retries = 0;
      playCandidate();
    }
  };
  const onTurn = (seatId) => {
    if (seatId && seatId === seat.seatId) setTimeout(act, 50);
  };

  socket.on('connect', () => {
    socket.emit(
      'create-room',
      {
        name: `${ROOM_PREFIX}${index}`,
        pointsToWin: 50,
        teamAssignmentMethod: 'random',
        gameMode: 'normal',
      },
      (created) => {
        if (!created?.success || !created.room) {
          stats.setupErrors.push(`create-room ${index}: ${created?.error}`);
          return;
        }
        seat.roomId = created.room.id;
        socket.emit('fill-with-com', { roomId: seat.roomId }, (filled) => {
          if (filled?.success === false) {
            stats.setupErrors.push(`fill-with-com ${index}: ${filled.error}`);
          }
          socket.emit('start-game', { roomId: seat.roomId }, (started) => {
            if (started?.success === false) {
              stats.setupErrors.push(`start-game ${index}: ${started.error}`);
              return;
            }
            stats.roomsStarted += 1;
          });
        });
      },
    );
  });
  socket.on('connect_error', (error) =>
    stats.setupErrors.push(`connect ${index}: ${error.message}`),
  );

  socket.on('game-started', (payload) => {
    readPlayers(payload.players);
    seat.phase = 'blow';
    onTurn(payload.currentTurnSeatId);
  });
  socket.on('update-players', readPlayers);
  socket.on('new-round-started', (payload) => {
    readPlayers(payload.players);
    seat.phase = payload.gamePhase ?? 'blow';
  });
  socket.on('broken', (payload) => {
    readPlayers(payload.players);
    seat.phase = payload.gamePhase ?? 'blow';
  });
  socket.on('update-phase', (payload) => {
    if (payload?.phase) seat.phase = payload.phase;
  });
  socket.on('update-turn', onTurn);
  socket.on('turn-ping', () =>
    socket.emit('turn-ack', { roomId: seat.roomId }),
  );
  socket.on('round-results', () => {
    stats.roundsConfirmed += 1;
    socket.emit('confirm-round-results', { roomId: seat.roomId }, () => {});
  });
  socket.on('reveal-agari', () => {
    const card =
      seat.hand.find((candidate) => candidate !== 'JOKER') ?? seat.hand[0];
    if (card) socket.emit('select-negri', { roomId: seat.roomId, card });
  });
  socket.on('card-played', (payload) => {
    stats.actions += 1;
    readPlayers(payload.players);
    if (payload.seatId !== seat.seatId || !seat.pending) return;
    stats.latencies.push(Date.now() - seat.pending.startedAt);
    // Only the player who leads with the JOKER names the base suit.
    if (seat.pending.card === 'JOKER' && payload.field?.cards?.length === 1) {
      socket.emit('select-base-suit', {
        roomId: seat.roomId,
        suit: longestSuit(seat.hand),
      });
    }
    seat.pending = null;
  });
  socket.on('error-message', (message) => {
    if (!seat.pending) {
      // Another seat's broken hand is on show; the blow resumes after it.
      if (seat.phase === 'blow' && /reveal is pending/i.test(message)) {
        setTimeout(act, 1000);
        return;
      }
      countError(message);
      return;
    }
    if (/wait|being completed/i.test(message) && seat.retries < 10) {
      seat.retries += 1;
      setTimeout(playCandidate, 300);
      return;
    }
    seat.candidateIndex += 1;
    playCandidate();
  });
  socket.on('disconnect', (reason) => {
    if (stopping) return;
    stats.disconnects += 1;
    countError(`disconnect: ${reason}`);
  });
  return socket;
}

// ---------- run ----------
const percentile = (values, p) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[
    Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  ];
};
const round = (value, digits = 1) =>
  value === null || Number.isNaN(value) ? null : Number(value.toFixed(digits));

assertLocal(BACKEND_URL, 'BACKEND_URL');
const supabase = supabaseConfig();
assertLocal(supabase.url, 'SUPABASE_URL');

const sessions = await guestSessions(ROOMS, supabase);
const pid = serverPid();
const idleMemory = await backendMemory();
const sockets = [];
for (let index = 0; index < ROOMS; index += 1) {
  sockets.push(startHost(index, sessions[index]));
  await sleep(150);
}
await sleep(WARMUP_S * 1000);

const cpuBefore = cpuSeconds(pid);
const sqlBefore = appSql();
const actionsBefore = stats.actions;
const latenciesBefore = stats.latencies.length;
const memory = [];
const startedAt = Date.now();
while (Date.now() - startedAt < MEASURE_S * 1000) {
  await sleep(5000);
  memory.push(await backendMemory());
}
const cpuAfter = cpuSeconds(pid);
const sqlAfter = appSql();
const minutes = (Date.now() - startedAt) / 60000;
const actions = stats.actions - actionsBefore;
const latencies = stats.latencies.slice(latenciesBefore);

stopping = true;
for (const socket of sockets) socket.disconnect();

const cpuS =
  cpuBefore === null || cpuAfter === null ? null : cpuAfter - cpuBefore;
const sql =
  sqlBefore && sqlAfter
    ? {
        calls: sqlAfter.calls - sqlBefore.calls,
        ms: sqlAfter.ms - sqlBefore.ms,
      }
    : null;
const perAction = (value) =>
  actions && value !== null ? value / actions : null;

console.log(
  JSON.stringify(
    {
      rooms: ROOMS,
      roomsStarted: stats.roomsStarted,
      setupErrors: stats.setupErrors.slice(0, 5),
      idleHeapMb: idleMemory.heapUsed,
      heapAvgMb: round(
        memory.reduce((total, m) => total + m.heapUsed, 0) / memory.length,
      ),
      heapMaxMb: Math.max(...memory.map((m) => m.heapUsed)),
      actionsPerMin: round(actions / minutes),
      cpuSecPerMin: cpuS === null ? null : round(cpuS / minutes, 2),
      cpuMsPerAction: round(perAction(cpuS === null ? null : cpuS * 1000)),
      dbCallsPerMin: sql ? round(sql.calls / minutes, 0) : null,
      dbMsPerMin: sql ? round(sql.ms / minutes, 0) : null,
      dbCallsPerAction: round(perAction(sql ? sql.calls : null)),
      dbMsPerAction: round(perAction(sql ? sql.ms : null)),
      hostPlayLatencyMs: {
        p50: percentile(latencies, 50),
        p95: percentile(latencies, 95),
        n: latencies.length,
      },
      roundsConfirmed: stats.roundsConfirmed,
      disconnects: stats.disconnects,
      errors: stats.errors,
    },
    null,
    2,
  ),
);
setTimeout(() => process.exit(0), 500);
