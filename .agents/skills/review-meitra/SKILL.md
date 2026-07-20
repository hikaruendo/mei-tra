---
name: review-meitra
description: Meitra（明専トランプ / old-maid）の設計・コードレビュー用。frontend、NestJS/Socket.IO、Supabase、game state、再接続/COM、migration、UI変更を、seat identity、phase、永続化、transport契約の不変条件で評価する時に使う。修正・refactorは明示依頼時だけ実装する。
---

# Meitra Change Review

## Default mode

Review before editing. Do not change code, commit, push, or update a PR unless the user explicitly asks.

- Treat “review,” “look at this PR,” and `$review-meitra` as review-only requests.
- Treat “fix,” “implement,” and “refactor” as permission to make the smallest change that addresses an identified finding.
- Do not report production, Fly scale-to-zero, device, or browser validation as complete unless it was actually performed.

## Inputs and references

- Use the specified base/head or files. If none are supplied, review the current diff and state that assumption.
- Read `AGENTS.md`, `README.md`, the changed code, and only the relevant `docs/developer-guide/` chapter.
- Read `references/meitra-architecture.md` only for reconnect, roster, persistence, migration, timer, or source-of-truth questions.
- Treat code as authoritative when it conflicts with docs. Distinguish existing uncommitted work from the reviewed change.

## Review workflow

1. Trace each changed input through state transition, persistence, Socket emit, and UI projection.
2. Check the applicable invariants:
   - Preserve four-player/two-team seat order, turn order, and team membership.
   - Keep `playerId`, `userId`, and `socketId` distinct.
   - Preserve seat identity across human, COM, vacant-seat, and reconnect transitions.
   - Advance blow, play, field completion, round end, and game over exactly once.
   - Reconstruct active state from persisted data after a restart; never rely only on memory or `socketId`.
   - Keep cross-table and JSONB writes atomic or explicitly compatible during migration.
   - Keep Socket payloads in `contracts/` and avoid domain, DB, and UI type leakage.
   - Verify layout changes at the requested text scale and viewport when visual evidence is available.
3. Check adjacent paths: join/leave/auth update, COM replacement/autoplay, full-room recovery/team shuffle, spectator/chat/profile overlap, cold start, and timer resumption.
4. Check that Gateway code remains limited to auth, parsing, room membership, UseCase calls, and event dispatch; keep game rules, recovery policy, and DB merges outside it.
5. Run the narrowest relevant tests when review scope or user request requires validation. Separate new failures from existing failures.

## Review output

Return findings in priority order. For each actionable P1/P2 finding, provide:

- the smallest affected file and line;
- a concrete failure scenario and impact;
- the root cause introduced by the change; and
- the smallest safe fix.

Do not report style preferences or speculative issues. If none are actionable, state that directly. List completed validation and untested production, cold-start, multi-session, or UI scenarios separately.

## Fix mode

After an explicit fix request:

1. Map the fix to the violated invariant and keep its scope minimal.
2. Reuse the existing UseCase, service, effects, and adapter boundaries; do not add duplicate writes or hidden side effects.
3. Add or update the nearest regression test, then run focused tests, build, and lint where practical.
4. Report the behavior change, validation evidence, and remaining compatibility debt.
