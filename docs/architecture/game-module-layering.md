# Game Module Layering

This document summarizes how the game module now follows a clean-architecture-inspired layering after the recent refactors.

## Layer Overview

- **Interface Adapters** – Translate external protocols (Socket.IO) into application commands. They depend only on use-case interfaces and dispatch returned `GatewayEvent`s.
- **Application / Use Cases** – Coordinate user-facing workflows such as joining rooms, starting games, blow/play actions, auth updates, field completion, and game-over processing. They orchestrate domain services exclusively through interfaces.
- **Domain Services & Entities** – Provide game-state manipulation, rule enforcement, card/scoring logic, and room management. These services hide persistence details behind repository interfaces.
- **Infrastructure** – Supabase repositories and other adapters implementing repository interfaces (`IRoomRepository`, `IGameStateRepository`, etc.).

## Current Mapping

| Layer | Classes / Files | Notes |
| --- | --- | --- |
| Interface Adapters | `src/game.gateway.ts` | Now a thin transport layer: receives socket events, invokes use cases via DI tokens, and dispatches `GatewayEvent` payloads or follow-up triggers. |
| Application / Use Cases | `src/use-cases/*.ts` (e.g., `join-room.use-case.ts`, `declare-blow.use-case.ts`, `play-card.use-case.ts`, `complete-field.use-case.ts`, `process-game-over.use-case.ts`, `update-auth.use-case.ts`, etc.) | Each use case encapsulates a workflow. Inputs/outputs are typed request/response DTOs; side effects are expressed as events or instructions for the gateway. |
| Domain Services & Entities | `GameStateService`, `CardService`, `ScoreService`, `BlowService`, `PlayService`, `ChomboService`, `RoomService`, plus domain types in `src/types` | Services implement core game rules, state transitions, and repository coordination. They expose interfaces so use cases stay decoupled. |
| Infrastructure | Repositories under `src/repositories` (e.g., `room.repository.ts`, `game-state.repository.ts`, `user-profile.repository.ts`) | Implement the persistence contracts (`IRoomRepository`, `IGameStateRepository`, etc.) against Supabase or other storage. |

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

This structure keeps domain logic reusable and testable, while the transport layer focuses purely on translating socket traffic into application commands.
