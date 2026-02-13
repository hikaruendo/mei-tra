# Cloudflare Migration Notes

## Frontend Worktree (`codex/cloudflare-frontend`)
- Located at `../worktrees/mei-tra-frontend-cloudflare/mei-tra-frontend`.
- Added `@cloudflare/next-on-pages` and `wrangler` dev deps plus `build:cf`/`deploy:cf` scripts.
- `next.config.mjs` now exports static output (`output: 'export'`, `experimental.optimizeCss`).
- `wrangler.toml` configured for Pages build output `.vercel/output/static` with compatibility date `2026-02-13`.
- `npm run build:cf` currently fails when Supabase env vars are missing; use `.dev.vars` or `wrangler secret put` to supply `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` before exporting.
- Local Pages dev: `npx wrangler pages dev .vercel/output/static --compatibility-date 2026-02-13`.

## Backend Worktree (`codex/cloudflare-backend`)
- Located at `../worktrees/mei-tra-backend-cloudflare/mei-tra-backend`.
- Seeded with `mei-tra-cloudflare` Worker prototype under `workers/api`.
- `wrangler.toml` now targets Cloudflare Workers with Durable Objects:
  ```toml
  name = "meitra-backend"
  main = "workers/api/src/index.ts"
  compatibility_date = "2026-02-13"
  [[durable_objects.bindings]]
  name = "ROOM_STATE"
  class_name = "RoomStateObject"
  [[migrations]]
  tag = "v1"
  new_classes = ["RoomStateObject"]
  [[r2_buckets]]
  binding = "AVATAR_BUCKET"
  bucket_name = "meitra-avatars"
  ```
- Durable Object class renamed to `RoomStateObject`; bindings updated accordingly.
- Install deps via `cd workers/api && npm install` (done) then `npm run dev` to launch Miniflare (ready on localhost:8788).
- Move secrets with `wrangler secret put` (Auth0, Supabase, JWT, etc.).

## Routing & Env
- Frontend rewrites still expect `NEXT_PUBLIC_BACKEND_URL`; point to `https://meitra-backend.hikaru.workers.dev` or custom domain once Worker is live.
- Configure custom domains in Cloudflare Pages (`meitra.kando1.com`) and Workers routes (`api.meitra.kando1.com`).
- Add `/api/health` Worker endpoint (already implemented) and frontend status ping.
- Documented build commands for CI (frontend: `npm run build:cf`, backend: `cd workers/api && npm run test && wrangler deploy`).
