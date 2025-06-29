# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Mei-Tra (明専トランプ) is an online multiplayer card game for 4 players in 2 teams. The project is a monorepo containing:

- **mei-tra-backend/**: NestJS backend with WebSocket gateway
- **mei-tra-frontend/**: Next.js frontend with Socket.IO client
- **mei-tra-mobile/**: React Native mobile app with Expo
- **shared/**: Common types, utilities, and constants
- **Live URL**: https://mei-tra-frontend.vercel.app/

## Development Commands

### Backend (mei-tra-backend/)
```bash
cd mei-tra-backend
npm run start:dev        # Development server with watch mode
npm run build           # Build for production
npm run lint            # ESLint with auto-fix
npm run test            # Run unit tests
npm run test:watch      # Run tests in watch mode
npm run test:cov        # Run tests with coverage
npm run test:e2e        # Run end-to-end tests
npm run test:debug      # Debug tests with Node inspector
npm run format          # Format code with Prettier
npm run start:prod      # Start production server
```

### Frontend (mei-tra-frontend/)
```bash
cd mei-tra-frontend
npm run dev             # Development server with Turbopack
npm run build           # Build for production
npm run lint            # Next.js ESLint
npm run start           # Start production server
npm run vercel-build    # Build for Vercel deployment
```

### Mobile (mei-tra-mobile/)
```bash
cd mei-tra-mobile
npm start               # Start Expo development server
npm run android         # Run on Android device/emulator
npm run ios             # Run on iOS device/simulator
npm run web             # Run in web browser
```

### Shared (shared/)
```bash
cd shared
npm run build           # Build TypeScript to dist/
npm run dev             # Build in watch mode
```

## Architecture Overview

### Backend Architecture (NestJS)
- **Clean Architecture** with Domain-Driven Design principles
- **WebSocket Gateway Pattern** for real-time multiplayer communication
- **Service Layer Architecture**:
  - `GameStateService`: Core game state management
  - `RoomService`: Room and player management with reconnection logic
  - `CardService`: Card deck generation and comparison logic
  - `BlowService`: Declaration phase game logic
  - `PlayService`: Card play phase logic
  - `ScoreService`: Point calculation system
  - `ChomboService`: Rule violation detection
- **In-Memory Repository Pattern** for game state storage
- **Domain Types**: Comprehensive TypeScript interfaces in `types/`

### Frontend Architecture (Next.js)
- **Next.js App Router** with TypeScript
- **Component Architecture**:
  - Atomic design pattern (atoms, molecules, organisms)
  - SCSS modules for component styling
  - Custom hooks for game logic (`useGame.ts`, `useRoom.ts`)
- **Real-time Communication**: Socket.IO client with reconnection support
- **State Management**: Local state with Socket.IO event-driven updates

### Mobile Architecture (React Native + Expo)
- **React Navigation Stack** for screen management
- **Component Architecture**:
  - Mobile-optimized UI components (Card, PlayerHand, GameField)
  - Touch-friendly interactions with haptic feedback
  - Responsive design for different screen sizes
- **Real-time Communication**: Socket.IO client with same backend integration
- **Development**: Expo development server with QR code scanning for device testing

### Key Technical Patterns

#### WebSocket Communication
- **Connection Management**: Automatic reconnection with token-based session recovery
- **Room-based Events**: Isolated game sessions with room-specific state
- **Event Flow**: Gateway handles all game events (declare-blow, play-card, etc.)
- **CORS Configuration**: Environment-aware CORS for development/production

#### Game State Management
- **Centralized State**: `GameStateService` manages all game state
- **Room Isolation**: Each room has independent game state via `RoomService`
- **Player Reconnection**: Persistent player state with disconnect timeout handling
- **Game Phases**: Distinct phases (waiting, blow, play) with phase-specific logic

## Development Guidelines

### TypeScript Standards
- Use TypeScript for all code; prefer interfaces over types
- Avoid enums; use maps or union types instead
- Always declare types for variables and function parameters/returns
- Avoid `any` type; create necessary custom types

### Code Style (from .cursor/rules/)

#### Frontend (Next.js/React)
- Use functional components with TypeScript interfaces
- Prefer React Server Components; minimize 'use client'
- Use SCSS modules for styling with kebab-case directories
- Follow atomic design patterns for components
- Use descriptive variable names with auxiliary verbs (isLoading, hasError)
- Favor named exports for components
- Use the "function" keyword for pure functions

#### Backend (NestJS)
- Follow SOLID principles and clean architecture
- Use modular architecture with domain separation
- Implement services for business logic, controllers for API endpoints
- Write JSDoc for public classes and methods
- Use camelCase for variables/functions, PascalCase for classes
- Keep functions under 20 lines with single responsibility
- Start function names with verbs; use isX/hasX for booleans
- Use RO-RO pattern (Receive Object, Return Object) for complex parameters

### Testing
- **Backend**: Jest for unit and e2e testing
- **Testing Pattern**: Arrange-Act-Assert convention
- Use test doubles for dependencies
- Write tests for each public service method

### File Organization
- **Backend Services**: Organized by domain functionality
- **Frontend Components**: Grouped by feature with co-located styles
- **Types**: Shared interfaces in both frontend and backend `types/` folders
- **Hooks**: Custom React hooks in `hooks/` directory

## Key Implementation Details

### Game Flow Architecture
- **Game Phases**: `'waiting' | 'blow' | 'play' | null`
- **Room Management**: Each room maintains independent game state
- **Player Teams**: 4 players divided into 2 teams (Team 0, Team 1)
- **Card System**: Traditional card deck with trump/suit-based gameplay

### WebSocket Event Patterns
- **Room Events**: `create-room`, `join-room`, `leave-room`, `toggle-player-ready`
- **Game Events**: `start-game`, `declare-blow`, `pass-blow`, `play-card`
- **State Updates**: `game-state`, `update-turn`, `update-phase`, `update-players`

### Environment Configuration
- **Backend**: Port 3333 (configurable via PORT env var)
- **Frontend**: Next.js on port 3000 with Turbopack
- **Mobile**: Expo development server with device/simulator support
- **WebSocket URL**: Configurable via `NEXT_PUBLIC_SOCKET_URL` / `EXPO_PUBLIC_SOCKET_URL`
- **CORS**: Environment-aware (localhost for dev, vercel for prod)

## Common Development Tasks

When working on game features:
1. Update shared types in `shared/src/types/` (used by all applications)
2. Implement business logic in appropriate service (`mei-tra-backend/src/services/`)
3. Add WebSocket event handlers in `game.gateway.ts`
4. Update frontend components and custom hooks
5. Update mobile components if needed (`mei-tra-mobile/components/`)
6. Run lint on all projects to ensure code quality

When adding new game phases or features:
1. Extend `GamePhase` type and `GameState` interface in shared types
2. Add corresponding service methods and WebSocket events
3. Update frontend, mobile, and backend event handling
4. Test with multiple connected clients for multiplayer scenarios

When developing mobile features:
1. Use Expo Go app for testing on physical devices
2. Ensure SDK compatibility between project and Expo Go app
3. Test touch interactions and responsive design on different screen sizes
4. Verify Socket.IO connection works consistently across platforms