# Repository Guidelines

## Project Structure & Module Organization
Core web client lives in `mei-tra-frontend` (Next.js) with routes under `app/`, shared React components in `components/`, and styling in `styles/` or co-located CSS modules. The NestJS gateway and Socket.IO hub sit in `mei-tra-backend/src`, with database seeds and scripts in `scripts/` and Supabase assets in `supabase/`. Cross-cutting TypeScript models, constants, and utilities are centralized in `shared/` to keep frontend and backend types aligned. Static assets for legacy pages remain under top-level `public/`, while workflow automation resides in `.github/workflows/`.

## Build, Test, and Development Commands
- `cd mei-tra-frontend && npm run dev` spins up the Next.js client with Turbopack hot reload. Use `npm run build` before shipping to confirm production bundles.  
- `cd mei-tra-backend && npm run start:dev` launches the NestJS server with file watching; pair with `bash scripts/create-test-users.sh` after a fresh Supabase reset.  
- Supabase needs to be running (`supabase start`) for any end-to-end flows; stop it after sessions with `supabase stop`.

## Coding Style & Naming Conventions
Both codebases rely on TypeScript with 2-space indentation and semicolons. Prefer PascalCase for React components and Nest providers, camelCase for functions and variables, and UPPER_SNAKE_CASE for shared constants. Run `npm run lint` in each package before committing; backend contributors should apply `npm run format` to enforce Prettier across `src/` and `test/`.

## Testing Guidelines
Backend unit and integration specs live beside features as `*.spec.ts` and execute via `npm test`; aim to extend coverage rather than modifying generated snapshots. Use `npm run test:cov` when touching core game logic to ensure regressions surface. Frontend lacks automated tests today—add Playwright or React Testing Library coverage when fixing bugs that affect UI flows.

## Commit & Pull Request Guidelines
Existing history favors short, present-tense summaries (English or Japanese) such as "ui fix" or "点数調整"; follow that style while staying descriptive. Group related changes per commit and reference issue IDs when available. For pull requests, include a concise summary, testing notes (`npm test`, manual steps), and screenshots or screen recordings for UI-facing work. Because `main` deploys automatically to Fly.io, merge only after backend build, lint, and tests pass locally.

## Environment & Deployment Notes
Fly.io deploys trigger from pushes to `main` using `.github/workflows/deploy.yml`; verify `.env` values in Fly secrets rather than committing credentials. When altering database schema, regenerate migrations under `mei-tra-backend/supabase/` and run `supabase db reset` to confirm they apply cleanly.
