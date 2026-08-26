# Repository Guidelines

## Project Structure & Module Organization
- `mei-tra-frontend/` hosts the Next.js app (App Router). Routes live under `app/`, feature-oriented React components live under `components/` (`game/`, `room/`, `shared/`, `auth/`, `social/`, etc.), styles in `styles/`, and hooks/utilities in `hooks/` / `lib/`. Static assets sit in `public/`.
- `mei-tra-backend/` contains the NestJS gateway plus Socket.IO hub (`src/`). Scripts for Fly.io and Supabase maintenance live in `scripts/`. Database resources are under `supabase/`.
- `contracts/` is the shared transport layer for REST DTOs and Socket.IO payloads. Keep UI-only types in `mei-tra-frontend/types/`, mobile UI types in `mei-tra-mobile/src/types/`, and backend domain/persistence types in `mei-tra-backend/src/types/`. The Expo mobile app lives in `mei-tra-mobile/`.
- Reserve `mei-tra-backend/src/types/` for explicitly named `*.types.ts` modules. Put transport/persistence transformations in `src/adapters/` and executable game-state operations in `src/domain/`; `npm run check:architecture` enforces this boundary.

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

## Agent-Friendly Architecture Contract
These assumptions are model-agnostic: coding agents, including GPT- and Grok-based agents, tend to reuse the nearest working pattern, edit already-visible files, choose the shortest locally valid path, and preserve code whose callers are unclear. Do not rely on an agent remembering to be careful; make the correct path the easiest path.

1. **The canonical path must require fewer decisions than a shortcut.** Following the established boundary, template, or command should be faster than inventing a local alternative. Treat recurring ambiguity as a missing repository guardrail, not as permission for a one-off choice.
2. **Forbidden dependencies must fail mechanically.** Encode boundaries and invariants in types, lint rules, architecture checks, tests, CI, or schemas instead of prose alone.
3. **Every persisted fact must have one canonical owner and writer.** Other layers derive, project, or reference that value; they must not maintain a second representation that requires synchronized writes.
4. **Prefer additive, isolated extension points for genuinely independent work.** Add a focused file or module behind an existing boundary instead of adding branches to a shared root. This does not permit duplicate business rules, persisted representations, or writers: shared behavior must be changed at its canonical owner.
5. **Exceptions must be narrow, explicit architecture changes.** Minimize their scope, document the reason next to the enforcement boundary, and review them as a deliberate design change rather than a temporary bypass.

If a requested implementation conflicts with this contract or a repository invariant, state the conflict and propose a compliant alternative before editing. Before changing shared logic, check whether an isolated addition can solve the task without creating a second owner. Do not delete code with untraced callers; show search, type, or test evidence when deletion is necessary. Compilation or a passing happy path is not sufficient validation: finish by checking the dependency direction, canonical owner, write path, extension shape, and any exception introduced by the change.

## Build, Test, and Development Commands
- Frontend: `cd mei-tra-frontend && npm run dev` (Turbopack dev server), `npm run build` (Next production build), `npm run lint` (ESLint), `npm run test` (Jest/RTL) when applicable.
- Backend: `cd mei-tra-backend && npm run start:dev` (Nest hot reload), `npm run build` (tsc), `npm run lint` (ESLint + Prettier), `npm test` and `npm run test:cov` for core game logic.
- Mobile: `cd mei-tra-mobile && npm run ios` or `npm run android`, then `npm run typecheck`, `npm run lint`, and `npm test`.
- Supabase workflows rely on `supabase start/stop` from the repo root. Run `bash scripts/create-test-users.sh` after reseeding.

## Coding Style & Naming Conventions
- TypeScript with 2-space indentation and semicolons. Prefer PascalCase for React components/providers, camelCase for functions/variables, UPPER_SNAKE_CASE for shared constants.
- Frontend linting: `eslint` + `eslint-config-next`. Backend uses `eslint` + `prettier`. Keep hooks under `hooks/` with `useX` names and colocate CSS modules next to components when possible.

## Testing Guidelines
- Backend specs live alongside source as `*.spec.ts`. Use `npm test` or `npm run test:cov` before touching scoring/gameplay code. Avoid rewriting generated snapshots.
- Frontend currently lacks enforced tests; add Jest or Playwright coverage when fixing UI regressions. Store tests under `__tests__/` mirroring the component path.

## Commit & Pull Request Guidelines
- History favors concise, present-tense summaries (English or Japanese), e.g., `"ui fix"`, `"点数調整"`. Reference issue IDs where applicable.
- Pull requests should include: short summary, validation steps (`npm test`, manual steps), and screenshots/screencasts for UI changes. AI agents opening PRs must also fill the `User-facing change` and `User benefit` sections from `.github/pull_request_template.md`; keep their combined text factual, under 240 characters, and free of URLs or media claims. `main` auto-deploys via `.github/workflows/deploy.yml`, so ensure build/lint/test pass locally before merging.

## Additional Notes
- Fly.io autoscaling is managed via `.github/workflows/auto-scale.yml`; ensure `FLY_API_TOKEN` stays in repository secrets.
- Activity tracking and health checks live in `mei-tra-backend/src/controllers/health.controller.ts`—update them when changing connection logic.
