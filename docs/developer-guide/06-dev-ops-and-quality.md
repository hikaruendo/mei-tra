# 06. DevOps and Quality

この章では、現行 `main` を安全に開発・テスト・デプロイ・運用するための実務情報をまとめます。ここでの重点は「一般論としての DevOps」ではなく、この repo で実際にどう起動し、どのコマンドを使い、どの runbook を信頼し、どういう運用前提で実装されているかです。

現行構成では、ローカル開発、CI/CD、本番運用がかなり密接につながっています。特に重要なのは次の三つです。

- backend は Fly.io の cold start / standby を前提にしている
- frontend はその cold start を UI 側で吸収している
- Supabase schema と運用手順は backend 配下の runbook に残っている

## 1. 日常開発の基本フロー

この repo で通常の機能開発を行う場合、最小限の流れは次です。

1. local Supabase を起動する
2. backend を起動する
3. frontend を起動する
4. 必要なら test user を作る
5. 機能確認とテストを行う

repo 直下 README や AGENTS にもコマンドはありますが、実務上の意味と依存順序をここで整理します。

## 2. ローカル起動順序

### 2.1 Supabase

まず backend ディレクトリで local Supabase を起動します。

```bash
cd mei-tra-backend
npm run supabase:start
```

実体は `scripts/start-local-supabase.sh` で、`.env.development` と `.env.local` を読み込んだうえで `supabase start` を実行します。起動後、Mailpit は `http://localhost:54324` で使えます。

### 2.2 backend

```bash
cd mei-tra-backend
npm run start:dev
```

backend は通常 `3333` 番で listen します。`main.ts` で `setGlobalPrefix('api')` されているため、health は `http://localhost:3333/api/health` です。

### 2.3 frontend

```bash
cd mei-tra-frontend
npm run dev
```

frontend は通常 `3000` 番です。backend URL は `NEXT_PUBLIC_BACKEND_URL` から決まり、rewrite と Socket 接続の両方に使われます。

### 2.4 test users

複数アカウントで room / game を試す場合は:

```bash
cd mei-tra-backend
bash scripts/create-test-users.sh
```

を実行します。4 つの example user が作られるので、複数ブラウザタブでログインして multiplayer を確認できます。

## 3. 起動時に理解しておくべきこと

### 3.1 Supabase を起動しないと困る部分

Supabase が起動していないと、少なくとも次が不安定になります。

- login / sign up
- user profile load
- room / game state persistence
- chat persistence
- avatar upload

backend 自体は起動できても、永続化や token 検証が失敗します。

### 3.2 frontend は backend 未起動を UI で扱う

`useBackendStatus()` は `/api/backend-status` を polling し、backend の `status`, `isIdle`, `isStarting` を UI に反映します。これは本番の cold start を吸収する目的ですが、ローカルでも backend 起動漏れを視覚化するために役立ちます。

### 3.3 Socket は auth 完了後に接続する

frontend の `useSocket()` と `SocialSocketProvider` は auth 完了前に接続しません。したがって、「ページは出るが socket がつながらない」場合は、まず auth 状態を見る必要があります。

## 4. フロントエンドの検証方法

### 4.1 lint / test

frontend で使う主なコマンドは次です。

```bash
cd mei-tra-frontend
npm run lint
npm run test
```

`test:coverage` も package.json にはありますが、日常確認では `npm run test` が起点になります。

### 4.2 Playwright

E2E は Playwright です。

```bash
cd mei-tra-frontend
npx playwright test
```

対象は `playwright/**/*.e2e.spec.ts` です。現状のカバレッジは:

- tutorial flow
- waiting room flow

が中心です。ゲーム全体の完全 E2E はまだ薄いので、ゲームロジック変更時は backend test と手動確認を併用する必要があります。

### 4.3 画面手動確認の最小セット

frontend を変えたときに最低限確認したいのは次です。

- 未ログインで landing が出るか
- ログイン後に RoomList が出るか
- ルーム作成できるか
- 参加 / 準備完了 / 開始が通るか
- chat dock が開けて message が出るか
- profile 画面が開けるか
- profile の「最近の対局」に完了済み対局が出るか
- recent match から `/{locale}/game-history/[roomId]` に遷移できるか
- docs / tutorial が読めるか
- locale 切替が room 外で正常か

## 5. バックエンドの検証方法

### 5.1 build / lint / unit test / e2e

backend の主な確認コマンド:

```bash
cd mei-tra-backend
npm run build
npm run lint
npm test
npm run test:cov
npm run test:e2e
```

backend は frontend よりテストが厚く、サービス、use case、gateway、social の spec が存在します。

### 5.2 backend テストの見方

`src/services/__tests__/` や `src/use-cases/__tests__/` には unit / application level の spec があり、`test/` には e2e が入っています。

確認できる e2e entry:

- `test/app.e2e-spec.ts`
- `test/social.e2e-spec.ts`
- `test/user-profile.e2e-spec.ts`

つまり backend では、少なくとも HTTP / social / profile write 経路の統合確認が既に組まれています。`user-profile.e2e-spec.ts` では `401`, `403`, `200/201` と avatar storage path を明示的に見ています。

### 5.3 ゲームロジック変更時の確認

blow / play / score / COM を触ったときは、次をセットで見る方が安全です。

- 関連する service / use case の unit test
- `npm run test:e2e`
- 実際に 2〜4 アカウントで room を建てて手動確認

Socket イベントは unit test だけで安心しない方がよいです。実際の reconnect や UI state は手動の方が早く壊れます。

## 6. local Supabase と migration 作業

### 6.1 schema 変更時の基本手順

runbook 詳細は `mei-tra-backend/SUPABASE_OPERATIONS.md` と `mei-tra-backend/SUPABASE_MIGRATION.md` にありますが、日常的には次の流れです。

1. migration を作る
2. SQL を書く
3. `supabase db reset` か `supabase db push` で適用する
4. backend / frontend を再起動する
5. test user や seed 状態を必要なら作り直す
6. 実機能を確認する

### 6.2 local でよく見る URL

起動後の主要 URL は次です。

- Supabase API: `http://127.0.0.1:54321`
- DB: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- Studio: `http://127.0.0.1:54323`
- Mailpit: `http://127.0.0.1:54324`

### 6.3 migration で気を付ける点

現行 schema は、初期テーブルに加えて auth、social、avatars、cron cleanup、font size、numeric score が後から積まれています。schema 変更時は、新機能だけを見ずに次も確認してください。

- generated type と TypeScript shape のズレ
- frontend preference fallback
- pg_cron の既存 job 名との重複
- Storage bucket policy との整合

## 7. CI/CD 構成

### 7.1 deploy workflow

`.github/workflows/deploy.yml` は `main` push を契機に backend を Fly.io へ deploy します。

流れ:

- checkout
- Fly CLI setup
- `flyctl deploy --remote-only -c fly.toml`

working directory は `mei-tra-backend` です。つまり repo 全体ではなく backend ディレクトリ単位で deploy しています。

### 7.2 auto-scale workflow

`.github/workflows/auto-scale.yml` は 1 時間ごとに走り、`mei-tra-backend/scripts/auto-scale.sh` を実行します。

この script は Fly API を見て:

- `min_machines_running`
- machine `count`

を確認し、`count=1, min=0` を維持します。狙いは、完全にゼロにして自動起動不能になるのを避けつつ、cold start 可能な最低コスト構成に保つことです。

### 7.3 Claude workflow

`.github/workflows/claude.yml` はコード運用に直接関係しませんが、repo のコラボレーション環境として有効です。実装よりも issue / PR の支援に使われます。

## 8. Fly.io 運用モデル

### 8.1 `fly.toml`

現行 `fly.toml` の重要点:

- `app = 'mei-tra-backend'`
- `primary_region = 'nrt'`
- `internal_port = 3333`
- `auto_stop_machines = 'stop'`
- `auto_start_machines = true`
- `min_machines_running = 0`
- health check path: `/api/health`

つまり、平常時は止まり得る backend を health endpoint 付きで運用している構成です。

### 8.2 production / standby 切替 script

backend には:

- `scripts/set-production-mode.sh`
- `scripts/set-standby-mode.sh`

があります。両方とも `fly.toml` の `min_machines_running` を `sed` で書き換え、`fly deploy` します。

この方式の注意点:

- script 実行自体が repo tracked file を書き換える
- 実行後の差分管理に注意が必要
- Git history 上では運用都合の変更として残りうる

運用の便利さ優先の script なので、日常開発の延長で軽く叩かない方が安全です。

## 9. health, idle, startup UX

### 9.1 `GET /api/health`

`HealthController` は次を返します。

- status
- timestamp
- uptime
- activity
- memory

status は idle なら `degraded`、そうでなければ `ok` です。ここでいう idle は 30 分無活動かつ接続ゼロです。

### 9.2 frontend からの見え方

frontend の `/api/backend-status` route handler は backend 不達時でも `200` で `isStarting: true` を返すようにしています。これにより、ユーザーから見える状態は:

- 正常
- idle
- 起動中 / 到達不能

に整理されます。

### 9.3 なぜこの設計が重要か

Fly.io の cold start をそのままユーザーに見せると、「壊れている」のか「起動待ち」なのか判別しにくくなります。backend health と frontend の polling UI が一体になって、この問題を隠蔽しています。

## 10. 日常運用用 script

backend 側の主要 script:

| script | 用途 |
| --- | --- |
| `start-local-supabase.sh` | local Supabase 起動 |
| `create-test-users.sh` | local auth user 作成 |
| `clear-dev-rooms.ts` | dev room の掃除 |
| `backup-production.sh` | 本番バックアップ補助 |
| `auto-scale.sh` | Fly の scale 整理 |
| `set-production-mode.sh` | 常時起動モードに切替 |
| `set-standby-mode.sh` | standby モードに切替 |

script は便利ですが、repo tracked file を変更するものもあるため、実行前に意味を確認してください。

script の温度感は分けて扱うべきです。

- 日常開発で頻繁に使う:
  - `start-local-supabase.sh`
  - `create-test-users.sh`
- 状況に応じて使う:
  - `clear-dev-rooms.ts`
  - `auto-scale.sh`
- 本番運用でだけ触るべき:
  - `backup-production.sh`
  - `set-production-mode.sh`
  - `set-standby-mode.sh`

特に production / standby 切替 script は、便利だからといってローカル検証の延長で叩くものではありません。`fly.toml` の tracked 差分と、本番 machine の状態変化の両方を伴うため、実行前に目的をはっきりさせる必要があります。

## 11. 既存 runbook との関係

この章は導線をまとめるものです。具体的な手順を実行するときは、既存 runbook も参照してください。

### 11.1 `mei-tra-backend/DEPLOYMENT.md`

Fly.io の production mode / standby mode をどう使い分けるかに強い runbook です。運用時の判断材料はこちらを見ます。

### 11.2 `mei-tra-backend/DEPLOYMENT_CHECKLIST.md`

本番反映前後の checklist です。バックアップ、ロールバック、確認項目まで含まれているので、実際の deploy ではここを先に見るべきです。

### 11.3 `mei-tra-backend/SUPABASE_OPERATIONS.md`

日常作業、schema 変更、緊急対応、定期メンテナンスまで含む包括 runbook です。Supabase 周りで迷ったらまずこれです。

### 11.4 `mei-tra-backend/SUPABASE_MIGRATION.md`

移行時の考え方と troubleshooting が中心です。特に migration 未適用系エラーの記録があるため、schema mismatch のときに有用です。

この `developer-guide` シリーズは入口、backend 配下 docs は実運用 runbook、と切り分けて考えると分かりやすいです。

## 12. よくあるトラブルと確認順序

### 12.1 ログインできない / 認証が変

確認順序:

1. local Supabase が起動しているか
2. `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` が正しいか
3. auth callback / reset password の redirect が正しいか
4. backend の `AuthService` で token validation が通るか

### 12.2 ルーム一覧が出ない

確認順序:

1. frontend の `useBackendStatus()` が何を表示しているか
2. backend が `/api/health` に応答するか
3. `useSocket()` が connect しているか
4. `list-rooms` と `rooms-list` が飛んでいるか
5. `rooms` / `room_players` テーブルの状態

### 12.3 ゲーム途中で復帰できない

確認順序:

1. browser の `sessionStorage.roomId` が残っているか
2. reconnect handshake に roomId が入っているか
3. backend 側 room / game state が保存されているか
4. `game-state` が再送されているか
5. `useGame()` が current room と current player を再同期できているか

### 12.4 avatar upload が失敗する

確認順序:

1. Authorization header が route handler まで届いているか
2. bearer token の user id と `:id` が一致しているか
3. backend `/api/user-profile/:id/avatar` が応答しているか
4. object key が `<userId>/avatar-*.webp` で作られているか
5. Sharp で 50KB 以下に収まっているか
6. Supabase Storage bucket `avatars` があるか
7. service role の env が正しいか

### 12.5 schema mismatch / column missing

確認順序:

1. local Supabase が最新 migration まで適用済みか
2. `supabase db reset` が必要か
3. backend type と actual DB schema がずれていないか
4. generated database type や JSON shape が古くないか

### 12.6 backend が起動中のまま戻ってこない

確認順序:

1. Fly 側で machine が stop から start へ遷移しているか
2. `/api/health` へ直接叩いて応答が返るか
3. frontend `/api/backend-status` route handler が timeout 扱いしていないか
4. deploy 直後なら workflow failure や boot error がないか

UI 上では単に「起動中」に見えても、実体は boot 失敗や health check failure のことがあります。health endpoint を直接見るのが早いです。

### 12.7 チャットだけ壊れてゲームは動く

確認順序:

1. `/social` namespace の socket が connect しているか
2. `join-room` が social 側で呼ばれているか
3. `chat_rooms`, `chat_members`, `chat_messages` に不整合がないか
4. `ChatService` で sender profile 解決に失敗していないか

game socket と social socket は別経路なので、チャットだけ壊れるケースは普通に起こり得ます。問題を game 側へ広げすぎないことが重要です。

## 13. 品質を保つための実践メモ

### 13.1 変更の粒度を揃える

socket event 名、payload、frontend hook 反映、backend UseCase、migration を一つの PR に混ぜるときは、境界が追えるように commit や PR 説明を整理した方がよいです。現行構造は層が分かれているので、差分の見せ方次第でレビュー難易度が大きく変わります。

### 13.2 docs も一緒に更新する

次の変更では、この `developer-guide` シリーズも一緒に更新してください。

- route を追加 / 削除した
- socket event を追加 / rename した
- UseCase や Service の責務を変えた
- Supabase schema / bucket / cleanup job を変えた
- deploy / scaling / health の前提を変えた

### 13.3 ローカルで再現できることを増やす

本番依存の問題でも、まず local Supabase + local backend + local frontend で最小再現を作れると調査が速いです。特に auth, profile, chat, room lifecycle は local でかなり再現できます。

## 14. マージ前の実務チェックリスト

機能を入れたあと、PR 前に最低限見たい項目をまとめます。

### 14.1 frontend 変更を含む場合

- `npm run lint`
- `npm run test`
- 影響する Playwright があれば実行
- 未ログイン / ログイン済みの両方で画面崩れ確認
- locale 切替や room 遷移で壊れないか確認

### 14.2 backend 変更を含む場合

- `npm run build`
- `npm run lint`
- `npm test`
- 影響範囲に応じて `npm run test:e2e`
- room 作成、参加、開始、プレイ、leave の手動確認

### 14.3 migration を含む場合

- local Supabase で `db reset` 可能か
- 既存データ前提の backfill が必要か
- frontend / backend 型更新が漏れていないか
- runbook へ追記が必要か

## 15. 監視と観測の実態

本格的な observability stack を持つわけではありませんが、現行構成にも最低限の観測点があります。

### 15.1 Sentry

backend は `SENTRY_DSN` がある場合に初期化され、global filter も設定されます。未処理例外の集約点として機能します。

### 15.2 health endpoint

`/api/health` は liveness だけでなく、接続数、last activity、idle、memory を返すため、運用上の第一観測点です。

### 15.3 frontend 側の console

`app/socket.ts`, `useSocket()`, `SocialSocketContext` には接続ログがかなり入っています。ローカル調査では browser console が最初の観測点になります。

### 15.4 GitHub Actions と Fly logs

本番寄りの観測では、browser console だけでなく workflow と platform logs を合わせて見る必要があります。

- deploy 後に壊れた: `.github/workflows/deploy.yml` の実行結果
- standby / production 切替が効かない: `.github/workflows/auto-scale.yml` と Fly machine 状態
- 起動はするが安定しない: `/api/health` と platform logs

この project では observability が一枚岩ではないため、browser、health endpoint、workflow、Fly の複数観測点をまとめて見るのが実務上の基本になります。

## 16. 定期メンテナンス観点

既存 runbook には日次 / 週次 / 月次の考え方があります。この章では意図だけ整理します。

### 16.1 日次寄り

- health が正常か
- auto-scale workflow が失敗していないか
- backend が起動不能になっていないか

### 16.2 週次寄り

- deploy 後の Fly 状態確認
- 主要 room flow の smoke test
- cleanup 系 job の影響確認

### 16.3 月次寄り

- backup / restore 手順の見直し
- dependency update
- docs と実装のズレ確認

ここでいう定期メンテナンスは、単に package を更新することではありません。特に次のズレは放置すると新規参加者が最も困ります。

- migration は増えたのに runbook が古い
- socket event は増えたのに docs の契約表が古い
- frontend fallback は変わったのに backend 型説明が古い

コードだけでなく docs も含めて月次で確認する意識が必要です。

## 17. デプロイ時の判断ポイント

workflow で自動化されていても、人が判断すべきポイントは残ります。

### 17.1 production mode に上げる場面

イベントや対戦会など、cold start を避けたい時間帯は `min_machines_running = 1` に上げる判断があり得ます。

### 17.2 standby に戻す場面

常時トラフィックがないなら `min_machines_running = 0` へ戻してコスト最適化する前提です。frontend はそれを UX で吸収するよう設計されています。

### 17.3 特に危険な変更

- migration を伴う profile 変更
- socket event rename
- `room.players` と `game_states` の整合変更
- reconnect や `sessionStorage.roomId` まわりの変更

この種の変更は local だけでなく、手順や rollback まで含めて見ておく方が安全です。

## 18. ドキュメント保守のルール

このシリーズ自体も品質資産です。次の変更では docs も合わせて更新してください。

- route 追加 / 削除 -> `01`, `02`
- backend module / UseCase 追加 -> `03`
- socket event 追加 / rename -> `04`
- Supabase schema / bucket / cleanup job 変更 -> `05`
- 起動手順 / deploy / scaling 変更 -> `06`

## 19. 新しく参加した開発者向けの最短チェックリスト

最後に、この repo に入ってすぐ作業する人向けの最短 checklist を置きます。

1. `docs/developer-guide/01-system-overview.md` を読む
2. `docs/developer-guide/02-frontend-architecture.md` と `03-backend-architecture.md` を読む
3. `cd mei-tra-backend && npm run supabase:start`
4. `cd mei-tra-backend && bash scripts/create-test-users.sh`
5. `cd mei-tra-backend && npm run start:dev`
6. `cd mei-tra-frontend && npm run dev`
7. 2 アカウント以上で room 作成、参加、開始、チャット、プロフィールを一通り触る
8. 触る領域に応じて unit test / e2e を回す

この 8 ステップを通せば、少なくとも「このプロジェクトがどう動くか」は掴めます。

## 20. この章で押さえるべきこと

- ローカル開発は Supabase -> backend -> frontend の順で起動する
- frontend と backend で test 手段が異なる
- deploy は backend を Fly.io に対して行う
- auto-scale と health は本番 UX に直結している
- backend 配下の runbook は入口ではなく実運用手順として使う
- トラブル対応は auth / socket / DB / health の順に切り分けると速い

## 21. 代表的な運用シナリオ

実際の運用では、抽象的な手順より「どんな場面で何をするか」の方が役に立ちます。ここでは代表例を整理します。

### 21.1 普通の機能開発日

やること:

1. local Supabase 起動
2. backend 起動
3. frontend 起動
4. 必要なら test user 作成
5. 変更箇所の unit test / 手動確認
6. lint / build / relevant e2e

この流れが基準です。まずここを速く回せる状態にしておくことが重要です。

### 21.2 schema を変える日

やること:

1. migration 作成
2. local Supabase で reset / push
3. backend type / repository の更新
4. frontend type / context / UI の更新
5. profile / room / game state の実動作確認
6. runbook 追記要否の確認

schema 変更日は、通常開発日より docs と runbook の重要度が上がります。

### 21.3 リリース直前

やること:

1. `DEPLOYMENT_CHECKLIST.md` を見る
2. migration 差分確認
3. backup 戦略確認
4. local / 必要なら本番相当の smoke test
5. deploy workflow の前提を確認

このときは「コードが通る」だけでは不十分で、rollback まで含めて考える必要があります。

### 21.4 イベントや対戦会の直前

やること:

1. production mode へ切替するか判断
2. `/api/health` と Fly 状態確認
3. room 作成 / 開始 / chat の smoke test
4. cold start が UX 上問題になるなら `min_machines_running = 1` を検討

運用コストより体験を優先すべき時間帯では、standby 前提を一時的に崩す判断もあり得ます。

### 21.5 障害調査の日

やること:

1. まず auth / game / social / storage のどの系統かを切り分ける
2. 再現条件を 1 画面 1 操作単位まで落とす
3. browser console、backend log、health endpoint の三点を並べる
4. local で再現できる部分を切り出す
5. schema や env が関係するなら runbook と migration を確認する

この順序にしておくと、「なんとなく全体が壊れている」という見え方を、責務単位の具体的な問題へ落とし込みやすくなります。

## 22. このシリーズを使った onboarding の仕方

新しい開発者にこの repo を渡すときは、次の順で読んでもらうと効率がよいです。

1. `README.md`
2. `01-system-overview.md`
3. 触る予定の層に応じて `02` または `03`
4. ゲーム同期を触るなら `04`
5. 認証 / Supabase を触るなら `05`
6. 起動と deploy を触るなら `06`

この順にすると、抽象的な全体像から具体的な作業面まで自然に降りられます。

初週の進め方も固定しておくと迷いません。

1. まず local で 2 アカウント以上を使って一連のプレイフローを通す
2. 次に docs を読みながら、そのフローがどの route / hook / gateway / repository に対応するかを確認する
3. そのあとで小さな UI 変更か文言修正を 1 件入れて、PR 単位の流れを覚える

最初の 1 週間でいきなり大きな設計変更に入るより、この順で責務線を体で覚える方が安全です。

逆に、最初の段階で migration、reconnect、socket rename、production mode 切替をまとめて触るのは避けた方がよいです。この repo は層ごとの責務線が見えている一方で、複数層を同時に崩すと原因切り分けが急に難しくなります。

まずは単一層の小変更でレビューと検証の型を掴み、その後に横断変更へ進む方が堅実です。

この順序を守るだけでも、初期 onboarding の失敗率はかなり下がります。

最初に難所へ飛び込まないこと自体が品質策です。

焦って横断変更を始めないことが、結果的に最短です。

安全な立ち上がり方を固定すること自体が、運用品質の一部です。

新人ほどこの順序を守る意味があります。

急がないことが、結局いちばん速いです。

無理に背伸びしない方が続きます。

現実的です。

## 23. Agent-assisted 開発の harness 方針

この repo は AI agent が継続的に触る前提なので、暗黙知を長大な指示文に積むより、agent が実行・検証できる形に寄せます。

### 23.1 AGENTS は目次、詳細は局所化

`AGENTS.md` は短い入口として保ち、すべての設計判断を詰め込みません。日常作業は `README.md`、`AGENTS.md`、コードを起点にし、必要なときだけ該当する developer guide を読みます。

新しい運用ルールを書く場合は、次のどこに置くかを先に決めます。

- frontend の構造や UI 確認: `docs/developer-guide/02-frontend-architecture.md`
- backend / use-case / repository 境界: `docs/developer-guide/03-backend-architecture.md`
- Socket.IO と realtime flow: `docs/developer-guide/04-realtime-game-flow.md`
- Supabase / auth / persistence: `docs/developer-guide/05-data-auth-persistence.md`
- 起動、検証、CI、運用: この章

### 23.2 反復する注意は prose ではなく harness に昇格する

レビューで同じ指摘が繰り返される場合は、文章で注意喚起するだけでなく、できるだけ機械的な検証へ移します。

- wire shape のズレ: `contracts/` の型と frontend/backend build
- ルール回帰: `CardService`, `BlowService`, `PlayService`, `ScoreService`, `ChomboService` の unit test
- phase / turn の破綻: use-case spec と realtime regression
- 認可漏れ: controller spec / API route test
- UI 回帰: component test、browser 確認、スクリーンショット

つまり「agent に覚えてもらう」より、「agent が失敗したら検知できる」状態を優先します。

### 23.3 UI / realtime は実行して観測する

UI や Socket.IO のバグはコード読解だけで判断しない方が安全です。可能なら frontend / backend を起動し、ブラウザで主要導線を確認します。

最低限見る導線:

- room create -> join -> start
- blow declare / pass
- Joker の base suit 表示
- play -> field complete -> next round
- game over -> profile recent matches -> replay detail
- reconnect / COM replacement

スクリーンショットで報告された UI bug は、修正後も同じ画面状態に近い形で確認するのが理想です。

### 23.4 docs のガベージコレクション

古い docs は agent にとってノイズになります。コードと docs がズレた場合はコードを信頼し、関連 docs を更新するか、歴史資料として `docs/archive/` に移します。

特に注意するもの:

- 「最重要」が複数ある設計説明
- 旧 component path のままの説明
- 現在の `contracts/` と違う payload shape
- 過去の Zenn 記事や一時的な設計メモ

## 24. シリーズの終点として

ここまで読めば、新規開発者が現行 `main` を触るための土台はほぼ揃っています。今後は、自分が触る層に応じて対応する章へ戻りながら進めるのが自然です。

- 全体像に戻る: [01-system-overview.md](./01-system-overview.md)
- frontend に戻る: [02-frontend-architecture.md](./02-frontend-architecture.md)
- backend に戻る: [03-backend-architecture.md](./03-backend-architecture.md)
- イベントフローに戻る: [04-realtime-game-flow.md](./04-realtime-game-flow.md)
- Supabase / auth に戻る: [05-data-auth-persistence.md](./05-data-auth-persistence.md)
