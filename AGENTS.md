# Repository Guidelines

## Project Structure & Module Organization
- `mei-tra-frontend/` hosts the Next.js app (App Router). Routes live under `app/`, feature-oriented React components live under `components/` (`game/`, `room/`, `shared/`, `auth/`, `social/`, etc.), styles in `styles/`, and hooks/utilities in `hooks/` / `lib/`. Static assets sit in `public/`.
- `mei-tra-backend/` contains the NestJS gateway plus Socket.IO hub (`src/`). Scripts for Fly.io and Supabase maintenance live in `scripts/`. Database resources are under `supabase/`.
- `contracts/` is the shared transport layer for REST DTOs and Socket.IO payloads. Keep UI-only types in `mei-tra-frontend/types/` and backend domain/persistence types in `mei-tra-backend/src/types/`. Legacy assets remain at the repo root `public/`. Mobile experiments live in `mei-tra-mobile/`.

## AI Agent Documentation Policy
- Treat `README.md`, `AGENTS.md`, and the code itself as the first sources for day-to-day work. Do not preload all human-facing docs by default.
- `docs/developer-guide/` is a human onboarding guide. Read only the specific chapter that matches the task: frontend (`02`), backend (`03`), realtime flow (`04`), data/auth/persistence (`05`), or dev/ops (`06`).
- `docs/archive/2025-06-zenn-meitra-project-memo.md` is a historical Zenn article archive from 2025-06. Do not use it as current implementation guidance unless the user explicitly asks about project history.
- Prefer targeted search with `rg` over reading whole Markdown trees. When code and docs disagree, trust the code and update the relevant doc.

## Agent Harness Guidance
- Keep `AGENTS.md` as a small map, not a full manual. Add deeper guidance to the relevant README or `docs/developer-guide/*` chapter.
- When an agent repeatedly needs the same instruction, prefer encoding it as a test, lint rule, type contract, script, or short runbook rather than a long prose rule.
- For UI or realtime regressions, verify through the app when possible: run the dev servers, inspect logs, and capture screenshots or browser state before claiming the fix.
- Treat stale or duplicated docs as technical debt. Update or delete them when code changes, and avoid adding broad docs that future agents must read by default.

## Build, Test, and Development Commands
- Frontend: `cd mei-tra-frontend && npm run dev` (Turbopack dev server), `npm run build` (Next production build), `npm run lint` (ESLint), `npm run test` (Jest/RTL) when applicable.
- Backend: `cd mei-tra-backend && npm run start:dev` (Nest hot reload), `npm run build` (tsc), `npm run lint` (ESLint + Prettier), `npm test` and `npm run test:cov` for core game logic.
- Supabase workflows rely on `supabase start/stop` from the repo root. Run `bash scripts/create-test-users.sh` after reseeding.

## Coding Style & Naming Conventions
- TypeScript with 2-space indentation and semicolons. Prefer PascalCase for React components/providers, camelCase for functions/variables, UPPER_SNAKE_CASE for shared constants.
- Frontend linting: `eslint` + `eslint-config-next`. Backend uses `eslint` + `prettier`. Keep hooks under `hooks/` with `useX` names and colocate CSS modules next to components when possible.

## Testing Guidelines
- Backend specs live alongside source as `*.spec.ts`. Use `npm test` or `npm run test:cov` before touching scoring/gameplay code. Avoid rewriting generated snapshots.
- Frontend currently lacks enforced tests; add Jest or Playwright coverage when fixing UI regressions. Store tests under `__tests__/` mirroring the component path.

## Commit & Pull Request Guidelines
- History favors concise, present-tense summaries (English or Japanese), e.g., `"ui fix"`, `"点数調整"`. Reference issue IDs where applicable.
- Pull requests should include: short summary, validation steps (`npm test`, manual steps), and screenshots/screencasts for UI changes. `main` auto-deploys via `.github/workflows/deploy.yml`, so ensure build/lint/test pass locally before merging.

## Additional Notes
- Fly.io autoscaling is managed via `.github/workflows/auto-scale.yml`; ensure `FLY_API_TOKEN` stays in repository secrets.
- Activity tracking and health checks live in `mei-tra-backend/src/controllers/health.controller.ts`—update them when changing connection logic.
