# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an online multiplayer card game called "明専トランプ (Mei-Tra)" - a 4-player, 2-team card game. The project consists of:

- **Frontend**: Next.js application (`mei-tra-frontend/`)
- **Backend**: NestJS WebSocket server (`mei-tra-backend/`)
- **Database**: Supabase PostgreSQL with environment separation
- **Deployment**: Frontend on Vercel, Backend on Fly.io

## Development Commands

### Backend (mei-tra-backend/)
```bash
# Development with local Supabase
supabase start                    # Start local Supabase environment
npm run start:dev                # Start backend in development mode
supabase stop                    # Stop local Supabase when done

# Testing
npm test                         # Run unit tests
npm run test:watch              # Run tests in watch mode
npm run test:cov                # Run tests with coverage
npm run test:e2e                # Run end-to-end tests

# Code quality
npm run lint                    # Lint and fix TypeScript
npm run format                  # Format code with Prettier

# Production deployment management
npm run deploy:production       # Switch to production mode (1 machine always running)
npm run deploy:standby         # Switch to standby mode (0 machines when idle)
```

### Frontend (mei-tra-frontend/)
```bash
npm run dev                     # Start development server with Turbopack
npm run build                   # Build for production
npm run start                   # Start production server
npm run lint                    # Lint code
```

## Architecture

### Backend Architecture (NestJS + Repository Pattern)

The backend follows Clean Architecture principles with a clear separation of concerns:

- **WebSocket Gateways**: Two separate gateways for different concerns
  - `game.gateway.ts` (namespace: `/`): Game logic and room management
  - `social.gateway.ts` (namespace: `/social`): Chat and social features
- **Use Cases Layer** (`src/use-cases/`): Application-specific business rules (e.g., `JoinRoomUseCase`, `PlayCardUseCase`)
- **Services Layer** (`src/services/`): Domain logic for game mechanics (card, score, blow, play, chombo)
- **Repository Pattern** (`src/repositories/`): Data persistence abstraction with interfaces and Supabase implementations
- **Database Module** (`src/database/`): Supabase configuration and connection management

#### NestJS Module System

The project uses NestJS's dependency injection and module system with the following hierarchy:

```
AppModule (root)
├── ConfigModule.forRoot() (global config)
├── ScheduleModule.forRoot() (global scheduler for chat cleanup)
├── RepositoriesModule
│   └── DatabaseModule (Supabase client initialization)
├── AuthModule (authentication & authorization)
│   └── RepositoriesModule (shared)
├── SocialModule (chat features via WebSocket)
│   └── RepositoriesModule (shared)
└── GameModule (game logic via WebSocket)
    ├── RepositoriesModule (shared)
    ├── AuthModule (shared)
    └── SocialModule (for creating chat rooms when game rooms are created)
```

**Key Points**:
- **Singleton Pattern**: NestJS creates only one instance per module, even when imported multiple times
- **Dependency Injection**: Uses interface tokens (e.g., `'IRoomRepository'`) with `@Inject()` decorator
- **Repository Pattern**: Interfaces in `src/repositories/interfaces/`, implementations in `src/repositories/implementations/`
- **forRoot() vs forFeature()**:
  - `forRoot()`: Called once in AppModule for global configuration
  - `forFeature()`: Called in feature modules for module-specific configuration

Key services:
- `RoomService`: Room management and player lifecycle
- `GameStateService`: Core game state persistence and retrieval
- `CardService`, `BlowService`, `PlayService`: Game phase implementations
- `ScoreService`: Scoring calculations and team management
- `ChatService`: Chat room and message management
- `ChatCleanupService`: Scheduled cleanup of expired chat messages

### Database Environment Setup

**Development Environment**: Uses local Supabase via Docker
- URL: `http://localhost:54321`
- Studio: `http://localhost:54323`
- Migrations in `supabase/migrations/`

**Production Environment**: Uses cloud Supabase
- Environment variables set via Fly.io secrets
- Automatic environment switching based on `NODE_ENV`

### WebSocket Communication

Real-time communication using Socket.IO with **two separate gateways**:

#### GameGateway (namespace: `/`)
- Game room management (create, join, leave)
- Game phase transitions (deal → blow → play → scoring)
- Card play and blow mechanics
- Player state synchronization
- Reconnection handling with tokens

#### SocialGateway (namespace: `/social`)
- Chat room management (join, leave)
- Real-time messaging
- Typing indicators
- Message history retrieval

**Architecture Decision**: GameModule imports SocialModule to automatically create a chat room when a game room is created (`game.gateway.ts:621`).

### REST vs WebSocket Decision Guide

**Use REST (Controllers)** when:
- Large binary data (e.g., avatar uploads with image processing)
- Single-shot operations
- Complex multipart form data
- File validation and processing
- Example: `UserProfileController` for avatar upload (Sharp.js image optimization to 128x128 WebP, max 50KB)

**Use WebSocket (Gateways)** when:
- Real-time bidirectional communication required
- Small, frequent data exchanges (text messages)
- Server-push notifications needed
- Maintained connection for presence/status
- Broadcast to multiple clients simultaneously
- Example: `SocialGateway` for chat, `GameGateway` for game events

### Deployment Strategy

**Cost Optimization on Fly.io**:
- **Production Mode**: `min_machines_running = 1` (always-on for active gaming)
- **Standby Mode**: `min_machines_running = 0` (scale-to-zero when idle)
- Use deployment scripts to switch between modes based on usage

## Environment Configuration

The project uses environment-specific configuration:

- **Development**: `.env.development` with local Supabase settings
- **Production**: Environment variables injected via Fly.io secrets
- **Config files**: `src/config/supabase.config.ts` handles environment switching

## Key Files and Conventions

- `game.gateway.ts`: Central WebSocket event handler
- `game.types.ts`: TypeScript definitions for game entities
- `repositories/`: Data access layer with interface/implementation separation
- Database schema in `database/schema.sql` and `supabase/migrations/`
- Deployment configuration in `fly.toml` and `DEPLOYMENT.md`

## Testing Strategy

- Unit tests for services and game logic
- E2E tests for WebSocket flows
- Coverage reporting available via `npm run test:cov`

## Development Workflow

1. Start local Supabase: `supabase start`
2. Run backend: `npm run start:dev`
3. Run frontend: `npm run dev`
4. Access Supabase Studio at `http://localhost:54323` for database inspection
5. Stop Supabase when done: `supabase stop`

## Styling Guidelines (Frontend)

**IMPORTANT**: This project uses **SCSS Modules**, NOT Tailwind CSS.

### Rules:
- **All components MUST use SCSS modules** (`.module.scss` files)
- **DO NOT use Tailwind CSS classes** - Tailwind is not configured in this project
- **Component structure**: Each component should have its own `.module.scss` file
  - Example: `Component.tsx` + `Component.module.scss`
- **Import pattern**: `import styles from './Component.module.scss';`
- **Class usage**: `className={styles.className}` or `className={\`\${styles.base} \${styles.modifier}\`}`

### Example:
```tsx
// Component.tsx
import styles from './Component.module.scss';

export function Component() {
  return <div className={styles.container}>Content</div>;
}
```

```scss
// Component.module.scss
.container {
  max-width: 800px;
  padding: 20px;
  background-color: #fff;
}
```

## Code Quality Guidelines

- Use comments sparingly. Only comment complex code.
- The database schema is defined in `@mei-tra-backend/database/schema.sql` and `@mei-tra-backend/supabase/migrations/` files. Reference these anytime you need to understand the structure of data stored in the database.
- **Always run lint and TypeScript checks after modifying code**: `npm run lint && npx tsc --noEmit`
- If bug fixes fail three or more times, analyse using Codex CLI.
- Architecture design consultations via Codex CLI.
- The standard implementation is Claude Code.

### TypeScript Configuration

- **Decorators**: Project uses TypeScript 5.7 with `experimentalDecorators: true` and `useDefineForClassFields: false` for NestJS compatibility
- **Strict Null Checks**: Enabled (`strictNullChecks: true`)
- **Target**: ES2023

### Testing Best Practices

- **Mock Repository Interfaces**: When testing, ensure all mock repositories implement the complete interface
  ```typescript
  mockRepository = {
    findById: jest.fn(),
    create: jest.fn(),
    // ... include ALL interface methods
  } as jest.Mocked<IRepository>
  ```
- **E2E Tests**: Use `Test.createTestingModule()` with `.overrideProvider()` to inject mocks
- **WebSocket Testing**: Connect clients to ephemeral ports during tests