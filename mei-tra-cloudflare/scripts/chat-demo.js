#!/usr/bin/env node
/* eslint-disable no-console */
const WebSocket = require('ws');

const roomId = process.argv[2] ?? 'demo-room';
const userId = process.argv[3] ?? `user-${Math.random().toString(36).slice(2, 8)}`;
const baseUrl =
  process.env.WORKER_WS_URL ??
  'wss://mei-tra-cloudflare.hikaru-endo-75b.workers.dev/ws';

const ws = new WebSocket(`${baseUrl}?roomId=${encodeURIComponent(roomId)}`);

ws.on('open', () => {
  console.log(`connected to ${baseUrl} as ${userId}`);
  ws.send(JSON.stringify({ type: 'join', userId }));
  setTimeout(() => {
    ws.send(
      JSON.stringify({
        type: 'message',
        userId,
        content: `hello from ${userId} @ ${new Date().toISOString()}`,
      }),
    );
  }, 500);
});

ws.on('message', (data) => {
  try {
    const parsed = JSON.parse(data.toString());
    console.log('event', parsed);
  } catch {
    console.log('message', data.toString());
  }
});

ws.on('close', () => console.log('connection closed'));
ws.on('error', (err) => console.error('socket error', err));
