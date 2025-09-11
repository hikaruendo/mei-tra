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

- **WebSocket Gateway** (`game.gateway.ts`): Handles all WebSocket connections and real-time game events
- **Services Layer** (`src/services/`): Business logic for game mechanics (card, score, blow, play, chombo)
- **Repository Pattern** (`src/repositories/`): Data persistence abstraction with interfaces and Supabase implementations
- **Database Module** (`src/database/`): Supabase configuration and connection management

Key services:
- `RoomService`: Room management and player lifecycle
- `GameStateService`: Core game state persistence and retrieval
- `CardService`, `BlowService`, `PlayService`: Game phase implementations
- `ScoreService`: Scoring calculations and team management

### Database Environment Setup

**Development Environment**: Uses local Supabase via Docker
- URL: `http://localhost:54321`
- Studio: `http://localhost:54323`
- Migrations in `supabase/migrations/`

**Production Environment**: Uses cloud Supabase
- Environment variables set via Fly.io secrets
- Automatic environment switching based on `NODE_ENV`

### WebSocket Communication

Real-time game communication using Socket.IO:
- Connection handling with reconnection tokens
- Room-based event broadcasting
- Player state synchronization
- Game phase transitions (deal → blow → play → scoring)

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