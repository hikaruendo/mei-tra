---
name: review-meitra
description: Meitra（明専トランプ / old-maid）の設計・コードレビュー用。Web frontend、Expo/React Native mobile、NestJS/Socket.IO backend、Supabase、共有contracts、game state、再接続/COM、migration、UI変更を、seat identity、phase、永続化、transport契約、層・型配置の平仄、重複remapやsource of truthの分裂から評価する時に使う。修正・refactorは明示依頼時だけ実装する。
---

# Meitra Change Review

## Default mode

Review before editing. Do not change code, commit, push, or update a PR unless the user explicitly asks.

- Treat “review,” “look at this PR,” and `$review-meitra` as review-only requests.
- Treat “fix,” “implement,” and “refactor” as permission to make the smallest change that addresses an identified finding.
- Do not report production, Fly scale-to-zero, device, simulator, or browser validation as complete unless it was actually performed.

## Inputs and references

- Use the specified base/head or files. If none are supplied, review the current diff and state that assumption.
- Read `AGENTS.md`, `README.md`, the changed code, and only the relevant `docs/developer-guide/` chapter.
- Read `references/meitra-architecture.md` only for reconnect, roster, persistence, migration, timer, or source-of-truth questions.
- For mobile changes, read `mei-tra-mobile/ARCHITECTURE.md` from the reviewed head or its worktree. If it is absent from the current checkout, locate the head worktree or read it with `git show <head>:mei-tra-mobile/ARCHITECTURE.md`. Skip it only when the reviewed change does not contain it. Use it for the provider tree, GameContext reducer, Socket.IO event map, resync flight, auth flow, and push notification flow.
- Treat code as authoritative when it conflicts with docs. Distinguish existing uncommitted work from the reviewed change.
- Treat `contracts/` changes as cross-platform changes. Verify the backend producer/consumer and both Web and mobile consumers that use the changed contract.

## Review workflow

1. Trace each changed input through state transition, persistence, Socket emit, and UI projection. For mobile, include the GameContext reducer/effects and socket adapter in that trace.
2. Run an architecture coherence pass before judging local correctness:
   - Name the concept being changed and identify its canonical owner: `contracts/`, backend `src/types/`, Domain, UseCase/service, repository, frontend hook, or UI.
   - Reserve backend `src/types/` for explicitly named `*.types.ts` modules. Standalone mappers, adapters, state repair, and domain operations belong in `src/adapters/` or `src/domain/`; run `npm run check:architecture` when backend files move across these boundaries.
   - Search sibling implementations before accepting a new type, helper, service, mapper, or adapter. Require equivalent concepts to use the same layer, folder, naming, error contract, and dependency direction.
   - Count transformations of the same identity or state. One boundary adapter is acceptable; repeated `remap`, duplicate shapes, fallback chains, or object reconstruction across Domain, UseCase, Gateway, persistence, Web, and Mobile indicate a split source of truth.
   - Review stacked or adjacent changes cumulatively. If several fixes translate or repair the same concept in different places, recommend a canonical representation and deletion of the repair paths instead of another local mapper.
3. Check the applicable invariants:
   - Preserve four-player/two-team seat order, turn order, and team membership.
   - Keep canonical `seatId`, authenticated `userId`, and transient `socketId` distinct; do not reintroduce `playerId`.
   - Preserve seat identity across human, COM, vacant-seat, and reconnect transitions.
   - Advance blow, play, field completion, round end, and game over exactly once.
   - Reconstruct active state from persisted data after a restart; never rely only on memory or `socketId`.
   - Keep cross-table and JSONB writes atomic; migration-only paths must remain isolated from runtime logic.
   - Keep Socket payloads in `contracts/` and avoid domain, DB, and UI type leakage.
   - Verify layout changes at the requested text scale and viewport when visual evidence is available.
   - **Mobile state:** Keep shared room, game, and connection state mutations in the GameContext reducer. Socket listeners dispatch actions, and reducer actions remain pure. Local component-only UI state may remain outside the reducer.
   - **Provider dependencies:** Preserve the dependency order documented in `ARCHITECTURE.md`: SafeAreaProvider > ThemeProvider > AuthProvider > GameProvider > SocialProvider > NotificationProvider > Stack. A provider must not consume a context below it.
   - **Resync flight:** Coalesce concurrent flights. Always refresh rooms; when an active room is known, also request `sync-game-state`. Do not mark the connection `connected` before the responses required for that flight arrive.
   - **Secure session storage:** Store Supabase sessions through `LargeSecureStore`, with the 256-bit AES key in SecureStore and ciphertext in AsyncStorage. Never persist plaintext session tokens in AsyncStorage.
   - **Push tokens:** Keep registration idempotent for the current user and device. Unregister before clearing a session on sign-out; on account deletion, keep local cleanup and server deletion/cascade behavior consistent.
   - **Socket delivery:** Use typed `emitWithAck` with the established timeout for ackable room/lobby commands. Keep one-way game actions on the existing deduplicated `emitOneWayAction` path unless the shared transport contract changes deliberately.
4. Check adjacent paths: join/leave/auth update, COM replacement/autoplay, full-room recovery/team shuffle, spectator/chat/profile overlap, cold start, and timer resumption.
   - For mobile, also check AppState background-to-foreground resync, NetInfo offline-to-online recovery, push deep links, keep-awake cleanup, and game-over navigation.
5. Check that Gateway code remains limited to auth, parsing, room membership, UseCase calls, and event dispatch; keep game rules, recovery policy, and DB merges outside it.
6. Run the narrowest relevant tests when review scope or user request requires validation. Separate new failures from existing failures.
   - For mobile, use the package scripts in `mei-tra-mobile/`: `npm run typecheck`, `npm run lint`, and the narrowest relevant `npm test -- <path>` or `npm test`.
   - For mobile UI or lifecycle changes, validate the affected simulator/device viewport, safe areas, and foreground/background path when practical. State clearly when this was not run.

## Platform-specific checks

### Web frontend (`mei-tra-frontend/`)

- Use SCSS Modules rather than Tailwind. Ensure module selectors contain a local class.
- Reuse `--mt-*` custom properties from `styles/base/variables.scss`.

### Mobile (`mei-tra-mobile/`)

- Put static styles in `StyleSheet.create()`. Use inline style objects only for genuinely dynamic values, and avoid recreating equivalent static objects during render.
- Reuse `theme/colors.ts` for shared colors. Add reusable colors as tokens; keep localized card, suit, or team semantic constants explicit.
- Use expo-router for navigation rather than introducing a second navigation system.
- Use `@meitra/game-client/card-legality` for card playability; do not duplicate validation rules.
- Import shared transport and game types from `@meitra/contracts`; do not redeclare equivalent mobile interfaces.
- Isolate real platform divergence behind `.native.ts`/`.web.ts` adapters instead of scattering platform checks through UI code.
- Clean up component/provider-owned AppState, NetInfo, notification, timer, and keep-awake subscriptions when their owner unmounts or the session changes. Process-wide lifecycle singletons may retain native listeners, but must initialize once and must remove individual subscribers.

### Contracts (`contracts/`)

- Treat adding, removing, or changing a field as a cross-platform compatibility change. Verify backend emits/handlers, Web handlers, and the mobile reducer agree on the shape.
- Keep Socket event names and payloads aligned with `ServerToClientEvents` and `ClientToServerEvents`.

## Review output

Return findings in priority order. For each actionable P1/P2 finding, provide:

- the smallest affected file and line;
- a concrete failure scenario and impact;
- the root cause introduced by the change; and
- the smallest safe fix.

Do not report style preferences or speculative issues. If none are actionable, state that directly. List completed validation and untested production, cold-start, multi-session, device, or UI scenarios separately.

Treat consistency as actionable only when the change creates a second owner, bypasses a canonical boundary, duplicates behavior that can diverge, or makes future fixes require synchronized edits. Do not report naming or folder taste alone.

## Fix mode

After an explicit fix request:

1. Map the fix to the violated invariant and keep its scope minimal.
2. Reuse the existing UseCase, service, effects, and adapter boundaries; do not add duplicate writes or hidden side effects. For mobile shared state, reuse existing GameContext actions and reducer paths rather than adding direct socket listeners to components.
3. Add or update the nearest regression test, then run focused tests, build, and lint where practical.
4. Report the behavior change, validation evidence, and remaining risks.
