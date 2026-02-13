# mei-tra-cloudflare

Cloudflare Workers + Durable Objects scaffold for moving Meitra backend off Fly.

## Current scope

- `GET /api/health`: basic health endpoint.
- `GET /ws?roomId=...`: room-scoped WebSocket endpoint backed by a Durable Object.
- Durable Object class: `RoomDurableObject` keeps ephemeral membership and the latest 200 chat messages per room.
- Message contract is JSON-based and mirrors the existing Socket.IO events:
  - Client events: `join`, `leave`, `message`, `typing`, `list-messages`
  - Server events: `chat:joined`, `chat:left`, `chat:message`, `chat:messages`, `chat:typing`, `chat:error`
  - See `src/index.ts` for the exact payloads.

## Run locally

```bash
cd mei-tra-cloudflare
npm install
npm run dev
```

### Try the demo client

```
cd mei-tra-cloudflare
npm run demo -- demo-room user123
```

Environment variables:

- `WORKER_WS_URL` (optional) – override the deployed Worker URL (defaults to production URL).

## Deploy

```bash
cd mei-tra-cloudflare
npm run deploy
```

## Important migration note

Current frontend uses Socket.IO client. Workers endpoint above is raw WebSocket, not Socket.IO.
To fully migrate gameplay traffic, frontend transport needs to move from Socket.IO protocol to raw WebSocket protocol (or another Cloudflare-compatible realtime protocol). Start by wiring the chat client to the new event contract described above before retiring the NestJS `SocialGateway`.
