# Game Module Layering

This document summarizes the current game-module layering after the refactors. This is not full Clean Architecture. The outer transport/framework pieces stay close to NestJS/Next.js conventions, while the correctness-critical game rules are kept in domain-layer services instead of being spread across gateways, UI, or repositories.

## Layer Overview

- **Interface Adapters** – Translate external protocols (Socket.IO / REST) into application commands. They depend only on use-case interfaces and dispatch returned `GatewayEvent`s or REST DTOs.
- **Application / Use Cases** – Coordinate user-facing workflows such as joining rooms, reconnecting, starting games, blow/play actions, auth updates, field completion, game-over processing, and profile game-history reads.
- **Domain Layer / Game Rule Services** – Provide card logic, blow legality, play winner calculation, scoring, chombo checks, and phase transition legality. In code, this mostly means `CardService`, `BlowService`, `PlayService`, `ScoreService`, `ChomboService`, and `GamePhaseService`.
- **Session / State Services** – Coordinate game-state persistence, connection metadata, reconnect, COM replacement, turn monitoring, and room lifecycle. These are important application services, but they are not the domain layer itself.
- **Infrastructure** – Supabase repositories and other adapters implementing repository interfaces (`IRoomRepository`, `IGameStateRepository`, etc.).

## Current Mapping

| Layer | Classes / Files | Notes |
| --- | --- | --- |
| Interface Adapters | `src/game.gateway.ts`, `src/controllers/user-profile.controller.ts`, `src/controllers/game-history.controller.ts` | Gateway and controllers translate socket/HTTP traffic into use-case calls. `room-sync` is the primary room/player sync contract. |
| Application / Use Cases | `src/use-cases/*.ts` (e.g., `join-room.use-case.ts`, `reconnection.use-case.ts`, `declare-blow.use-case.ts`, `play-card.use-case.ts`, `complete-field.use-case.ts`, `process-game-over.use-case.ts`, `get-user-recent-game-history.use-case.ts`) | Each use case encapsulates a workflow. Inputs/outputs are typed request/response DTOs; side effects are expressed as events, DTOs, or instructions for the gateway/controllers. |
| Domain Layer / Game Rule Services | `CardService`, `BlowService`, `PlayService`, `ScoreService`, `ChomboService`, `GamePhaseService`, plus game rule types in `src/types/game.types.ts` | Holds the source of truth for rule judgment, scoring, phase legality, and game correctness. |
| Session / State Services | `GameStateService`, `GameStateManager`, `PlayerConnectionManager`, `RoomService`, `ComSessionService`, `TurnMonitorService` | Coordinates persistence, connection/session metadata, reconnect, COM replacement, timers, and room lifecycle. |
| Infrastructure | Repositories under `src/repositories` (e.g., `room.repository.ts`, `game-state.repository.ts`, `user-profile.repository.ts`, `supabase-game-history.repository.ts`) | Implement the persistence contracts (`IRoomRepository`, `IGameStateRepository`, etc.) against Supabase or other storage. |

## Present Flow Example

```
Socket event -> GameGateway handler -> UseCase.execute()
     ↓                              ↓
    emits                   orchestrates via services/repositories
```

Example: `play-card`
1. `GameGateway` invokes `PlayCardUseCase.execute`.  
2. Use case fetches room state through `IRoomService`, validates turn/order, updates state (`GameStateService`), and builds `GatewayEvent`s.  
3. Gateway dispatches events and, if a field is complete, triggers `CompleteFieldUseCase`.  
4. `CompleteFieldUseCase` handles field completion, scoring, and round/game continuation, optionally delegating to `ProcessGameOverUseCase` for statistics and reset scheduling.

## Dependency Guidelines

- Gateways depend on use-case **interfaces** (tokens such as `'IPlayCardUseCase'`).
- Use cases depend on service/repository **interfaces** (`IRoomService`, `IGameStateService`, etc.).
- Services depend on repository interfaces; repositories encapsulate Supabase or other adapters.

This structure keeps rule logic reusable and testable, while the transport layer focuses on translating socket/HTTP traffic into application commands. Replay/audit read-side and profile recent-match entrypoints stay outside the core game engine, but consume the same contracts and persistence layer.
