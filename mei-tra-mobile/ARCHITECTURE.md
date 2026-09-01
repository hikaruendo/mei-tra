# Mobile App Architecture (Expo / React Native)

本ドキュメントでは、モバイルアプリ (`mei-tra-mobile/`) のアーキテクチャを説明する。
バックエンド・DB・Web フロントエンドの全体アーキテクチャは [ARCHITECTURE.md](../ARCHITECTURE.md) を参照。

---

## 設計方針

Web 版 (Next.js) はゲーム状態を `useGame` / `useRoom` / `useSocket` の 3 hooks に分散しているが、
モバイル版は **GameContext に一本化** する方針を採った。理由:

- バックグラウンド復帰・ネットワーク切断・Push deep-link など、モバイル固有のライフサイクルイベントが多く、
  分散した hooks 間で状態の整合性を保つコストが高い
- `useReducer` による単一の state tree + 単一の Socket.IO 接続で、resync flight を一箇所に集約できる
- Expo Router の画面遷移と Context の provider 境界が一致するため、props drilling が不要

---

## Provider Tree

```
SafeAreaProvider
  ThemeProvider (dark navigation theme)
    LocaleProvider            ← 表示言語の設定 (端末設定 / ja / en)
      AuthProvider            ← Supabase 認証・セッション管理
        GameProvider          ← Socket.IO (/) + ゲーム状態 + ルーム管理
          SocialProvider      ← Socket.IO (/social) + チャット
            NotificationProvider  ← Push 通知登録 + deep-link ルーティング
              Stack (expo-router, locale を key にする)
```

依存方向は上から下のみ。`NotificationProvider` は `useAuth()` と `useGame()` の両方に依存する
(Push 通知タップ → `resumeRoom()` でゲームに復帰するため)。

`LocaleProvider` は何にも依存しないので最上位に置く。保存済みの選択を読み終えるまで
`null` を返すため、起動直後に端末の言語が一瞬見えることはない。

`t()` は React 外からも使える素の関数で、言語を変えても画面は自動では再描画されない。
そのため `Stack` に `key={locale}` を付けて画面ツリーだけを作り直す。プロバイダは
その上にあるので、ソケット接続とゲーム状態は維持される。

---

## ディレクトリ構成

```
src/
├── app/                          ← Expo Router ページ
│   ├── _layout.tsx               ← Provider tree + Stack navigation
│   ├── index.tsx                 ← エントリ: /rooms or /sign-in にリダイレクト
│   ├── sign-in.tsx               ← サインイン / サインアップ
│   ├── rooms.tsx                 ← ルーム一覧・作成・参加・観戦
│   ├── settings/                 ← プロフィールハブと各設定画面
│   │   ├── index.tsx             ← プロフィール概要・対局履歴・設定導線
│   │   ├── profile.tsx           ← 表示名・アバター編集
│   │   ├── preferences.tsx       ← 対局演出・言語
│   │   ├── help.tsx              ← 規約・プライバシー・問い合わせ
│   │   └── account.tsx           ← ログアウト・アカウント削除
│   ├── game-history/             ← 対局履歴一覧・詳細
│   ├── auth/callback.tsx         ← OAuth コールバック (deep link)
│   └── room/[roomId].tsx         ← WaitingRoom or GameBoard (動的ルート)
│
├── context/                      ← グローバル状態管理 (React Context)
│   ├── AuthContext.tsx            ← 認証状態・セッション・プロフィール
│   ├── GameContext.tsx            ← ゲーム状態 reducer + Socket.IO (/)
│   ├── SocialContext.tsx          ← チャット Socket.IO (/social)
│   └── NotificationContext.tsx    ← Push 通知・deep-link
│
├── components/
│   ├── game/                     ← ゲーム UI コンポーネント
│   │   ├── GameBoard.tsx          ← メインゲーム画面
│   │   ├── WaitingRoom.tsx        ← 待機画面
│   │   ├── BlowControls.tsx       ← 吹きフェーズ UI
│   │   ├── PlayerSeat.tsx         ← プレイヤー座席カード
│   │   ├── PlayingCard.tsx        ← カード描画 (regular / compact / mini)
│   │   ├── ScoreBoard.tsx         ← スコアボード
│   │   └── GameHistory.tsx        ← 対局ログビューア
│   ├── social/
│   │   └── ChatPanel.tsx          ← チャット UI
│   └── ui/                       ← 汎用 UI コンポーネント
│       ├── Button.tsx             ← ボタン (primary / secondary / ghost / danger)
│       ├── Screen.tsx             ← SafeAreaView + KeyboardAvoidingView wrapper
│       ├── BrandHeader.tsx        ← アプリロゴヘッダー
│       ├── ConnectionBanner.tsx   ← 接続ステータス表示
│       └── FeedbackBanner.tsx     ← エラー / 通知バナー
│
├── hooks/
│   └── useGameHistory.ts          ← 対局ログ取得 (REST API)
│
├── lib/                          ← ユーティリティ・API クライアント
│   ├── supabase.ts               ← Supabase クライアント初期化
│   ├── secure-storage.ts         ← AES-256 暗号化ストレージ
│   ├── auth-session.ts           ← トークンリフレッシュ・OAuth 補完
│   ├── session-cleanup.ts        ← サインアウト / 削除時のクリーンアップ
│   ├── app-lifecycle.ts          ← AppState + NetInfo リスナー
│   ├── config.ts                 ← 環境変数 (supabaseUrl, backendUrl)
│   ├── realtime.ts               ← MobileSocket 型 + emitWithAck ヘルパー
│   ├── room-storage.ts           ← AsyncStorage ルーム復帰記録 (24h TTL)
│   ├── game-state.ts             ← スナップショット正規化・プレイヤーマージ
│   ├── cards.ts                  ← カード解析 + プレイ可否判定
│   ├── table-order.ts            ← 座席回転 (自分を下に配置)
│   ├── trump-display.ts          ← トランプ強さ順ラベル
│   ├── profile-api.ts            ← プロフィール更新 / アバターアップロード
│   ├── game-history-api.ts       ← 対局ログ取得 API
│   ├── account-api.ts            ← アカウント削除 API
│   ├── notifications.ts          ← Push トークン登録 / 解除
│   └── notification-platform.ts  ← プラットフォーム抽象化 (.native.ts 実装)
│
├── theme/
│   └── colors.ts                 ← カラーパレット (深緑 / 金 / 象牙)
│
└── types/
    ├── auth.ts                   ← MobileAuthUser, MobileUserProfile
    └── game.ts                   ← MobileGameSnapshot
```

---

## レイヤー構成

```
┌────────────────────────────────────────────────────────────┐
│                    Presentation Layer                       │
│  app/*.tsx (Expo Router pages)                             │
│  components/**/*.tsx                                       │
│  theme/colors.ts                                           │
└────────────────────────────────────────────────────────────┘
                            ▼
┌────────────────────────────────────────────────────────────┐
│                  State Management Layer                     │
│  context/GameContext.tsx    ← useReducer + Socket.IO (/)   │
│  context/AuthContext.tsx    ← Supabase Auth 状態           │
│  context/SocialContext.tsx  ← Socket.IO (/social)          │
│  context/NotificationContext.tsx ← Push 通知               │
│  hooks/useGameHistory.ts                                   │
└────────────────────────────────────────────────────────────┘
                            ▼
┌────────────────────────────────────────────────────────────┐
│                   Communication Layer                      │
│  lib/realtime.ts       ← Socket.IO typed client            │
│  lib/supabase.ts       ← Supabase client                   │
│  lib/profile-api.ts    ← REST API calls                    │
│  lib/notifications.ts  ← Push token REST API               │
└────────────────────────────────────────────────────────────┘
                            ▼
┌────────────────────────────────────────────────────────────┐
│                    Platform Layer                           │
│  lib/secure-storage.ts     ← AES-256 暗号化               │
│  lib/app-lifecycle.ts      ← AppState / NetInfo            │
│  lib/room-storage.ts       ← AsyncStorage 永続化           │
│  lib/notification-platform.native.ts ← expo-notifications  │
└────────────────────────────────────────────────────────────┘
```

---

## GameContext 詳細

ゲーム全体の状態を単一の `useReducer` で管理する。
Web 版の `useGame` + `useRoom` + `useSocket` の 3 hooks を 1 つに集約。

### State Shape

```typescript
interface MobileState {
  rooms: RoomContract[];                // ルーム一覧
  currentRoom: RoomContract | null;     // 参加中のルーム
  game: MobileGameSnapshot | null;      // ゲーム進行状態
  connectionStatus: ConnectionStatus;   // disconnected | connecting | resyncing | connected
  error: string | null;                 // エラーメッセージ
  notice: string | null;                // 通知メッセージ
  gameResult: GameResultSnapshot | null; // ルーム破棄後も保持する最終結果
}
```

### MobileGameSnapshot

```typescript
interface MobileGameSnapshot {
  roomId: string;
  players: PlayerContract[];
  gamePhase: TransportGamePhase;        // 'waiting' | 'blow' | 'play' | null
  currentField: FieldContract | null;
  currentTurnSeatId: SeatId | null;
  blowState: BlowStateContract;
  teamScores: TransportTeamScores;
  youSeatId: SeatId | null;
  isSpectator: boolean;
  negriCard: string | null;
  negriSeatId: SeatId | null;
  revealedAgari: string | null;
  fields: CompletedFieldContract[];     // 完了した場 (取得セット)
  hostSeatId: SeatId | null;
  pointsToWin: number;
  paused: boolean;
  disconnectedSeatIds: SeatId[];
  idleSeatIds: SeatId[];
  teamNames?: TeamNames;
}
```

### Reducer Actions

| Action | 用途 |
|--------|------|
| `connection` | 接続ステータス変更 |
| `rooms` | ルーム一覧更新 |
| `room` | 現在のルーム設定 |
| `roomUpdated` | 単一ルーム更新 |
| `game` | ゲームスナップショット全体設定 |
| `patchGame` | ゲーム状態の部分更新 |
| `players` | プレイヤーリスト更新 |
| `playerDisconnected` | 切断プレイヤー追加 |
| `playerIdle` | 無操作プレイヤー追加 |
| `playerIdleCleared` | 無操作解除 |
| `playerConvertedToCom` | COM 置換 |
| `error` | エラーメッセージ設定 |
| `notice` | 通知メッセージ設定 |
| `gameResult` | ライブ `game-over` から生成した最終結果設定 |
| `finishRoom` | 最終結果を保持したままルーム状態を破棄 |
| `resetRoom` | ルーム状態リセット |

### 公開される関数 (via `useGame()`)

**ルーム操作**: `refreshRooms`, `createRoom`, `joinRoom`, `watchRoom`, `leaveRoom`, `leaveWatch`, `resumeRoom`

**待機画面操作**: `toggleReady`, `fillWithCOM`, `shuffleTeams`, `startGame`, `updateTeamNames`

**ゲーム操作**: `declareBlow`, `passBlow`, `selectNegri`, `playCard`, `selectBaseSuit`

**ホスト操作**: `removePlayer`, `replaceWithCOM`

**その他**: `clearFeedback`, `closeGameOver`

---

## Resync Flight (再接続メカニズム)

モバイル固有の課題 (バックグラウンド復帰、ネットワーク切替) に対応するための仕組み。

```
App foreground / Socket reconnect / resumeRoom()
         │
         ▼
  ┌─ ResyncFlight 生成 ─┐
  │  状態: resyncing     │
  │  timeout: 10秒       │
  └──────────────────────┘
         │
    emit('list-rooms')
    emit('sync-game-state')
         │
         ▼
  ┌─ Server 応答 ────────┐
  │  'rooms-list' 受信    │
  │  'room-sync' 受信     │
  │  'game-state' 受信    │
  └──────────────────────┘
         │
         ▼
  ┌─ Flight 完了 ────────┐
  │  状態: connected      │
  │  UI 更新              │
  └──────────────────────┘
```

同時に複数の flight が走らないよう、request-coalescing で制御。

---

## 認証フロー

```
                    ┌────────────────────┐
                    │   アプリ起動        │
                    └────────┬───────────┘
                             ▼
                    ┌────────────────────┐
                    │ SecureStore から    │
                    │ セッション復元      │
                    │ (AES-256 復号)     │
                    └────────┬───────────┘
                             ▼
                   ┌──── 有効? ────┐
                   │               │
                  Yes              No
                   │               │
                   ▼               ▼
            ┌────────────┐  ┌────────────┐
            │ /rooms へ   │  │ /sign-in へ │
            └────────────┘  └──────┬─────┘
                                   │
                        ┌──────────┴──────────┐
                        │                     │
                   Email/Pass           Google OAuth
                        │                     │
                        ▼                     ▼
               signInWithPassword    signInWithOAuth
                        │             + WebBrowser
                        │             + exchangeCode
                        ▼                     │
                   ┌──────────────────────────┘
                   │
                   ▼
            ┌────────────────────┐
            │ user_profiles 取得  │
            │ (display_name,     │
            │  avatar_url)       │
            └────────┬───────────┘
                     ▼
            ┌────────────────────┐
            │ Push トークン登録   │
            │ Socket 接続開始     │
            └────────────────────┘
```

### トークンリフレッシュ

- `expires_at` の 60 秒前にプロアクティブにリフレッシュ
- App foreground 復帰時・ネットワーク復旧時にも実行
- 重複リフレッシュ防止 (single inflight promise)
- ネイティブ: `supabase.auth.startAutoRefresh()` / `stopAutoRefresh()` を AppState に連動

### セキュアストレージ (LargeSecureStore)

Supabase セッションは SecureStore の 2KB 制限を超えるため、独自の暗号化レイヤーを実装:

```
┌──────────────────┐     ┌────────────────────────┐
│  SecureStore     │     │  AsyncStorage           │
│  (2KB 制限)      │     │  (制限なし)              │
│                  │     │                          │
│  AES-256 鍵     │────▶│  暗号化されたセッション   │
│  (32 bytes)      │     │  (Base64 ciphertext)    │
└──────────────────┘     └────────────────────────┘
```

---

## Push 通知フロー

```
┌── NotificationProvider マウント ──┐
│                                    │
│  user && session が揃ったら        │
│  (1 user ID につき 1 回)          │
│                                    │
└────────────┬───────────────────────┘
             │
             ▼
    ┌────────────────────┐
    │ 1. Permission 要求  │
    │    (iOS: dialog,   │
    │     Android: auto) │
    └────────┬───────────┘
             ▼
    ┌────────────────────┐
    │ 2. Expo Push Token │
    │    取得             │
    └────────┬───────────┘
             ▼
    ┌────────────────────┐
    │ 3. POST /api/      │
    │    push-tokens      │
    │    (Bearer token)  │
    └────────┬───────────┘
             ▼
    ┌────────────────────┐
    │ 4. AsyncStorage に │
    │    登録記録保存      │
    └────────────────────┘

─── 通知タップ時 ───

    ┌────────────────────┐
    │ 通知 data から      │
    │ roomId 抽出         │
    └────────┬───────────┘
             ▼
    ┌────────────────────┐
    │ resumeRoom(roomId)  │
    │ → router.push(      │
    │   '/room/[roomId]') │
    └────────────────────┘
```

---

## Socket.IO イベントマップ

### Game namespace (`/`)

**受信 (Server → Client)**:

| Event | 用途 |
|-------|------|
| `rooms-list` | ルーム一覧 |
| `room-sync` | ルーム状態同期 |
| `set-room-id` | ルーム ID 永続化 |
| `game-player-joined` | プレイヤー参加通知 |
| `update-players` | プレイヤーリスト更新 |
| `game-state` | フルゲーム状態スナップショット |
| `reconnect-token` | 再接続トークン |
| `game-started` | ゲーム開始 |
| `update-phase` | フェーズ遷移 |
| `update-turn` | ターン更新 |
| `blow-updated` | 吹き宣言更新 |
| `broken` | 手札崩れ |
| `round-cancelled` | ラウンドキャンセル (全パス) |
| `reveal-agari` | アゲカード公開 |
| `play-setup-complete` | ネグリ選択完了 |
| `card-played` | カードプレイ |
| `field-updated` | 場更新 |
| `field-complete` | 場完了 |
| `round-results` | ラウンド結果 |
| `new-round-started` | 新ラウンド開始 |
| `game-over` | ゲーム終了 |
| `game-paused` / `game-resumed` | 一時停止 |
| `player-disconnected` / `player-idle` | プレイヤー状態 |
| `back-to-lobby` | ロビー復帰 |
| `error-message` | エラー |
| `turn-ping` | ターン確認 |

**送信 (Client → Server)**:

| Event | Ack | 用途 |
|-------|-----|------|
| `update-auth` | No | JWT 更新通知 |
| `list-rooms` | No | ルーム一覧要求 |
| `sync-game-state` | No | ゲーム状態要求 |
| `turn-ack` | No | ターン受信確認 |
| `create-room` | Yes | ルーム作成 |
| `join-room` | Yes | ルーム参加 |
| `leave-room` | Yes | ルーム退出 |
| `toggle-player-ready` | Yes | レディ切替 |
| `fill-with-com` | Yes | COM 補充 |
| `shuffle-teams` | Yes | チームシャッフル |
| `start-game` | Yes | ゲーム開始 |
| `declare-blow` | No | 吹き宣言 |
| `pass-blow` | No | パス |
| `select-negri` | No | ネグリ選択 |
| `play-card` | No | カードプレイ |
| `select-base-suit` | No | 台札スート選択 |
| `moderate-player` | Yes | プレイヤー管理 |
| `update-team-names` | No | チーム名更新 |

### Social namespace (`/social`) — 5 受信 / 5 送信

| Direction | Event | 用途 |
|-----------|-------|------|
| 受信 | `chat:message` | メッセージ受信 |
| 受信 | `chat:messages` | メッセージ一覧 |
| 受信 | `chat:typing` | タイピング通知 |
| 送信 | `chat:join-room` | チャットルーム参加 |
| 送信 | `chat:leave-room` | チャットルーム退出 |
| 送信 | `chat:post-message` | メッセージ送信 |
| 送信 | `chat:typing` | タイピング通知 |
| 送信 | `chat:list-messages` | メッセージ履歴要求 |

---

## Web 版との対応関係

### Pages

| Mobile | Web | 備考 |
|--------|-----|------|
| `app/_layout.tsx` | `app/layout.tsx` | |
| `app/room/[roomId].tsx` | `app/[locale]/page.tsx` | Web はルーム別ページなし |
| `app/rooms.tsx` | `app/[locale]/rooms/page.tsx` | |
| `app/settings/*` | `app/[locale]/profile/page.tsx` | Mobile は設定とアカウント管理を分割 |
| `app/sign-in.tsx` | `components/auth/AuthModal.tsx` | Web はモーダル |

### Game Components

| Mobile | Web | 備考 |
|--------|-----|------|
| `GameBoard.tsx` | `GameTable/index.tsx` | |
| `WaitingRoom.tsx` | `PreGameTable/index.tsx` | |
| `BlowControls.tsx` | `BlowControls/index.tsx` | |
| `PlayerSeat.tsx` | `PlayerIdentityChip/` + `PlayerAvatar/` | Web は 2 コンポーネントに分離 |
| `PlayingCard.tsx` | `Card/` + `CardFace/` | Web は SVG 描画 |
| `ScoreBoard.tsx` | `ScoreBoard/index.tsx` | |
| `ChatPanel.tsx` | `ChatDock.tsx` + `ChatComposer.tsx` + `ChatMessage.tsx` | Web は 3 分割 |

### State Management (最大の構造差異)

| Mobile | Web | 備考 |
|--------|-----|------|
| `GameContext.tsx` (1 file) | `useGame.ts` + `useRoom.ts` + `useSocket.ts` (3 files) | Mobile は集約、Web は分散 |
| `SocialContext.tsx` | `SocialSocketContext.tsx` + `useSocialSocket.ts` | |
| `AuthContext.tsx` | `AuthContext.tsx` | ほぼ同構造 |

### Lib

| Mobile | Web | 備考 |
|--------|-----|------|
| `lib/supabase.ts` | `lib/supabase.ts` | Mobile: `createClient`, Web: `createBrowserClient` |
| `lib/table-order.ts` | `lib/utils/tableOrder.ts` | 同一ロジック |
| `lib/trump-display.ts` | `lib/utils/trumpDisplay.ts` | 同一ロジック |
| `lib/cards.ts` | `lib/utils/cardMapping.ts` | 共に `@meitra/game-client` に委譲 |
| `lib/realtime.ts` | `app/socket.ts` | |
| `lib/profile-api.ts` | `lib/api/user-profile.ts` | |
| `lib/secure-storage.ts` | — | Mobile 専用 |
| `lib/app-lifecycle.ts` | — | Mobile 専用 |
| `lib/notifications.ts` | — | Mobile 専用 |

### Theme

| Mobile | Web | 備考 |
|--------|-----|------|
| `theme/colors.ts` (JS object) | `styles/base/variables.scss` (CSS 変数 `--mt-*`) | 同じカラーパレット、異なるフォーマット |

---

## 共有パッケージ

```
contracts/               ← Mobile / Web / Backend 共有
├── game.ts              ← PlayerContract, FieldContract, BlowState, TeamNames 等
├── socket.ts            ← ServerToClientEvents, ClientToServerEvents 型定義
├── push.ts              ← Push 通知ペイロード型
└── game-history.ts      ← GameHistoryReplayViewContract, Summary 型

shared/game-client/       ← Mobile / Web 共有
└── src/card-validation.ts ← カードプレイ可否判定ロジック

shared/api-client/        ← Mobile / Web 共有 REST client
└── profile.ts            ← profile URL・認証header・HTTP error・retry
```

---

## データフロー例: カードをプレイする

```
Mobile App                          Backend                    Database
──────────                          ───────                    ────────

1. ユーザーがカードファンでカード選択
   → selectedCard state 更新
   → 「プレイ」ボタン表示

2. 「プレイ」ボタンタップ
   → Haptics.impactAsync()
   → pendingAction = 'card'

3. GameContext.playCard(card)
   → socket.emit('play-card', { roomId, card })
                                    │
                                    ▼
                              4. GameGateway.handlePlayCard()
                                    │
                                    ▼
                              5. PlayCardUseCase.execute()
                                    ├── 手札・ターン・場の検証
                                    ├── hand / field 更新
                                    ├── GameEventLog 記録 ──────▶ INSERT game_history
                                    └── state 永続化 ───────────▶ UPDATE game_states

                              6. GatewayEvent[] を配信
                                    │
   ◀────────────────────────────────┘
7. 'card-played' イベント受信
   → dispatch({ type: 'patchGame', ... })
   → UI 再レンダリング
   → pendingAction = null
```

---

## モバイル固有の考慮事項

### バックグラウンド復帰

`app-lifecycle.ts` が `AppState` の `active` / `background` 遷移を監視。
foreground 復帰時に:
1. `getAccessToken()` でトークン有効性を確認 (必要なら refresh)
2. `socket.connect()` (切断されていた場合)
3. Resync flight で `list-rooms` + `sync-game-state` を発行
4. `supabase.auth.startAutoRefresh()` を再開

### ネットワーク切替

`NetInfo` が接続状態を監視。オフライン→オンライン復帰時に:
1. `getAccessToken()` + `socket.connect()` でリカバリ
2. Resync flight で状態再同期

### 画面ロック防止

`room/[roomId].tsx` で `expo-keep-awake` を使用。ゲーム中は画面が消えない。

### React Compiler

`app.json` の `experiments.reactCompiler: true` (Expo 55) で有効化。
手動の `useMemo` / `useCallback` は依然として使用しているが、コンパイラが追加の最適化を行う。
