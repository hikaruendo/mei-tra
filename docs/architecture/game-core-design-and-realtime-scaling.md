# Game Core Design And Realtime Scaling Notes

Last updated: 2026-04-17

## Why this refactor was done

The primary architectural risk in this project is not generic CRUD complexity. It is the combination of:

- increasingly complex game rules
- strict correctness requirements
- realtime exceptions such as reconnect, disconnect, COM replacement, timeout, and phase drift

Because of that, this codebase intentionally does **not** apply heavy architectural layering everywhere.

Instead, the project uses a selective strategy:

- make the walls thick around correctness-critical boundaries
- keep transport, framework wiring, and standard page/controller structure close to NestJS/Next.js defaults

In short:

- **Protect game correctness and realtime consistency aggressively**
- **Let the framework handle the rest unless there is a concrete failure mode**

## What this means in the source code

The important point is the concrete responsibility split:

- outside the game core, use the framework normally
- inside the correctness-critical game core, keep the rules in dedicated services and do not duplicate them in Socket handlers, UI, or repositories

In source-code terms:

- framework-native outer layer:
  - `mei-tra-frontend/app/`
  - `mei-tra-frontend/components/`
  - `mei-tra-backend/src/game.gateway.ts`
  - `mei-tra-backend/src/controllers/*.ts`
  - `mei-tra-backend/src/game.module.ts`
- application orchestration:
  - `mei-tra-backend/src/use-cases/*.ts`
  - reconnect, moderation, shuffle, start-game, play-card, complete-field flows
- domain layer / game-rule services:
  - `mei-tra-backend/src/services/card.service.ts`
  - `mei-tra-backend/src/services/blow.service.ts`
  - `mei-tra-backend/src/services/play.service.ts`
  - `mei-tra-backend/src/services/score.service.ts`
  - `mei-tra-backend/src/services/chombo.service.ts`
  - `mei-tra-backend/src/services/game-phase.service.ts`
  - `mei-tra-backend/src/types/game.types.ts`
- infrastructure:
  - `mei-tra-backend/src/repositories/implementations/*.ts`
  - `mei-tra-backend/src/database/supabase.service.ts`

This does not mean full DDD or full Clean Architecture. It means the game-rule source of truth lives in the domain layer services, while NestJS/Next.js still handle ordinary framework concerns.

## What gets the strongest boundaries

The strongest boundaries should continue to be around:

- rule evaluation and rule mutations
- phase transition governance
- reconnect/session recovery
- room/player sync transport contracts
- replay/audit logging for explainability

That is why the refactor introduced and emphasized things like:

- `GamePhaseService`
- `GameStateManager`
- `PlayerConnectionManager`
- use-case based reconnect/moderation/shuffle flows
- `room-sync` as the main room/player sync contract
- `game_history` write/read side for replay and audit

## What should stay framework-native

The following should remain relatively standard unless there is a proven scaling or correctness issue:

- NestJS controllers and DI wiring
- Next.js page/route composition
- simple profile/list/detail UI flows
- straightforward proxy routes and transport adapters

The goal is to avoid over-architecting the safe parts of the system.

## Durability assessment

### Strong area

This design is durable against:

- additional game rules
- additional phase transitions
- more reconnect/session edge cases
- more replay/audit requirements

Because the correctness-sensitive areas are isolated more clearly than before.

### Weak area

This design is **not yet fully durable for horizontal realtime scaling**.

Current constraints:

- room/game state still depends on process-local memory in important places
- socket-to-room state is still held in local process memory
- session/timer/turn-monitor behavior is still process-local
- no shared Socket.IO adapter is in place yet

This means the current architecture is durable for domain complexity first, not for distributed realtime infrastructure first.

## Realtime scaling judgment line

These numbers are not vendor guarantees. They are operational judgment lines for the current architecture.

Current infra assumptions in this repo:

- Fly.io app machine: shared CPU, 1 CPU, 512 MB RAM
- `min_machines_running = 0`
- Supabase used for persistence, not as the primary game realtime transport
- active room/session state still partially depends on in-memory process state

### Safe enough / watch only

Usually acceptable without architectural change:

- concurrent connections: up to about **30**
- active matches: up to about **8 rooms**

### Start planning changes

Begin infra/scaling design when either of these becomes normal:

- concurrent connections: around **50**
- active matches: around **10-15 rooms**

At this stage, the minimum expected actions are:

1. raise Fly memory from 512 MB to 1 GB
2. set `min_machines_running = 1`
3. monitor `/api/health` for `activeConnections`, `heapUsed`, and `rss`
4. review hot paths that still rely on `findAll()` style room queries

### Start implementation, not just planning

Treat this as the execution threshold:

- concurrent connections: **100+**
- active matches: around **20-30 rooms**

At that point, the system should no longer rely on the current single-process assumptions.

## Recommended next scaling phase

When the project crosses the planning threshold, the next phase should be:

1. introduce a shared Socket.IO adapter (for example Redis-based)
2. move session/timer/reconnect coordination to shared infrastructure where needed
3. reduce broad room scans and replace them with purpose-specific queries
4. define explicit crash/restart recovery behavior for active games
5. keep game correctness logic isolated while changing infra underneath it

## Supabase note

As of 2026-04-17, the first scaling concern for this app is more likely Fly/runtime topology than Supabase realtime limits, because gameplay transport is handled by the backend Socket.IO gateway rather than Supabase Realtime.

Vendor pricing and free-tier assumptions can change. Re-check Fly.io and Supabase plan limits before making cost decisions.
