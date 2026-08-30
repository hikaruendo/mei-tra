# Push notifications

## Backend API

The authenticated HTTP API is exposed below the global `api` prefix:

- `POST /api/push-tokens` registers or updates one Expo token for the current user, device, and platform.
- `DELETE /api/push-tokens?deviceId=<id>&platform=<ios|android>` removes that device registration for the current user.

Both routes require `Authorization: Bearer <Supabase access token>`. The token value is never returned by the API. Registration is idempotent and the database function removes a token from any previous account before assigning it to the current account.

The `push_tokens` table is protected by RLS and is not granted to `anon` or `authenticated`. All writes go through the backend repository using the Supabase service-role client, while the controller obtains the user ID only from `AuthGuard` and `CurrentUser`; the mobile client never receives the service-role key and does not access `push_tokens` directly.

## Sending API

`PushNotificationService` exposes two post-commit-safe methods:

- `sendGameStarted(userIds, { eventId, roomId, roundNumber })`
- `sendTurnNotification(userIds, { eventId, roomId, roundNumber, phase })`

The service resolves current tokens, batches requests to Expo, preserves each successful ticket's receipt ID, and reports ticket results. Immediate ticket-level `DeviceNotRegistered` errors remove the token without storing a receipt. Successful tickets create a `push_receipts` row containing only the Expo receipt ID and the token/device/user mapping; notification title, body, and data are never persisted. The optional `push_token_id` is only a historical row reference; the copied token/device/user fields keep receipt cleanup safe even if the token row is removed before polling.

Expo recommends checking receipts approximately 15 minutes after sending and clears receipts after 24 hours. Each stored receipt therefore starts with `next_attempt_at` set to 15 minutes after insertion. `PushReceiptService` scans due rows every 30 seconds, so the first provider lookup occurs at about T+15:00 to T+15:30 rather than in the gameplay request. A database claim RPC uses `FOR UPDATE SKIP LOCKED`, a worker ID, and a lease so multiple backend instances do not process the same receipt concurrently.

An omitted receipt means it is not ready. Missing receipts and transient lookup failures remain retryable with bounded delays of 5, 15, 30, 60, 120, 240, and 480 minutes after attempts 1 through 7. The eight lookup times are therefore approximately T+15m, T+20m, T+35m, T+65m, T+125m, T+245m, T+485m, and T+965m (16h05m), each with up to 30 seconds of scheduler jitter. A missing or transient result on attempt 8 becomes `expired`, keeping the entire lookup window inside Expo's 24-hour receipt retention. Provider errors become `failed`, and a `DeviceNotRegistered` receipt atomically removes the matching token in the completion RPC. Re-running completion is safe because only the current worker lease can complete a `processing` row.

Network or cleanup failures are logged and returned as failed delivery results rather than thrown into gameplay. Receipt polling runs only from the scheduled background worker after ticket persistence, so a delayed Expo receipt response cannot block the game transition. Immediate ticket-level `DeviceNotRegistered` cleanup still happens synchronously after Expo returns the send tickets. The in-memory notification trigger dedupe and the durable receipt claim/unique constraints together cover duplicate trigger calls and multi-instance receipt processing.

## Gameplay trigger points

Triggers are wired only after the authoritative state write and the corresponding broadcast path:

1. **Game start:** send only for the initial `start-game` transition after `StartGameUseCase` has persisted the state and the room broadcast has succeeded. Target authenticated human participants whose canonical `GameStateService` connection has no live socket. The first-turn player is eligible when disconnected. Later rounds do not emit another game-start push.
2. **Turn:** schedule after a persisted blow/play `update-turn` transition. Wait for the event's display delay and then another 60 seconds. Send one push only when the same room, seat, phase, and turn fingerprint still match and the canonical connection state still has no live socket. A newer turn replaces the room's pending timer; reconnect, phase changes, and COM replacement make the old snapshot ineligible.

Do not send from a pre-persistence mutation, a reconnect handler, or a generic state-sync handler. Do not infer connectivity from the persisted room projection or its `socketId`; `GameStateService.getPlayerConnectionState(seatId)` is the canonical source. A trigger must be fire-and-forget after commit, and a push failure must never roll back or block the game transition.

The trigger dedupe cache is in-memory and bounded. It suppresses duplicate trigger calls inside one backend process, while `push_receipts` is the durable receipt ledger across deployments or process restarts. Receipt rows are removed automatically with the owning Auth user; operational cleanup should monitor `expired` rows and repeated lookup failures.

## Remaining release work

- The mobile app still needs permission handling, Expo token acquisition, installation/device ID persistence, registration after authentication, deletion on logout, and notification tap routing.
- Production needs the Supabase migration applied and the EAS/Expo project credentials configured. Push sending itself does not require an Expo access token for the current Expo endpoint, but project-level credentials and store signing remain mobile release concerns.
- Production observability still needs delivery metrics around targeted, accepted, rejected, invalid, and removed token counts.
- Operate the receipt poller on the normal backend cadence; alert on growing `pending`/`processing` age, repeated `expired` rows, and Expo lookup failures. Do not run a second ad-hoc poller against the same table—the claim lease is the multi-instance coordination boundary.
