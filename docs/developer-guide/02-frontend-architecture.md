# 02. Frontend Architecture

この章では、`mei-tra-frontend/` が現行システムの中でどのような責務を持ち、どういう単位で分割されているかを整理します。対象は Next.js App Router の一般論ではなく、「明専トランプの frontend は何をどこでやっているか」です。

この frontend は、単なる Socket.IO client ではありません。現在の `main` では、次の役割を同時に担っています。

- 公開サイトとしての landing / SEO / robots / sitemap
- 認証済みアプリとしての session 管理
- 対戦ゲーム UI
- ルーム一覧と待機室の UI
- プロフィール編集 UI
- ルール白書 / docs UI
- メインゲーム socket と social socket の接続管理
- backend health の監視
- backend REST への proxy route

したがって、frontend を読むときは「画面コンポーネント」「state hooks」「provider」「App Router」の四層に分けて見ると迷いにくくなります。

## 1. frontend 全体の責務

backend がゲームロジックの source of truth だとしても、frontend 側の責務は軽くありません。現行実装では、frontend は少なくとも以下を担当しています。

### 1.1 プレゼンテーション

- ルーム一覧
- 待機室
- ゲーム卓
- チャット dock
- プロフィール画面
- チュートリアル / docs
- 認証モーダル
- 法的ページ

### 1.2 クライアント状態

- 認証セッション
- ユーザープロフィールのキャッシュ
- メイン socket 接続状態
- social socket 接続状態
- ルーム一覧と現在ルーム
- ゲーム中の表示 state
- テーマ、文字サイズ、言語
- backend 起動状況

### 1.3 ルーティングと公開サイト機能

- locale-aware route
- metadata / Open Graph / Twitter Card
- JSON-LD
- `robots.ts` / `sitemap.ts`
- `.vercel.app` preview への noindex 対応

### 1.4 backend との通信

- Socket.IO のメイン namespace
- Socket.IO の `/social` namespace
- Next.js rewrite による `/api/*` の backend proxy
- avatar upload の API route
- backend health polling

## 2. ディレクトリの見方

frontend の主要ディレクトリは次の通りです。

| パス | 役割 |
| --- | --- |
| `app/` | App Router の route entry |
| `components/` | UI コンポーネント群 |
| `hooks/` | frontend 側の状態管理と通信ロジック |
| `contexts/` | auth / social socket の provider |
| `types/` | frontend が扱う型 |
| `lib/` | Supabase client、preference、UI 補助 util |
| `i18n/` | `next-intl` 設定 |
| `messages/` | ローカライズ文言 |
| `__tests__/` | Jest テスト |
| `playwright/` | E2E テスト |

この構成を見るうえで重要なのは、コンポーネントの大半が状態を持たず、状態と通信は `hooks/` と `contexts/` に寄っていることです。

## 3. App Router と provider 構成

frontend の root は `app/layout.tsx` です。ここでは次を行います。

- `globals.scss` の読み込み
- font 設定
- localStorage に保存された theme / font size の bootstrap script
- optional な Google Analytics 読み込み
- `AuthProvider`
- `SocialSocketProvider`

この順番は重要です。`AuthProvider` が session と user を供給し、その結果を `SocialSocketProvider` が使って `/social` へ接続します。social socket は認証必須なので、provider の順番が逆だと成立しません。

### 3.1 provider tree の見方

ルート provider tree を簡略化すると、次のようになります。

```text
RootLayout
  └─ AuthProvider
      └─ SocialSocketProvider
          └─ locale layout / page tree
```

メインゲーム用 socket には専用 context はなく、`useSocket()` がグローバル singleton socket を参照する構造です。一方、social socket は React context でラップされています。ここが二つの接続の設計差です。

### 3.2 locale layout

`app/[locale]/layout.tsx` は `next-intl` の `NextIntlClientProvider` を設置し、locale ごとの metadata と JSON-LD を出します。ここでは次を担います。

- `ja` / `en` の判定
- 不正 locale の `notFound()`
- locale ごとの title / description / keywords
- canonical / alternate language 設定
- FAQ ではなく WebApplication / Organization の JSON-LD

つまり、locale layout は見た目ではなく「公開サイトとしての多言語メタ情報」の責務を持っています。

## 4. route tree の実態

App Router の主要 route は次の通りです。

| route | 役割 |
| --- | --- |
| `/` または `/{locale}` | サインイン前は landing、サインイン後はロビー / ゲーム卓 |
| `/{locale}/rooms` | ルーム一覧の専用ページ |
| `/{locale}/profile` | プロフィール画面 |
| `/{locale}/game-history/[roomId]` | 対局ログの replay / audit 詳細ページ |
| `/{locale}/docs` | プレイヤー向けルール白書 |
| `/{locale}/tutorial` | `docs` への redirect |
| `/{locale}/auth/callback` | 認証コールバック処理 |
| `/{locale}/auth/reset-password` | パスワード再設定 |
| `/{locale}/privacy` / `terms` | 法的ページ |
| `/api/backend-status` | backend health の proxy route |
| `/api/user-profile/[id]` | profile read / write の proxy route |
| `/api/user-profile/[id]/avatar` | avatar upload の proxy route |
| `/api/user-profile/[id]/game-history` | 自分の最近の完了対局一覧の proxy route |

この構成から分かることは、frontend が「ゲーム画面一枚」ではなく、アプリ本体と公開ページ群を一体化して持っているということです。

この章では filesystem 上の説明として `app/[locale]/...` という表記を使います。これは App Router の dynamic segment を指す略記で、実際の URL は `localePrefix: 'as-needed'` の設定に従って日本語では `/...`、英語では `/en/...` になります。

## 5. i18n と公開サイト機能

### 5.1 `next-intl` の設定

`i18n/routing.ts` では `locales: ['ja', 'en']`、`defaultLocale: 'ja'`、`localePrefix: 'as-needed'` が定義されています。つまり、既定の日本語では URL に locale prefix を強制せず、英語では `/en/...` を使う構成です。

`i18n/request.ts` は `requestLocale` を解決して `messages/${locale}.json` を読み込みます。invalid locale は default locale に寄せます。

### 5.2 文言ファイル

`messages/ja.json` と `messages/en.json` には、ゲーム UI だけでなく次のカテゴリが入っています。

- `auth`
- `game`
- `room`
- `landing`
- `profile`
- `tutorial`
- `nav`
- `chatDock`

このことから、i18n は一部 UI のみではなく、サイト全体の横断 concern です。

### 5.3 SEO / metadata

frontend 側には以下があります。

- `app/[locale]/layout.tsx`: locale-aware metadata と JSON-LD
- `app/robots.ts`: `NEXT_PUBLIC_SITE_URL` ベースの robots
- `app/sitemap.ts`: sitemap 生成
- `middleware.ts`: preview host に `X-Robots-Tag: noindex` を付与

preview deployment を index させない設計まで入っているため、frontend を変更するときは「公開ページとしての振る舞い」を意識する必要があります。

## 6. 認証アーキテクチャ

frontend の認証は `AuthContext` が中心です。`useAuth.ts` はほぼこの context への薄い facade です。

### 6.1 `AuthContext` の責務

`contexts/AuthContext.tsx` は、次を一手に引き受けます。

- Supabase session の取得
- current user の保持
- user profile の取得と refresh
- profile キャッシュの利用
- theme / font size preference の適用
- sign up / sign in / sign out
- access token の提供
- socket 切断を含む client auth state のクリア

つまり、AuthContext は単なる auth status provider ではなく、ユーザー設定と profile hydration も束ねています。

### 6.2 profile の読み込み戦略

`AuthContext` の `loadUserProfile()` には次の特徴があります。

- 同一 user の重複読込を防ぐ
- sessionStorage に 5 分キャッシュする
- background refresh を行う
- timeout と retry を持つ
- `user_profiles` が見つからない場合は「新規 user としてあり得る」ケースを許容する

このため、UI 側は `user` が取れた瞬間に backend API を叩き直すのではなく、まず context の提供する profile を使う設計です。

### 6.3 `ProtectedRoute`

ページ単位のアクセス制御は `components/auth/ProtectedRoute.tsx` で行われます。ここでは `requireAuth={true}` を渡すページと `false` のページがあり、`docs` は後者です。

現行構成では、

- ホーム / rooms / profile は実質 authenticated app
- docs / tutorial 系は未ログインでも読める

という線引きです。

### 6.4 認証 callback と reset password

`app/[locale]/auth/callback/route.ts` は、Supabase から返る authorization code を server-side で `exchangeCodeForSession()` し、そのまま locale-aware なトップへ redirect します。`app/[locale]/auth/reset-password/page.tsx` は password recovery 後の UI を担当します。

つまり current frontend は、

- callback: route handler で session cookie を確定する
- reset password: page で UI を出す

という分担です。以前の client page ベース callback より、session 交換の責務が明確です。

## 7. 通信モデル: メイン socket と social socket

frontend の通信で先に押さえるべき点は、socket が二系統あることです。

### 7.1 メインゲーム socket

`app/socket.ts` が singleton の `Socket` を管理し、`getSocket()`, `reconnectSocket()`, `disconnectSocket()` を提供します。`useSocket()` はそれを React hook 化したものです。

この接続の特徴:

- `auth` callback で毎回 `sessionStorage.roomId` を送る
- Safari / iOS を判定して transport 優先順を変える
- reconnection を前提にしている
- room 再参加のために `roomId` を connection handshake に含める
- token は `useAuth().getAccessToken()` から取得する

`roomId` を sessionStorage に持たせて再接続時 handshake に含める設計は、backend 再起動後でも socket.io room に戻りやすくするための実装です。これがあるため、frontend の room state と socket lifecycle は疎結合ではありません。

### 7.2 `useSocket()`

`useSocket()` は次を担当します。

- auth loading 完了後まで接続を待つ
- token を取得して初回接続する
- connect / disconnect / reconnect を state 化する
- `isConnected` と `isConnecting` を UI が参照できるようにする

この hook は socket 自体のイベント payload を解釈しません。イベント payload の解釈は `useGame()` や `useRoom()` に分けています。

### 7.3 social socket

`contexts/SocialSocketContext.tsx` は `/social` namespace 用の socket を持ちます。こちらは `user?.id` がないと接続しません。token は `getAccessToken()` から取得し、`auth: { token }` を付けて namespace 接続します。

主な特徴:

- namespace は `${BACKEND_URL}/social`
- reconnect attempt は 5 回
- game socket とは別 lifecycle

social 系は React context を通して `useSocialSocketContext()` から参照されます。つまり、メイン socket は global singleton + hook、social socket は provider + context という設計差があります。

## 8. hooks ごとの責務分割

frontend の理解で先に見るべきなのは、`hooks/` の責務の切り方です。

### 8.1 `useGame()`

`useGame()` は、ゲーム卓とゲーム進行に関する state 集約 hook です。保持しているものは多く、実質的にゲーム UI の state coordinator です。

主な state:

- `players`
- `gameStarted`
- `gamePhase`
- `whoseTurn`
- `teamScores`
- `blowDeclarations`
- `currentHighestDeclaration`
- `selectedTrump`
- `numberOfPairs`
- `currentField`
- `currentTrump`
- `negriCard`
- `completedFields`
- `currentRoomId`
- `currentPlayerId`
- `isHost`
- `idlePlayerIds`
- `paused`
- `users`

主な responsibilities:

- サーバーイベントを UI state に投影する
- game start / blow / play / game over の表示切替
- room bootstrap 時の再接続制御
- notification や game over modal の制御
- `declare-blow`, `pass-blow`, `play-card`, `select-negri` などの action 送信
- idle / COM 置換 / pause-resume の反映

`useGame()` が受けているイベントはかなり多く、少なくとも次が重要です。

- `game-state`
- `game-player-joined`
- `game-started`
- `update-phase`
- `update-turn`
- `blow-updated`
- `card-played`
- `field-updated`
- `field-complete`
- `round-results`
- `new-round-started`
- `game-over`
- `game-paused`
- `game-resumed`
- `player-idle`
- `player-converted-to-com`
- `back-to-lobby`

この hook を見ると、frontend がゲームロジック本体ではない一方、表示状態の集約点として非常に重要であることが分かります。

### 8.2 `useRoom()`

`useRoom()` はロビー / 待機室の state を担当します。ゲーム進行そのものではなく、「ルームへの参加と waiting room の操作」が担当範囲です。

主な responsibilities:

- `list-rooms` の発火
- `rooms-list` の反映
- current room の追跡
- `createRoom()`
- `joinRoom()`
- `leaveRoom()`
- `toggleReady()`
- `startGame()`
- `fillWithCOM()`
- `changePlayerTeam()`

また、room update のたびに `sessionStorage.roomId` と current room を同期し、一覧と現在ルームを同時に更新します。このため、RoomList はただの view ではなく `useRoom()` に強く依存します。

### 8.3 `useProfileGameHistory()`

`useProfileGameHistory()` は profile 画面専用の read-side hook です。役割は限定的で、ゲーム進行中の room state を持つのではなく、自分の完了済み対局一覧を読むことに特化しています。

- `/api/user-profile/[id]/game-history` を叩く
- loading / error / empty state を profile UI に渡す
- recent matches を 10 件固定で扱う

これは既存の `useGameHistory()` と別物です。`useGameHistory()` は roomId 単位の詳細 replay / summary を扱い、`useProfileGameHistory()` は profile-first な一覧 entrypoint を扱います。

### 8.4 `useSocialSocket()`

`useSocialSocket()` は social socket への command API を提供します。

- `joinRoom(roomId)`
- `leaveRoom(roomId)`
- `sendMessage(roomId, content, replyTo?)`
- `sendTyping(roomId)`
- `loadMessages(roomId, limit?, cursor?)`

この hook 自体は薄い wrapper ですが、`useChatMessages(roomId)` が重要です。ここでは:

- room 参加時の recent messages load
- `chat:message` の追記
- `chat:typing` の 3 秒表示
- `chat:messages` の初回変換

を行います。

### 8.4 `useBackendStatus()`

これは Fly.io 待機 / 起動モデルに対応するための hook です。`/api/backend-status` を polling し、次を返します。

- `status`
- `isIdle`
- `isStarting`
- `lastActivityAgo`
- `activeConnections`

UI では RoomList がこれを使って、「backend 起動中」「接続中」などを表示します。これは運用構成が UI に露出している例です。

### 8.5 その他の hooks

- `useKeyboardOffset()`: mobile で chat dock とソフトキーボードの位置干渉を避ける
- `usePreloadCards()`: 画像などの先読み用
- `useRequireAuth()` / `useOptionalAuth()`: auth access の薄い helper

## 9. 主要画面の流れ

### 9.1 トップページ

`app/[locale]/page.tsx` が、現行 frontend の中心になるページです。この一画面が、認証状態と room state に応じて複数の顔を持ちます。

状態ごとの表示:

- auth loading 中: Navigation + loading
- 未ログイン: Navigation + LandingPage + AuthModal
- ログイン済みかつ room 未参加: Navigation + RoomList
- room 参加済み / game 未開始: PreGameTable
- game 開始済み: GameTable + GameDock（chat / utility。対局ログの主導線は profile）

つまりトップページは「ランディング」「ロビー」「待機室」「ゲーム卓」の統合 entry です。

### 9.2 `/rooms`

`app/[locale]/rooms/page.tsx` は RoomList の専用ページです。トップページと違い、ゲーム卓への分岐を持たず、ルーム選択に集中しています。

### 9.3 `/profile`

プロフィール画面は `ProfilePage` を描画します。ここでは auth 状態に応じて:

- 未ログインなら login 導線
- ログイン済みなら stats 表示
- 編集モードなら `ProfileEditForm`
- 「最近の対局」では `ProfileRecentMatchesSection`

に切り替わります。`ProfileEditForm` は profile の更新に加えて avatar upload、theme / font size の反映、場合によっては `update-auth` socket event による name 反映も扱います。

`ProfileRecentMatchesSection` は対局ログの主導線です。ここでは自分が参加した完了済み対局を新着順で表示し、各行から `/{locale}/game-history/[roomId]` へ遷移します。つまり current `main` では対局ログはゲーム中の dock からではなく、プロフィールから見る前提です。

### 9.4 `/docs`

`TutorialWhitepaper` を表示するページです。これは開発者向け docs ではなく、プレイヤー向けのルール whitepaper です。sidebar と content sections を持ち、translation から section 群を構築する設計になっています。

### 9.5 `Navigation`

`Navigation` は単なるヘッダではありません。次を一箇所で扱います。

- locale switch
- theme switch
- font size switch
- profile access
- mobile menu

さらに、トップページで room 内にいるときは locale switch を隠します。理由は locale 変更による page remount が socket 接続断に繋がるためです。ここには、UI コンポーネントに見えて接続安定性の制約が埋め込まれています。

## 10. コンポーネント構成の見方

`components/` は feature 単位で読むと迷いにくい構成です。まずは次のまとまりで捉えるのが実務上もっとも安全です。

| ディレクトリ | 内容 |
| --- | --- |
| `auth/` | 認証モーダル、フォーム、guard |
| `game/` | `GameTable`, `PreGameTable`, `PlayerHand`, `GameField`, `GameDock`, `GameHistoryPageClient` などゲーム進行 / chat utility / 履歴詳細 UI |
| `landing/` | ランディングページ |
| `layout/` | Navigation など横断 UI |
| `room/` | `RoomList`, `GameJoinForm`, `GameJoinGroup` などロビー / 参加導線 UI |
| `profile/` | profile 表示 / 編集 |
| `shared/` | `ConfirmModal`, `Notification` など横断 UI |
| `social/` | chat dock, composer, message |
| `tutorial/whitepaper/` | ルール白書 UI |

現行 frontend では atomic design を主軸にせず、feature 単位で `game`, `room`, `shared`, `auth`, `social` を読む方が正確です。`GameTable` や `RoomList` のような実装密度の高い UI は、再利用粒度より責務単位で追った方が変更影響を見積もりやすくなります。

## 11. frontend 型の見方

### 11.1 frontend 型は UI 寄り

`mei-tra-frontend/types/` には `game.types.ts`, `room.types.ts`, `social.types.ts`, `user.types.ts` があります。ここは backend 型の完全コピーではなく、「frontend が表示・操作に必要な shape」に寄せた UI state / view model 層です。

例:

- `game.types.ts` では `GameActions` のような UI 専用型がある
- `room.types.ts` には `teamAssignments` が含まれる
- `social.types.ts` は `contracts/` の social payload を frontend 側へ再公開する薄い入口になっている
- `user.types.ts` には theme / font size を含む preference 型がある

### 11.2 transport 契約との境界

REST DTO と socket payload の source of truth はトップレベル `contracts/` にあります。frontend はそこから受けた transport shape を、そのまま画面 state に持ち込まず UI 用に変換します。

代表例が `useGame()` です。backend から受ける phase は `contracts/game.ts` の transport union で受け、frontend 側では `waiting -> null` のように UI state へ変換しています。team score も wire では `play` / `total` だけを共有し、frontend は表示都合で `deal` / `blow` を補完します。

## 12. REST route と API proxy

frontend は API server そのものではありませんが、Next.js route handler を二つ持ちます。

### 12.1 `/api/backend-status`

実体は `app/api/backend-status/route.ts` で、backend の `/api/health` を叩いて frontend UI 用に shape を正規化します。

元の backend response:

- `status`
- `activity.isIdle`
- `activity.lastActivityAgo`
- `activity.activeConnections`

frontend route はこれを `isStarting` 付きで返し、backend 不達時でも UI が冷静に「起動中」と表示できるようにしています。

### 12.2 `/api/user-profile/[id]/avatar`

avatar upload は browser から直接 backend へ送らず、この route を経由します。ここでは:

- `Authorization` header 必須
- `formData` をそのまま backend へ転送
- backend base URL の正規化
- backend error message の転写

を行います。画像最適化自体は backend 側です。

### 12.3 `/api/user-profile/[id]`

profile read / write も current frontend ではこの route を通します。

- `GET`: backend の public profile read をそのまま proxy
- `PUT`: bearer token 必須で backend self-only endpoint へ転送

これにより、`ProfileEditForm` や preference 更新は browser から直接 Supabase table を更新せず、backend 側の認可境界に揃います。

### 12.4 `/api/user-profile/[id]/game-history`

profile 画面の「最近の対局」はこの route handler を通します。

- `GET`: backend の self-only endpoint `/api/user-profile/:id/game-history` に bearer token 付きで転送
- 最新 10 件の完了済み対局だけを返す
- 対局ログ詳細そのものは返さず、`roomId`, `roomName`, `completedAt`, `roundCount`, `totalEntries`, `winningTeam`, `lastActionType` のような一覧向け shape に絞る

これにより、profile 画面は軽量な一覧を扱い、詳細な replay / audit は `/{locale}/game-history/[roomId]` 側に分離されます。

## 13. `next.config.mjs` が持つ意味

`next.config.mjs` は意外に重要です。ここでは次を設定しています。

- `next-intl` plugin
- `reactStrictMode`
- `fs` / `path` fallback
- Supabase Storage image の remotePatterns
- backend API への rewrite

特に rewrite により、frontend から `/api/*` を叩くと backend の `/api/*` に転送されます。ただし `backend-status` や `user-profile` のような frontend 自前 route handler は rewrite より先に解決されます。current `main` では config file を `next.config.mjs` に一本化しており、`next.config.js` の重複は残していません。

## 14. テスト構成

### 14.1 Jest

`jest.config.js` は `next/jest` ベースで、`__tests__/**/*.test.{js,jsx,ts,tsx}` を対象にします。現行で確認できる主な対象は:

- Navigation component
- UserProfile component
- preferences lib
- tutorial hook / helper

つまり frontend の Jest は、現時点ではロジックの大規模保証というより、局所的な regression 防止の色が強いです。

### 14.2 Playwright

`playwright.config.ts` では `playwright/**/*.e2e.spec.ts` を対象にしています。現状の主な E2E は:

- `tutorial.e2e.spec.ts`
- `waiting-room.e2e.spec.ts`

ゲーム全体の end-to-end を網羅しているわけではなく、ルームや tutorial の主要導線を押さえている段階です。frontend を大きく変える場合は、Jest より Playwright を先に拡張したくなる場面もあります。

## 15. frontend を読む順番のおすすめ

frontend を実装者として読む場合、最短ルートは次の順です。

1. `app/[locale]/page.tsx`
2. `hooks/useGame.ts`
3. `hooks/useRoom.ts`
4. `hooks/useSocket.ts`
5. `contexts/AuthContext.tsx`
6. `contexts/SocialSocketContext.tsx`
7. `components/room/RoomList/index.tsx`
8. `components/game/GameTable/index.tsx` と `components/game/PreGameTable/index.tsx`

この順で読むと、「ページ分岐 → 状態集約 → 接続 → provider → UI」の流れで把握できます。

## 16. frontend 変更時に意識すべきこと

最後に、frontend 変更時に特に注意すべき点をまとめます。

### 16.1 locale 変更は接続断を招きやすい

page remount が socket 再初期化を引き起こすため、特に room 内の言語切替は慎重に扱う必要があります。現行では Navigation がそこを回避しています。

### 16.2 room と socket の状態は sessionStorage を介して結び付いている

`roomId` は単なる UI state ではありません。再接続 handshake に使われるため、削除タイミングを誤ると reconnect 体験が崩れます。

### 16.3 frontend は backend cold start を隠蔽している

「少し待てばつながる」という UX は `useBackendStatus()` によって成立しています。接続時 UI を簡略化しすぎると本番体験が悪化します。

### 16.4 auth と profile は分けて考える

session があることと profile が hydrate されていることは同義ではありません。`AuthContext` の loading / cache / retry を壊さないことが大事です。

### 16.5 social は別サブシステム

chat dock が同じ画面にあるからといって、ゲームイベントと同じ発想で実装しないこと。namespace も lifecycle も別です。

## 17. 画面ごとの責務をもう少し細かく見る

frontend はトップページ一枚に見えても、画面ごとに責務が違います。ここを意識すると、変更対象の切り分けが速くなります。

### 17.1 LandingPage

未ログイン時の入口であり、marketing page と auth entry が同居しています。

- login / signup CTA
- locale 対応 screenshot
- FAQ JSON-LD
- 外部 product URL への導線

### 17.2 RoomList

ロビー画面の中心ですが、実装上は:

- backend health 可視化
- create room form
- search/filter
- join action
- current room への遷移通知

を持ちます。単なる一覧表示ではありません。

### 17.3 ProfilePage

プロフィール画面は、成績閲覧、アカウント設定、avatar 更新、password reset 申請をまとめた account hub です。`AuthModal` とは別の認証関連 UX を持っている点が重要です。

### 17.4 TutorialWhitepaper

ゲームロジックとは独立ですが、プロダクトの onboarding を担う重要 UI です。translation をもとに section 群を構築するので、文言設計と UI 構造が強く結び付いています。

## 18. frontend 側の暗黙ルール

コード全体を通して、明文化されていないが守られているルールがあります。

### 18.1 サーバーが真、UI は従

teamScores, current turn, hand, field 完了などは server event を待って更新する前提です。楽観更新は最小限に留めています。

### 18.2 `sessionStorage.roomId` は reconnect 用の状態

これは UI の便利値ではなく、接続復旧のための handshake input です。削除タイミングを変えると reconnect 挙動が壊れます。

### 18.3 provider と hook の責務をまたがない

認証は `AuthContext`、social socket は `SocialSocketProvider`、ゲーム進行 state は `useGame()`、room lifecycle は `useRoom()` に寄せる、という暗黙分担があります。新しい状態追加時は、まずこの境界を崩さない置き場所を探すのが安全です。

## 19. 次に読む章

frontend を読み進めるなら、次は backend 側の責務境界も合わせて理解すると迷いにくくなります。

- backend 全体の層構造を確認する: [03-backend-architecture.md](./03-backend-architecture.md)
- イベント駆動フローを時系列で追う: [04-realtime-game-flow.md](./04-realtime-game-flow.md)
- 認証 / Supabase / 永続化境界を確認する: [05-data-auth-persistence.md](./05-data-auth-persistence.md)
