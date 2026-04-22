# 05. Data, Auth, and Persistence

この章では、現行 `main` が Supabase をどう使っているか、認証と永続化が frontend / backend 間でどう分担されているか、そして型や migration がどこを source of truth にしているかを整理します。

このプロジェクトで最も誤解しやすいのは、「Supabase を使っている」という一言で片付けてしまうことです。実際には、Supabase は三つの役割を同時に持っています。

- Auth
- Postgres
- Storage

しかも、frontend と backend で使い方が違います。

- frontend は anon key と session cookie を使って auth client として動く
- backend は service role key を使って privileged adapter として動く

この分担を理解しないままコードを追うと、「なぜログインは frontend でやるのに profile 更新は backend 経由なのか」「なぜ avatar upload だけ別 route があるのか」「なぜ storage policy があるのに backend upload が通るのか」が見えません。

## 1. データ境界の全体像

まず、大きな責務分担を図で押さえます。

```text
Browser
  ├─ Supabase Auth client
  ├─ Next.js route handlers
  └─ Socket.IO client

Backend
  ├─ AuthService (token validation)
  ├─ REST controllers
  ├─ Game / Social gateways
  └─ Repositories -> SupabaseService

Supabase
  ├─ auth.users
  ├─ user_profiles
  ├─ rooms / room_players / game_states / game_history
  ├─ chat_rooms / chat_members / chat_messages
  └─ storage bucket: avatars
```

この図で見ると、Auth と DB と Storage はすべて Supabase 上にありますが、frontend はそのうち「Auth session を扱うこと」に集中し、backend は「アプリケーションデータと storage を扱うこと」に集中していると分かります。

## 2. 認証モデル

### 2.1 frontend が auth の入口

サインアップ、サインイン、サインアウト、パスワードリセットは frontend 側の `AuthContext` と Supabase client で行います。主要ファイルは次です。

- `mei-tra-frontend/lib/supabase.ts`
- `mei-tra-frontend/lib/supabase-server.ts`
- `mei-tra-frontend/contexts/AuthContext.tsx`
- `mei-tra-frontend/components/auth/*`
- `mei-tra-frontend/app/[locale]/auth/callback/route.ts`
- `mei-tra-frontend/app/[locale]/auth/reset-password/page.tsx`

Auth callback は current `main` では page component ではなく route handler 側で処理されます。Supabase から返る code を server-side で `exchangeCodeForSession()` し、その結果の cookie を確定してから redirect する構成です。

### 2.2 backend は token validator

backend 側の `AuthService` は token を検証し、必要に応じて `user_profiles` を補完する責務を持ちます。主な処理は:

- token cache
- `supabase.client.auth.getUser(token)` による検証
- `user_profiles` の取得
- profile がなければ `createOrUpdateUserProfile()` で作成
- `updateLastSeen()`

つまり backend は session issuer ではなく、「frontend が持ってきた access token を信頼可能な user に変換する component」です。

### 2.3 socket 認証

socket 認証には二つの経路があります。

- handshake 時の token
- 後から送る `update-auth`

メイン socket は reconnect や auth 反映の都合で後者も持っています。social socket は接続時 token が必須で、失敗すると切断されます。チャットの方が認証要件は厳密です。

## 3. user profile の扱い

### 3.1 `auth.users` と `user_profiles`

Supabase Auth の canonical user は `auth.users` です。一方、このアプリが UI やゲーム表示で使う profile は `public.user_profiles` にあります。

`20250913083109_add_user_authentication.sql` では:

- `user_profiles` テーブルを作成
- `room_players.user_id` を追加
- `auth.users` insert 時に profile を自動作成する trigger を入れる

という形で、認証基盤とアプリ profile を連結しています。

### 3.2 profile row の中身

現行 profile は少なくとも次を持ちます。

- `id`
- `username`
- `display_name`
- `avatar_url`
- `created_at`
- `updated_at`
- `last_seen_at`
- `games_played`
- `games_won`
- `total_score`
- `preferences`

このため、profile は単なる表示名テーブルではなく、ゲーム実績とユーザー設定のストレージでもあります。

### 3.3 frontend での profile hydration

`AuthContext` は session を得たあと、`user_profiles` から profile を読みに行きます。ここでは:

- sessionStorage cache
- timeout
- retry
- background refresh

を持っています。frontend は「認証できた瞬間に profile 完全読込済み」とは限りません。このタイミング差は UI 実装で気にする必要があります。

### 3.4 backend での profile 補完

`AuthService.validateToken()` は profile がなければ `createOrUpdateUserProfile()` で作ります。つまり frontend trigger だけに依存せず、backend 側でも「profile がなければ作る」という defensive behavior を持っています。

## 4. preferences と型差異

この repo で見逃しやすいのが、preferences 周りの「frontend と backend のズレ」です。

### 4.1 frontend 側の preference 型

`mei-tra-frontend/types/user.types.ts` では:

- `theme: 'system' | 'light' | 'dark'`
- `fontSize: 'standard' | 'large' | 'xlarge' | 'xxlarge'`

を持ちます。

`lib/preferences.ts` では:

- default theme: `dark`
- default font size: `standard`

です。

### 4.2 backend 側の preference 型

`mei-tra-backend/src/types/user.types.ts` では:

- `theme: 'light' | 'dark'`
- `fontSize` は migration により後から追加

になっています。frontend が持つ `system` は transport 契約に乗せず、API 呼び出し時に concrete な `light` / `dark` へ変換します。

### 4.3 migration の default

`20250913083109_add_user_authentication.sql` の `preferences` default は:

- notifications: true
- sound: true
- theme: light

です。さらに `20260411000000_add_font_size_preference.sql` で `fontSize: standard` が追加されます。

つまり現行システムでは、次の差が存在します。

- frontend default theme: dark
- DB default theme: light
- frontend UI type は `system` を許す
- transport / backend は `system` を持たない

実際の UI では `normalizeUserPreferences()`、localStorage bootstrap、`updateUserProfileViaApi()` の transport 変換で吸収しています。新しく preferences を追加するときは、この境界を踏まえて `contracts/profile.ts`、backend 永続化型、frontend UI 型を順に揃える必要があります。

## 5. frontend / backend / DB で見た source of truth

現行 repo では「すべての型を一か所に集める」のではなく、責務ごとに source of truth を分けています。実務的には次のように見るのが安全です。

### 5.1 transport 契約の source of truth

- REST DTO / Socket.IO payload: `contracts/`
- profile REST: `contracts/profile.ts`
- social socket: `contracts/social.ts`
- game socket: `contracts/game.ts`

### 5.2 auth identity の source of truth

- 物理的には `auth.users`
- frontend 実行時は `AuthContext.user`
- backend 実行時は `AuthenticatedUser`

### 5.3 profile の source of truth

- DB schema と永続化の source: `user_profiles`
- frontend 表示 shape の source: `mei-tra-frontend/types/user.types.ts`
- backend 更新 shape の source: `mei-tra-backend/src/types/user.types.ts`

### 5.4 game room / player の source of truth

- persistence: `rooms`, `room_players`
- runtime: room ごとの `GameStateService`
- frontend 表示: `types/room.types.ts`, `types/game.types.ts`

### 5.5 social chat の source of truth

- persistence: `chat_rooms`, `chat_members`, `chat_messages`
- runtime / domain: `ChatService` と repository 実装
- transport: `contracts/social.ts`

「どれが唯一の正か」というより、「どの観点の正か」を分けて考える必要があります。transport の正は `contracts/`、UI の正は frontend、永続化の正は DB schema / backend です。

## 6. DB schema の進化

migration を時系列で見ると、システムの進化が分かりやすいです。

### 6.1 `001_initial_schema.sql`

ここで作られる主テーブルは:

- `rooms`
- `room_players`
- `game_states`
- `game_history`

加えて enum, index, updated_at trigger, RLS policy があります。ここがゲーム persistence の最初の核です。

`game_states` は relation fully normalized ではなく、`state_data` JSONB を含む state snapshot 型である点が重要です。現在の backend はこれに加えて `game_history` を補助的 action log として使っており、snapshot だけでは追いづらい `game_started`、`blow_declared`、`card_played`、`field_completed`、`game_over` などを時系列で残します。read-side もあり、backend の `summary` / `replay` endpoint と frontend の audit page はこの `game_history` を直接使います。

### 6.2 `20250913083109_add_user_authentication.sql`

ここで:

- `user_profiles`
- `room_players.user_id`
- profile 自動作成 trigger

が追加されます。ゲームが「匿名接続中心」から「認証済みユーザー中心」へ寄った大きな転換点です。

### 6.3 `20250914000000_add_social_chat_tables.sql`

ここで social layer が追加されます。

- `chat_rooms`
- `chat_members`
- `chat_messages`
- pg_cron を使った message cleanup
- default chat room 作成

チャットは後付け機能ではありますが、現在は UI と密接に結び付いています。

### 6.4 `20260111100000_create_avatars_bucket.sql`

ここで `avatars` bucket が作成されます。public bucket で、select / insert / update / delete policy も定義されています。

ただし backend は service role で書き込むため、RLS だけを見て upload 経路を判断しない方がよいです。

### 6.5 `20260111090000_add_cron_cleanup.sql`

ここでは:

- `cleanup_old_game_data()` function
- `game_history`, `game_states`, `room_players`, `rooms` の古いデータ削除
- pg_cron で毎日 03:00 UTC 実行

が追加されます。

### 6.6 最近の profile 拡張

- `20260329050000_change_total_score_to_numeric.sql`: `total_score` を numeric(10,1) に変更
- `20260411000000_add_font_size_preference.sql`: `fontSize` preference を追加

profile は現在も進化中の schema です。

## 7. 永続化対象ごとの境界

### 7.1 room と room players

room metadata は `rooms`、参加者は `room_players` にあります。`SupabaseRoomRepository` は対象 room 群の player rows をまとめて取得し、memory 上で group 化して `Room` を構築します。

この説明が指す主なコードは次です。

- DB schema:
  - `mei-tra-backend/supabase/migrations/001_initial_schema.sql` の `rooms` / `room_players`
  - `mei-tra-backend/supabase/migrations/20250913083109_add_user_authentication.sql` の `room_players.user_id`
  - `mei-tra-backend/supabase/migrations/20260314080000_add_room_players_is_com.sql` の COM player flag
- repository 境界:
  - `mei-tra-backend/src/repositories/interfaces/room.repository.interface.ts`
  - `mei-tra-backend/src/repositories/implementations/supabase-room.repository.ts`
  - `create()`, `findById()`, `addPlayer()`, `removePlayer()`, `updatePlayer()`, `findRecentFinishedByUserId()`
- application / session 境界:
  - `mei-tra-backend/src/services/room.service.ts`
  - `mei-tra-backend/src/services/room-join.service.ts`
  - `mei-tra-backend/src/use-cases/create-room.use-case.ts`
  - `mei-tra-backend/src/use-cases/join-room.use-case.ts`

ここで注意すべきこと:

- room に player が複数いるので read path が重い
- runtime 上の `room.players` と waiting room UI が強く結び付いている
- `isCOM`, `isReady`, `isHost` などは player row にも保持される
- finished room も一定期間残し、プロフィールの recent matches から参照する

### 7.2 game state

`game_states` には players, deck, agari, blowState, playState を `state_data` JSONB に持ちつつ、current player index や team scores は別カラムでも持ちます。

この説明が指す主なコードは次です。

- DB schema:
  - `mei-tra-backend/supabase/migrations/001_initial_schema.sql` の `game_states`
- repository 境界:
  - `mei-tra-backend/src/repositories/interfaces/game-state.repository.interface.ts`
  - `mei-tra-backend/src/repositories/implementations/supabase-game-state.repository.ts`
  - `create()`, `findByRoomId()`, `update()`, `updatePlayers()`, `updatePlayerConnection()`, `updateGamePhase()`
- runtime state 境界:
  - `mei-tra-backend/src/services/game-state.service.ts`
  - `mei-tra-backend/src/services/game-state-manager.service.ts`
  - `mei-tra-backend/src/services/player-connection-manager.service.ts`
- state を変更する use-case 例:
  - `mei-tra-backend/src/use-cases/start-game.use-case.ts`
  - `mei-tra-backend/src/use-cases/declare-blow.use-case.ts`
  - `mei-tra-backend/src/use-cases/play-card.use-case.ts`
  - `mei-tra-backend/src/use-cases/complete-field.use-case.ts`
- frontend が受け取る場所:
  - `mei-tra-frontend/hooks/useGame.ts` の `game-state`, `update-turn`, `card-played` handlers
  - `mei-tra-frontend/types/game.types.ts`

この設計の利点:

- state snapshot をまとめて保存しやすい
- reconnect 時の復元がしやすい

欠点:

- JSON shape と TypeScript 型がずれると runtime bug になる
- 部分更新時に merge ロジックが必要

`SupabaseGameStateRepository.update()` が current `state_data` を読んで merge しているのは、この欠点を吸収するためです。

### 7.3 chat

chat は二層です。

- room metadata: `chat_rooms`
- membership: `chat_members`
- message: `chat_messages`

この説明が指す主なコードは次です。

- DB schema:
  - `mei-tra-backend/supabase/migrations/20250914000000_add_social_chat_tables.sql`
- socket entrypoint:
  - `mei-tra-backend/src/social.gateway.ts`
  - `chat:post-message`, `chat:list-messages` などの inbound event
- service / repository 境界:
  - `mei-tra-backend/src/services/chat.service.ts`
  - `mei-tra-backend/src/repositories/interfaces/chat-room.repository.interface.ts`
  - `mei-tra-backend/src/repositories/interfaces/chat-message.repository.interface.ts`
  - `mei-tra-backend/src/repositories/implementations/supabase-chat-room.repository.ts`
  - `mei-tra-backend/src/repositories/implementations/supabase-chat-message.repository.ts`
- transport 契約:
  - `contracts/social.ts`

`ChatService.listMessages()` は sender profile を batch fetch して join するため、永続化だけで完結せず、presentation-ready shape を組み立てる service 層が必要になっています。

### 7.4 avatar

avatar upload の流れは:

1. browser が Next.js route `/api/user-profile/[id]/avatar` に formData を投げる
2. route が backend `/api/user-profile/:id/avatar` に転送する
3. backend が Sharp で 128x128 WebP に最適化する
4. backend が Supabase Storage `avatars` bucket に upload する
5. public URL を `user_profiles.avatar_url` に保存する

この説明が指す主なコードは次です。

- Storage schema / policy:
  - `mei-tra-backend/supabase/migrations/20260111100000_create_avatars_bucket.sql`
- frontend upload UI:
  - `mei-tra-frontend/components/profile/ProfileEditForm.tsx`
  - `uploadAvatar()`, `handleAvatarSelect()`
- Next.js proxy route:
  - `mei-tra-frontend/app/api/user-profile/[id]/avatar/route.ts`
- backend endpoint:
  - `mei-tra-backend/src/controllers/user-profile.controller.ts`
  - `uploadAvatar()`, `deleteOldAvatar()`, `extractAvatarObjectPath()`
- profile row update:
  - `mei-tra-backend/src/repositories/implementations/supabase-user-profile.repository.ts`
  - `update()`
- response contract:
  - `contracts/profile.ts` の `AvatarUploadResponseDto`

このとき backend endpoint 自体は `AuthGuard` + self-only check で保護されます。したがって、avatar upload は「service role で動く privileged upload」ではありますが、HTTP レベルでは bearer token を持つ本人しか実行できません。

このパスにより、frontend は storage 操作や画像変換を知らなくて済みます。

### 7.5 profile write

text profile update と preference update も current frontend では `/api/user-profile/[id]` を通します。流れは:

1. browser が Next.js route `/api/user-profile/[id]` に JSON を送る
2. route が bearer token を backend `/api/user-profile/:id` に転送する
3. backend が `AuthGuard` + self-only check を行う
4. repository が `user_profiles` row を更新する

この説明が指す主なコードは次です。

- DB schema:
  - `mei-tra-backend/supabase/migrations/20250913083109_add_user_authentication.sql` の `user_profiles`
  - `mei-tra-backend/supabase/migrations/20260411000000_add_font_size_preference.sql`
- frontend profile UI / auth state:
  - `mei-tra-frontend/components/profile/ProfilePage.tsx`
  - `mei-tra-frontend/components/profile/ProfileEditForm.tsx`
  - `mei-tra-frontend/contexts/AuthContext.tsx`
  - `mei-tra-frontend/lib/api/user-profile.ts`
- Next.js proxy route:
  - `mei-tra-frontend/app/api/user-profile/[id]/route.ts`
- backend endpoint:
  - `mei-tra-backend/src/controllers/user-profile.controller.ts`
  - `getProfile()`, `updateProfile()`
- backend auth / repository:
  - `mei-tra-backend/src/auth/auth.service.ts`
  - `validateToken()`, `createOrUpdateUserProfile()`, `updateLastSeen()`
  - `mei-tra-backend/src/repositories/interfaces/user-profile.repository.interface.ts`
  - `mei-tra-backend/src/repositories/implementations/supabase-user-profile.repository.ts`
- transport 契約:
  - `contracts/profile.ts`

これにより、frontend の profile 編集 UI と Navigation の theme / font size 更新は、最終的に同じ backend 認可境界へ寄ります。

### 7.6 profile recent game history

プロフィール画面の「最近の対局」一覧は `/api/user-profile/[id]/game-history` を通します。流れは:

1. browser が Next.js route `/api/user-profile/[id]/game-history` を叩く
2. route が bearer token 付きで backend `/api/user-profile/:id/game-history` に転送する
3. backend が `AuthGuard` + self-only check を行う
4. `SupabaseRoomRepository.findRecentFinishedByUserId()` が finished room を新着順で取る
5. `GameEventLogService.summarizeByRoomId()` が room ごとの summary を補完する
6. frontend は一覧だけ描画し、詳細は `/{locale}/game-history/[roomId]` へ遷移する

この説明が指す主なコードは次です。

- DB schema:
  - `mei-tra-backend/supabase/migrations/001_initial_schema.sql` の `rooms`, `room_players`, `game_history`
- frontend entrypoint:
  - `mei-tra-frontend/components/profile/ProfilePage.tsx`
  - `mei-tra-frontend/components/profile/ProfileRecentMatchesSection.tsx`
  - `mei-tra-frontend/hooks/useProfileGameHistory.ts`
  - `mei-tra-frontend/lib/api/profile-game-history.ts`
- Next.js proxy route:
  - `mei-tra-frontend/app/api/user-profile/[id]/game-history/route.ts`
- backend endpoint / use-case:
  - `mei-tra-backend/src/controllers/user-profile.controller.ts` の `GET /user-profile/:id/game-history`
  - `mei-tra-backend/src/use-cases/get-user-recent-game-history.use-case.ts`
  - `mei-tra-backend/src/use-cases/interfaces/get-user-recent-game-history.use-case.interface.ts`
- read-side:
  - `mei-tra-backend/src/repositories/implementations/supabase-room.repository.ts` の `findRecentFinishedByUserId()`
  - `mei-tra-backend/src/services/game-event-log.service.ts` の `summarizeByRoomId()`
  - `mei-tra-backend/src/repositories/implementations/supabase-game-history.repository.ts`
- detail page:
  - `mei-tra-frontend/app/[locale]/game-history/[roomId]/page.tsx`
  - `mei-tra-backend/src/controllers/game-history.controller.ts`

ここで重要なのは、対局ログの詳細 read-side は `game_history` にありつつ、entrypoint は profile 側に移っていることです。そのため finished room を即削除せず、recent matches 用に一定期間保持する必要があります。

## 8. Supabase Storage の扱い

`20260111100000_create_avatars_bucket.sql` では public bucket `avatars` を作り、allowed mime types と policy を設定しています。

current `main` の backend upload path は `<userId>/avatar-<timestamp>.webp` です。つまり policy が想定している folder-based ownership と object key の形が一致しています。

ただし書き込み主体が backend である点は変わりません。backend は service role で storage を操作するため、最終的な実行権限は依然として特権的です。重要なのは、今は「権限モデルが特権的だから通る」だけでなく、「path 設計も policy の意図と揃っている」ことです。

## 9. repository 実装の役割分担

### 9.1 room repository

`SupabaseRoomRepository` は:

- room CRUD
- room players の追加 / 更新 / 削除
- old room 検索
- activity timestamp 更新

などを持ちます。RoomService が room lifecycle を持つのに対し、repository は DB との対応付けに専念します。

### 9.2 game state repository

主な機能:

- `create(roomId, gameState)`
- `findByRoomId(roomId)`
- `update(roomId, partialGameState)`
- `updatePlayers()`
- `updatePlayer()`
- `updateGamePhase()`

runtime service と最も密接にやり取りする repository です。

### 9.3 user profile repository

主な機能:

- `findById`, `findByUsername`
- `create`, `update`, `delete`
- `updateLastSeen`
- `updateGameStats`
- `findByUserIds`

profile は auth、chat、stats、settings が混ざるため、この repository は想像より横断的です。

### 9.4 chat repositories

chat room と chat message は domain entity ベースです。

- `ChatRoomId`, `UserId` など value object を持つ
- repository は row <-> domain の変換責務を持つ

ゲーム側より DDD っぽい表現が強いのが social layer の特徴です。

## 10. local Supabase の開発フロー

### 10.1 起動

backend 側には `npm run supabase:start` があり、実体は `scripts/start-local-supabase.sh` です。この script は:

- backend ルートへ移動
- `.env.development`, `.env.local` を source
- `supabase start`
- Mailpit URL を表示

を行います。

このため、local auth メール確認は `http://localhost:54324` が前提です。

### 10.2 テストユーザー作成

`scripts/create-test-users.sh` は local Supabase Admin API に対して 4 ユーザーを作ります。

- `example1@example.com` / `password`
- `example2@example.com` / `password`
- `example3@example.com` / `password`
- `example4@example.com` / `password`

service role key は local dev 用の既知値を script 内にハードコードしています。これはローカル用途の便利ツールであり、本番用 secret の扱いとは別物です。

### 10.3 migration 適用

通常は `supabase start` / `supabase db reset` / `supabase db push` を使います。runbook の詳細は `mei-tra-backend/SUPABASE_OPERATIONS.md` と `mei-tra-backend/SUPABASE_MIGRATION.md` にありますが、現行開発者向け導線としては:

1. `npm run supabase:start`
2. schema 変更時は `supabase db reset` か `supabase db push`
3. 必要なら `bash scripts/create-test-users.sh`

の理解で十分です。

## 11. frontend と backend の env 依存

### 11.1 frontend 側

確認できる主な `NEXT_PUBLIC_*` は次です。

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_BACKEND_URL`
- `NEXT_PUBLIC_SOCKET_URL`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_GA_ID`

frontend はこれらを:

- Supabase client
- metadata / robots / sitemap
- backend proxy
- social socket
- main socket

に使います。

### 11.2 backend 側

確認できる主な env は次です。

- `SUPABASE_URL_DEV`
- `SUPABASE_ANON_KEY_DEV`
- `SUPABASE_SERVICE_ROLE_KEY_DEV`
- `SUPABASE_URL_PROD`
- `SUPABASE_ANON_KEY_PROD`
- `SUPABASE_SERVICE_ROLE_KEY_PROD`
- `FRONTEND_URL_DEV`
- `FRONTEND_URL_PROD`
- `PORT`
- `NODE_ENV`
- `SENTRY_DSN`
- `FLY_API_TOKEN`（script / workflow 側）

Supabase config は `NODE_ENV === 'production'` かどうかで dev/prod を切り替えます。

## 12. テストとデータ層

frontend の `jest.setup.js` は Supabase URL と anon key をモックし、Socket.IO client も mock しています。つまり frontend unit test は real Supabase / real socket を前提にしていません。

backend 側は unit / e2e の両方を持ちますが、データ整合の観点では:

- repository mock で済む層
- 実際の local Supabase を起動して見るべき層

を分ける必要があります。profile upload, migration, reconnect 永続化のような領域は、unit test だけでは十分ではありません。

## 13. RLS と service role の関係

Supabase を使う project では RLS policy を見れば権限モデルが分かることが多いですが、この repo では backend が service role を使うため、少し事情が違います。

### 13.1 frontend から見た権限

frontend は anon key + user session で動くため、`user_profiles` の self update や public read のように RLS の影響を直接受けます。

### 13.2 backend から見た権限

backend は `SupabaseService` で service role key を使うため、room, game state, chat, avatar upload は特権的に実行されます。ただし profile write 系の HTTP endpoint は別途 `AuthGuard` で守られており、avatar upload / profile update は本人の bearer token を持つ request しか通しません。

### 13.3 実務上の意味

「policy は正しいのに backend 経由操作が通る」「policy と path が合っていないように見えるのに upload できる」といった現象は、この権限モデルを前提に見る必要があります。

## 14. データライフサイクル

永続化されたデータは無期限保持ではありません。現行実装には cleanup が複数あります。

### 14.1 game data

`20260111090000_add_cron_cleanup.sql` により、毎日 03:00 UTC に古い `game_history`, `game_states`, `room_players`, `rooms` が削除されます。

### 14.2 social chat

chat には二種類の cleanup が存在します。

- backend `ChatCleanupService` による毎時 cleanup
- migration 側 pg_cron による TTL cleanup

### 14.3 avatar

avatar は upload 時に旧ファイル削除を試みますが、削除失敗は warning に留めています。削除対象は file name の末尾ではなく storage object path 全体です。つまり storage 側は絶対に完全清掃される前提ではありませんが、少なくとも folder 付き object key を誤って切り詰めないようになっています。

## 15. 型ずれを防ぐための実践メモ

型共有が未整理な状態では、変更前に更新箇所 checklist を作るのが有効です。例として preference 項目追加時は次を同時に見る必要があります。

1. migration の default / backfill
2. backend `UserPreferences`
3. frontend `UserPreferences`
4. `normalizeUserPreferences()`
5. UI form
6. 必要なら profile refresh / `update-auth`

この順で見ないと、DB と UI の fallback が簡単にずれます。

## 16. 本番を意識したデータ変更の考え方

local で通っても、本番では次の問いが増えます。

- 既存 row への backfill が必要か
- numeric casting で失敗しないか
- pg_cron job 名が重複しないか
- storage bucket 作成が idempotent か
- service role env が揃っているか

DB 変更は SQL だけではなく、運用フローの一部として考える必要があります。

## 17. 既知の設計上の注意点

### 17.1 transport / UI / persistence を混同しない

`contracts/` を入れたことで wire 契約の source of truth は一本化されました。ただし、それで UI 型や DB row 型まで同一化したわけではありません。型を変えるときは:

- `contracts/` の transport 契約
- frontend UI type
- backend domain / persistence type
- migration / DB row shape

のどこを変えているかを意識する必要があります。

### 17.2 preferences の非対称性

前述の通り、`theme` は frontend と backend で完全には一致していません。新しい preference を追加するときは、先に「DB schema でどう持つか」を決め、その後に frontend fallback を揃えるのが安全です。

### 17.3 service role 前提の設計

backend が service role で DB / Storage を叩いているため、RLS policy だけ見て権限を議論するとずれる場面があります。特権操作がどこに集中しているかを意識する必要があります。

### 17.4 game state snapshot は便利だが fragile

JSONB snapshot は reconnect に強い一方で、shape drift に弱いです。field 名や nested structure を変えるときは migration だけでなく復元コードも確認してください。

## 18. 何を source of truth として更新すべきか

変更内容ごとに、まず更新すべき場所は異なります。

| 変更したいもの | 先に見るべき場所 |
| --- | --- |
| ログインやセッション | frontend `AuthContext`, backend `AuthService` |
| profile 項目追加 | `contracts/profile.ts`, migration, backend user types, frontend user types |
| game state のフィールド追加 | `contracts/game.ts`, backend `src/types/game.types.ts`, game state repository, frontend game types |
| chat message の項目追加 | `contracts/social.ts`, social migration, chat repository, frontend social types |
| avatar 処理変更 | backend controller, storage bucket assumptions, frontend proxy route |

## 19. この章で押さえるべきこと

- Supabase は Auth / DB / Storage の三役を担う
- frontend は auth client、backend は privileged persistence adapter である
- `user_profiles` がアプリの profile / stats / preferences の中心である
- room / game state / chat は別々の persistence 境界を持つ
- transport 契約は `contracts/`、UI 型は frontend、永続化型は backend / DB に分けて考える
- migration の歴史を見ると、認証、social、avatar、cleanup が後から積み上がっている

## 20. テーブルと bucket の早見表

最後に、現行実装で重要な保存先を一覧化しておきます。

| 保存先 | 主な内容 | 主に触るコード |
| --- | --- | --- |
| `auth.users` | 認証アカウント本体 | frontend auth, Supabase trigger |
| `user_profiles` | 表示名、avatar、統計、preferences | AuthContext, AuthService, UserProfileRepository |
| `rooms` | ルーム本体。finished room は recent matches 用に一定期間保持 | RoomRepository, RoomService |
| `room_players` | 座席、ready、team、socket/user 対応 | RoomRepository, RoomService |
| `game_states` | ゲーム進行 snapshot | GameStateRepository, GameStateService |
| `game_history` | action log / audit / replay 補助線 | `SupabaseGameHistoryRepository`, `GameEventLogService`, `GameHistoryController`, `GetUserRecentGameHistoryUseCase` |
| `chat_rooms` | chat room metadata | ChatRoomRepository, ChatService |
| `chat_members` | chat membership | migration / policy 前提 |
| `chat_messages` | message 本体 | ChatMessageRepository, ChatService |
| `storage.buckets.avatars` | avatar 画像 | UserProfileController, Supabase Storage |

## 21. データ変更時のおすすめ手順

実装者としては、データ変更を次の順で考えると事故が減ります。

1. まず DB で何を保存したいかを決める
2. wire に出すなら `contracts/` を決める
3. migration を書く
4. backend type / repository / service を更新する
5. frontend type / context / UI を更新する
6. local Supabase で reset して確認する
7. docs と runbook を必要に応じて更新する

この順序にしておくと、UI 先行で作って永続化が追いつかない、あるいは migration だけ入って runtime shape が壊れる、という事故を減らせます。

変更種別ごとの補足も置いておきます。

- profile 項目追加:
  - `user_profiles` migration
  - backend `UserProfile` / repository
  - frontend `AuthContext` / profile form
- chat message 項目追加:
  - chat migration
  - `ChatMessageRepository`
  - social event 型
  - frontend social UI
- game state 項目追加:
  - backend game type
  - `SupabaseGameStateRepository`
  - reconnect 復元経路
  - frontend game state type

特に game state は JSONB snapshot を跨ぐため、DB と TypeScript を両方直しただけでは不十分です。再接続時に復元できるか、部分 update が壊れないかまで確認して初めて完了と考えるべきです。

## 22. 次に読む章

ここまでで認証と永続化の境界が見えたら、最後に開発手順と運用フローを確認してください。

- 起動、テスト、deploy、health、runbook の関係を見る: [06-dev-ops-and-quality.md](./06-dev-ops-and-quality.md)
