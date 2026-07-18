# Meitra: Accessible Play for a 100-Year-Old Card Game

This document records the OpenAI Build Week 2026 submission scope for
Meitra, an online implementation of the four-player team card game
Meisen Trump (明専トランプ).

## Submission snapshot

- **Track:** Apps for Your Life
- **Live demo:** https://meitra.kando1.com/
- **Repository:** https://github.com/hikaruendo/mei-tra
- **License:** MIT; see [LICENSE](../LICENSE).

### Short description

Meitra brings a 100-year-old team card game online with an accessible play
mode: adjustable text and card scale, locally bundled Japanese fonts,
responsive game-table layouts, and match-safe navigation.

## What existed before Build Week

Meitra already supported real-time, four-player online games. It includes a
Next.js frontend, a NestJS and Socket.IO backend, and the complete game rules.

## What was added during Build Week

The July 16, 2026 accessibility extension makes the existing game usable at
larger reading sizes without turning a live table into an unusable or unsafe
layout.

- Added 1.0x, 1.5x, and 2.0x reading-scale preferences and persisted them in
  the frontend preferences layer.
- Scaled cards and reflowed the room, waiting, game-table, chat, strength-order,
  player, and action controls for larger reading sizes.
- Bundled the Japanese display and UI fonts locally so the experience remains
  readable even when third-party font delivery is unavailable.
- Added visual themes and improved contrast across shared UI components.
- Prevented actions that would interrupt an active match, including navigation
  away from the game, profile editing, and game-history navigation.
- Clarified the tutorial's first use of `キリ` as `キリ（切り札）`.

The implementation evidence is in these dated commits:

```text
39ee990 2026-07-16 UIアクセシビリティとテーマを調整
07c942f 2026-07-16 外部フォントをローカル同梱に切り替え
64b2a02 2026-07-16 文字倍率の未適用箇所を修正
6a27350 2026-07-16 対局中の画面遷移を制限
07dc571 2026-07-16 プロフィール編集を無効化ボタンに変更
445a8e6 2026-07-16 キリの説明表記を統一
```

## How Codex helped

Codex was used to inspect the responsive layouts across the game surface,
trace preference propagation, refactor the shared scale variables, and add
regression coverage for in-game navigation and disabled profile actions. It
also helped validate the frontend test suite and production build after the
accessibility changes.

For the Devpost submission, include the `/feedback` session ID from the Codex
session that produced the majority of this extension.

## Run and test

Requirements: Node.js 18+, npm, Docker Desktop, and the Supabase CLI for a
fully local stack.

```bash
# Optional local Supabase setup
cd mei-tra-backend
npm run supabase:start
bash scripts/create-test-users.sh
npm run start:dev

# In a second terminal
cd mei-tra-frontend
npm run dev
```

Open `http://localhost:3000`, create or join a room, and use the navigation
settings to switch among 1.0x, 1.5x, and 2.0x. Verify that cards, player
information, chat, and modal content stay within the game surface.

```bash
cd mei-tra-frontend
npm test -- --runInBand
npm run lint
npm run build
```

## Demo video outline (under three minutes)

1. **0:00–0:20 — The problem:** introduce Meitra and explain why a social,
   four-player card table must stay understandable for people with different
   reading needs.
2. **0:20–1:05 — Accessible scale:** switch from 1.0x to 1.5x and 2.0x while
   showing that card, room, and player UI scale together.
3. **1:05–1:45 — A live table:** show the waiting screen, game table, chat,
   strength-order panel, and a larger-text layout without clipping.
4. **1:45–2:15 — Match safety:** show that profile edit and disruptive
   navigation are disabled during a match.
5. **2:15–2:50 — Codex and verification:** show the dated commits, relevant
   tests, and the frontend build passing.

## Devpost copy

### Inspiration

Meitra is an online home for Meisen Trump, a Japanese four-player team card
game with more than a century of history. The game is social by design: people
need to read cards, player status, bidding context, and chat while talking to
one another. We wanted the online version to remain playable for people whose
preferred reading size is much larger than a typical game UI allows.

### What it does

Meitra now has an accessible play mode built around 1.0x, 1.5x, and 2.0x
reading scales. Text and cards scale together, the responsive table reflows,
and important panels such as chat and strength order remain contained. The
extension also uses locally bundled Japanese fonts, themes with improved
contrast, and disabled controls for actions that could disrupt a live match.

### How we built it

The frontend is Next.js and TypeScript; the real-time game backend is NestJS
and Socket.IO. We used Codex to inspect layout dependencies across the game,
propagate scale preferences through shared variables, harden in-game actions,
and add regression tests. The dated commits above distinguish the Build Week
extension from the pre-existing game.

### Challenges we ran into

Increasing font size alone made a real-time card table overflow, overlap, and
hide controls. The solution was not a global zoom: we scaled cards separately,
gave each table region explicit responsive constraints, and treated every
modal and in-game action as part of the accessible flow.

### Accomplishments that we're proud of

We preserved the character of a dense, social card game while making its
reading scale adjustable. Players can use larger text without sacrificing the
table, their hand, chat, or safety during an active game.

### What we learned

Accessibility in an interactive game is a systems problem. A preference only
helps when fonts, cards, controls, overlays, and navigation all honor it
consistently.

### What's next for Meitra

We will continue usability testing with players who prefer larger text,
improve the onboarding flow, and grow regular game tables around this
long-running community game.
