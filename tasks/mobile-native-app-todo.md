# Meitra モバイルネイティブアプリ リリース実装チェックリスト

更新日: 2026-07-24
対象ブランチ: `codex/mobile-expo-app`
設計書: `docs/architecture/mobile-native-app-design.md`

このチェックリストは、コードが存在すること、リポジトリ内で検証できること、外部サービスで実行することを分けて管理する。

## ステータス

- **[実装済み]**: このブランチにコード・設定・テストがある。成功実行や実機動作は未確認でも付ける。
- **[検証済み]**: 実行ログ、CI run、実機記録、または本番確認を添付できる。
- **[外部作業]**: EAS、Apple、Google、Supabase本番など、リポジトリ外で作業する。
- **[未実装]**: 設計・リリースに必要だが、現行コードに対応がない。

同じ項目に実装済みと検証済みを同時に付けない。検証ログが揃った時点で、実装済みの項目を検証済みに更新する。未完了の項目を理由なくチェック済みに変更しない。

## 0. 現在地

| 項目 | 状態 | 根拠 / 次の行動 |
| --- | --- | --- |
| Expo native app、認証、ルーム、対局UI | **[実装済み]** | `mei-tra-mobile/src/app/`、`src/context/`、`src/components/game/` |
| typed Socket.IO contract | **[実装済み]** | `contracts/socket.ts`をmobileの`MobileSocket`が利用 |
| UI非依存のgame client補助 | **[実装済み]** | `shared/game-client/blow.ts`、`card-legality.ts` |
| npm workspaces | **[検証済み]** | npm `10.9.2` clean install。`@meitra/contracts` / `@meitra/game-client`を解決 |
| push token API / Expo送信 / mobile登録 | **[実装済み]** | `mei-tra-backend/src/push/`、`src/lib/notifications.ts` |
| account deletion endpoint / mobile settings | **[検証済み]** | local PlaywrightでHTTP 200、削除成功、sign-in redirectを確認 |
| ローカル品質検証 | **[検証済み]** | mobile 14 suites / 63 tests・Doctor 19/19・両platform export、backend 52/300、frontend 27/78、各lint/build |
| 390×844 browser smoke | **[検証済み]** | seat identityのserver derivation後にfinal normal flowを再実行し、signupから合法card play、reload復元、leave、settings/legal、削除HTTP 200、callback fallbackまで確認 |
| production dependency audit | **[検証済み]** | `npm audit --omit=dev`はmoderate 10件、high / critical 0件。Expoの`xcode`→`uuid`経路はupstream review継続 |
| EAS project link / credentials | **[外部作業]** | `app.json`に`expo.extra.eas.projectId`がない。署名資格情報も未確認 |
| production migrations | **[外部作業]** | localでは`20260806165711`まで適用済み。本番は未適用・未検証 |
| TestFlight / Play内部テスト実機run | **[外部作業]** | まだ実施していない。実機runをリリースゲートにする |
| Store release | 未完了 | このチェックリストは公開・審査提出を完了扱いにしない |

## 1. 共有基盤とCI

### 1.1 実装インベントリ

- [x] **[実装済み]** `mei-tra-mobile/`をExpo Router appとして配置し、iOS `com.kando1.meitra`、Android `com.kando1.meitra`、portrait設定を持つ。
- [x] **[実装済み]** `contracts/socket.ts`に現行のroom/game event mapとroom操作のack型を置く。
- [x] **[実装済み]** `contracts/push.ts`にplatform、token登録、game-started / turn payloadを置く。
- [x] **[実装済み]** `shared/game-client/`に吹き順位・候補生成とカード合法性判定を置く。
- [x] **[実装済み]** root npm workspacesに`mei-tra-mobile`、`contracts`、`shared/game-client`を登録する。
- [x] **[実装済み]** `@meitra/contracts`と`@meitra/game-client`をprivate workspace packageとしてexportする。
- [x] **[実装済み]** Metro、Jest、TypeScriptがworkspace package名で共有コードを解決する。
- [x] **[実装済み]** `LargeSecureStore`とroom recovery recordにunit testを置く。
- [x] **[実装済み]** `.github/workflows/mobile-ci.yml`にlint、typecheck、unit test、iOS / Android exportを定義する。
- [x] **[実装済み]** `.github/workflows/mobile-release.yml`にEAS profile、token、project ID、production branchのpreflightを定義する。

### 1.2 検証・追加実装

- [x] **[検証済み]** npm `10.9.2`でroot workspaceのclean installに成功する。
- [x] **[検証済み]** mobileのlint、typecheck、14 suites / 63 tests、Expo Doctor 19/19に成功する。
- [x] **[検証済み]** mobileのiOS / Android JavaScript exportに成功する。
- [x] **[検証済み]** backendの52 suites / 300 tests、lint、buildに成功する。
- [x] **[検証済み]** frontendの27 suites / 78 tests、lint、buildに成功し、Web dev serverがHTTP 200を返す。
- [x] **[検証済み]** `npm audit --omit=dev`でmoderate 10件、high / critical 0件を確認する。
- [ ] **[外部作業]** Expoの`xcode`→`uuid`経路に残るmoderate advisory 10件をupstream dependency更新で再評価する。Expo downgradeを伴う強制fixは適用しない。
- [ ] **[検証済み]** Web、backend、mobileの全Socket event emit/listenerが`contracts/socket.ts`に対応することを棚卸しする。
- [ ] **[検証済み]** room操作だけでなく、game eventと失敗時のshapeを含むack契約をgateway・Web側でも型検査する。
- [x] **[実装済み]** `shared/game-client/**`とroot workspace metadataの変更でmobile CIを起動する。
- [ ] **[外部作業]** EAS remote builderでリポジトリルートの`contracts/`と`shared/`をMetroが解決できることをpreview buildで確認する。
- [ ] **[外部作業]** EAS login後に`eas build:inspect`でupload archiveを確認する。
- [ ] **[未実装]** 必要ならカードIDと正式カード画像を静的asset registryへ移し、iOS / Android release buildで描画する。

## 2. 認証・保存・ロビー

### 2.1 実装済み範囲

- [x] **[実装済み]** email/password登録・ログイン、メール確認待ち、Google OAuth callbackを動かす。
- [x] **[実装済み]** 起動時にSupabase sessionと`user_profiles`を復元し、表示名・username・avatarを表示する。
- [x] **[実装済み]** `persistSession`、`autoRefreshToken`、nativeでのAppState連動auto refreshを設定する。
- [x] **[実装済み]** session expiry 60秒前を閾値にしたsingle-flight access token取得を使う。
- [x] **[実装済み]** AES暗号化したsession本体をAsyncStorage、暗号鍵をSecureStoreへ保存する。
- [x] **[実装済み]** 旧SecureStore形式からの移行、破損値の破棄、4KB超sessionのテストを用意する。
- [x] **[実装済み]** ルーム一覧、作成、参加、観戦、待機室のready / COM / team shuffle / startを実装する。
- [x] **[実装済み]** room IDをTTL 24時間の`RoomRecoveryRecord`として保存し、game over・離室・復帰拒否時に削除する。

### 2.2 検証

- [x] **[検証済み]** 390×844のPlaywrightでsignupとparameterなし`/auth/callback`の安全なsign-in redirectを確認する。
- [x] **[検証済み]** seat identityのserver derivation後に390×844のPlaywright final normal flowを再実行し、room作成、COM補充、team shuffle、game start、leaveを確認する。
- [x] **[検証済み]** Settingsのprivacy / terms / support linkを確認する。
- [ ] **[検証済み]** ログイン、Googleログインのキャンセル、ログアウト、アプリ再起動後のsession復元をiOS / Androidで確認する。
- [ ] **[検証済み]** 通常session、4KB超session、期限切れroom、破損room recordの復元・掃除を確認する。
- [ ] **[検証済み]** 実端末でルーム作成・参加・観戦、連続tap、待機室のCOM追加とteam shuffleを確認する。
- [ ] **[検証済み]** 認証redirect `meitra://auth/callback`を実機で確認する。
- [ ] **[外部作業]** Supabase Authのredirect URL、native clientのproduction backend URL、CORS/originを環境ごとに登録・確認する。

## 3. Realtimeとゲーム復帰

### 3.1 実装済み範囲

- [x] **[実装済み]** typed Socket.IO clientを`GameContext`で生成し、WebSocket優先 + polling fallbackを設定する。
- [x] **[実装済み]** socket `auth` callbackで接続ごとに最新access token、room ID、表示名を取得する。
- [x] **[実装済み]** 接続時に`list-rooms`、保存roomがあれば`sync-game-state`を送る。
- [x] **[実装済み]** foreground復帰時にtokenを更新し、接続・room一覧・game snapshotを再同期する。
- [x] **[実装済み]** `game-state`をserver snapshotとしてstateへ適用し、room・field・players・score・phaseを表示する。
- [x] **[実装済み]** listenerをprovider effect内で登録し、cleanup時に解除・disconnectする。
- [x] **[実装済み]** `playerId` / `userId`でcurrent playerを解決し、`socket.id`を本人判定の根拠にしない。
- [x] **[実装済み]** ack操作とone-way game actionに重複送信抑止とtimeout/error表示を入れる。
- [x] **[実装済み]** 吹き、pass、ネグリ、カードplay、台札suit、field、次round、game overをUIへ反映する。

### 3.2 未完了の検証・実装

- [x] **[検証済み]** 390×844のPlaywrightでblow pass、合法card play、reload後のauthoritative restore、leaveを確認する。
- [x] **[検証済み]** active game reloadで標準development情報以外のerror / warnがないことを確認する。
- [ ] **[検証済み]** WebSocketを遮断した環境でpollingへfallbackし、ロビーと対局が継続することを確認する。
- [ ] **[検証済み]** background 30秒、2分、process kill後のforeground復帰をiOS / Androidで確認する。
- [ ] **[検証済み]** Wi-Fi↔mobile回線切替、機内モード解除、JWT refresh後の再接続を確認する。
- [ ] **[検証済み]** room終了、invalid JWT、古いroom ID、state inconsistencyで安全にロビーへ戻ることを確認する。
- [ ] **[検証済み]** Web + mobile + COM混在で、team shuffle後からgame overまで1ゲームを完了する。
- [ ] **[検証済み]** 第1roundから次roundの初手まで、吹き・field・scoreが止まらず継続する。
- [ ] **[検証済み]** human→COM置換後に、座席・手札・手番がbackend snapshotから復元される。
- [ ] **[未実装]** `ConnectionStatus`に独立したoffline状態を追加するか判断し、NetInfo offline時の再接続抑止をUIと受入条件へ反映する。
- [ ] **[未実装]** resync中の全game actionを明示的に無効化し、古いsnapshotで操作できないことを保証する。
- [ ] **[未実装]** single-flight resyncと古い同期応答のgeneration破棄を必要性ごと実装・テストする。

## 4. モバイルUXとアクセシビリティ

### 4.1 実装済み範囲

- [x] **[実装済み]** portrait phone向けの待機室、game board、field、hand、score、feedback UIを配置する。
- [x] **[実装済み]** safe area、loading、connecting / resyncing表示、再試行導線を配置する。
- [x] **[実装済み]** button busy/disabled、accessibility label / role / state / live regionを主要操作へ設定する。
- [x] **[実装済み]** カード、吹き、待機室操作の処理中表示と連続tap抑止を実装する。

### 4.2 未実装・実機確認

- [x] **[検証済み]** 390×844 browser viewportでsignup、room、game、settings、legal links、account deletionのsmokeを完了する。
- [ ] **[検証済み]** iPhone notch、Android back gesture、320pt幅、キーボード表示中の主要操作を確認する。
- [ ] **[検証済み]** 44pt以上のカード・ボタンtap targetを実測する。
- [ ] **[検証済み]** VoiceOver / TalkBackで手番、選択状態、無効理由、接続状態を読み上げ確認する。
- [ ] **[検証済み]** 1.0x / 1.5x / 2.0x文字倍率でレイアウト崩れを確認する。
- [ ] **[未実装]** reduced motionの設定を読み、手札fan・カード移動・field回収の移動量と時間を切り替える。
- [ ] **[未実装]** `expo-haptics`をカード確定・field獲得・勝敗の補助feedbackへ追加する。
- [ ] **[未実装]** `expo-keep-awake`を対局中だけ有効にする。
- [ ] **[未実装]** `/social`チャットをmobile routeへ追加する。
- [ ] **[未実装]** Maestro E2Eを追加する。

## 5. Push通知

### 5.1 実装済み範囲

- [x] **[実装済み]** mobileで実機判定、通知権限、Android `gameplay` channel、Expo Push Token取得を行う。
- [x] **[実装済み]**端末IDとtoken登録を端末単位でAsyncStorageへ保存し、認証後に登録する。
- [x] **[実装済み]** `POST /api/push-tokens`登録、logout時のDELETE、通知tapのroom route、未ログイン時のtap保留を実装する。
- [x] **[実装済み]** backendのAuthGuard付きtoken登録・削除API、service-role限定repository、Expo batch送信を実装する。
- [x] **[実装済み]** game start / turn notificationをCOM・spectator・通知off profileから除外する。
- [x] **[実装済み]** `DeviceNotRegistered` tokenをcleanupし、送信失敗をgameplayへthrowしない。
- [x] **[実装済み]** `push_receipts`、claim / reschedule / complete RPCと30秒起動のreceipt workerを実装する。accepted ticketのqueryはおよそT+15 / 20 / 35 / 65 / 125 / 245 / 485 / 965分（30秒jitter）、最大8回で、最終queryのおよそ16時間5分にExpo receipt retention内でexpireする。
- [x] **[実装済み]** ticket response時点の`DeviceNotRegistered`は即時cleanupし、Gameplay処理自身はreceiptをpollしない。
- [x] **[実装済み]** push用Supabase migration、account deletion marker、atomic anonymization RPC、deleting-account room / Socket gate、room membership直列化のmigrationとspecをリポジトリへ追加する。
- [x] **[検証済み]** local Supabase migration historyを`20260806165711_serialize_account_deletion_room_membership.sql`まで揃える。
- [x] **[検証済み]** transactional `account_anonymization`を含む全SQL self-testに成功する。
- [x] **[検証済み]** local push token register / delete smokeを完了する。

### 5.2 外部作業と検証

- [ ] **[外部作業]** `20260806090000_create_push_tokens.sql`をproduction Supabaseへ適用する。
- [ ] **[外部作業]** `20260806150938_harden_push_token_access.sql`をproduction Supabaseへ適用する。
- [ ] **[外部作業]** `20260806160844_add_account_deletion_started_at.sql`をproduction Supabaseへ適用する。
- [ ] **[外部作業]** `20260806162505_anonymize_account_references_atomically.sql`をproduction Supabaseへ適用する。
- [ ] **[外部作業]** `20260806162619_reject_deleting_room_players.sql`をproduction Supabaseへ適用する。
- [ ] **[外部作業]** `20260806165611_push_receipt_tracking.sql`をproduction Supabaseへ適用する。
- [ ] **[外部作業]** `20260806165711_serialize_account_deletion_room_membership.sql`をproduction Supabaseへ適用する。
- [ ] **[外部作業]** linked migration history、`push_tokens` / `push_receipts` table、RLS、service-role grant、push receipt RPC、atomic anonymization RPC、deleting-account room / Socket gate、room membership直列化をproductionで確認する。
- [ ] **[外部作業]** EAS project IDを作成・linkし、`app.json`の`expo.extra.eas.projectId`へ登録する。
- [ ] **[外部作業]** EAS development / preview / production environmentへSupabase URL、publishable key、backend URLを登録する。
- [ ] **[外部作業]** Expo通知が使えるEAS buildとApple APNs / Android FCMの実機資格情報を整備する。
- [ ] **[検証済み]** iOS / Android実機で許可、拒否、token登録、logout削除、game start / turn受信、tap復帰を確認する。
- [ ] **[検証済み]** 不正tokenのcleanup、送信失敗時の対局継続、通知off profileの除外をbackendと実機で確認する。
- [ ] **[未実装]** targeted / accepted / rejected / invalid / removed countをproduction observabilityへ送る。

## 6. アカウント削除とプライバシー

- [x] **[実装済み]** Settingsに`DELETE`確認入力とactive-roomエラー表示を実装する。
- [x] **[実装済み]** mobileがBearer token付き`DELETE /api/user-profile/:id`を呼び、成功後にlocal cleanupする。
- [x] **[実装済み]** backendが本人性を確認し、active room参加・hostを409でブロックする。
- [x] **[実装済み]** avatar object、room player参照、game state / history参照を削除または匿名化し、Auth userを削除する。
- [x] **[実装済み]** account API、controller、use-caseのunit/specを置く。
- [x] **[検証済み]** seat identityのserver derivation後にlocal Playwrightのfinal normal flowを再実行し、Settingsからのaccount deletion HTTP 200とsign-in redirectを確認する。
- [ ] **[検証済み]** active room参加中の409、完全なlocal cleanup、再ログイン不可をiOS / Android実端末で確認する。
- [ ] **[外部作業]** App Store Privacy Nutrition Labelsへemail、user ID、profile、game history、push tokenの収集・用途・関連付けを登録する。
- [ ] **[外部作業]** Google Play Data safety、content rating、privacy policy、terms、support URL、account deletion URLを登録する。
- [ ] **[外部作業]** ストア説明・画像で、賭博・換金要素がないことを明確にする。

## 7. EAS初回セットアップとrelease build

### 7.1 EAS / credentials

- [ ] **[外部作業]** Expo accountと請求設定、Apple Developer Team、App Store Connect、Google Play Consoleの所有者を確定する。
- [ ] **[外部作業]** EAS projectを作成・linkし、`expo.extra.eas.projectId`を設定する。
- [ ] **[外部作業]** iOS bundle IDとAndroid packageを各store consoleへ登録する。
- [ ] **[外部作業]** EAS remote version sourceのiOS build number / Android version codeを既存store値へ同期する。
- [ ] **[外部作業]** EAS `EXPO_TOKEN`をGitHubの`mobile-preview` / `mobile-production` environmentへ登録する。
- [ ] **[外部作業]** iOS distribution certificate / provisioning profile、App Store Connect API key、Android upload keystore、Google Play service accountをEAS Credentialsで設定する。
- [x] **[実装済み]** `expo-dev-client`をmobile dependencyとroot lockfileへ追加する。
- [ ] **[未実装]** OTAを使う方針を採る場合だけ、`runtimeVersion: { policy: "appVersion" }`相当と`updates.url`を設定する。設定前は`eas update`を実行しない。

### 7.2 Preview gate

- [ ] **[検証済み]** `mobile-release.yml`を`profile=preview`、`platform=all`、`submit=false`で起動する。
- [ ] **[検証済み]** preview iOS / Android buildが署名済みで生成される。
- [ ] **[検証済み]** preview buildをiPhoneとAndroid実機へインストールし、ログインから1ゲーム完了する。
- [ ] **[検証済み]** background、回線切替、通知tap、退会エラーと成功、次roundをpreview buildで確認する。
- [ ] **[検証済み]** 問題のbuild ID、runtime、channel、端末、OS、結果、既知の不具合を記録する。

## 8. TestFlight / Google Play内部テスト

これは現在未実施の外部ゲートであり、完了までストア公開を主張しない。

### iOS TestFlight

- [ ] **[外部作業]** production iOS buildを`main`からEASで作成する。
- [ ] **[外部作業]** `mobile-release.yml`を`profile=production`、`platform=ios`、`submit=true`で起動する。
- [ ] **[外部作業]** App Store Connectでprocessing、export compliance、Missing Compliance、beta informationを完了する。
- [ ] **[検証済み]** Internal Testing groupへ配布し、実機でlogin、room deep link相当の通知tap、background復帰、push、1ゲーム完了を確認する。
- [ ] **[検証済み]** crash、起動不能、認証不能、対局停止がないことを記録する。

### Android Play internal

- [ ] **[外部作業]** production Android buildを`main`からEASで作成する。
- [ ] **[外部作業]** `mobile-release.yml`を`profile=production`、`platform=android`、`submit=true`で起動する。submit先は`internal` track。
- [ ] **[外部作業]** Play Consoleでversion code、AAB、target SDK、Data safety、content ratingを確認する。
- [ ] **[検証済み]** tester listへ配布し、実機でback gesture、login、JWT refresh、回線切替、次round、game over、通知を確認する。
- [ ] **[検証済み]** crash、起動不能、認証不能、対局停止がないことを記録する。

## 9. 最終リリース判定

次のすべてを満たすまで、production submitやstore review submissionを開始しない。

- [x] localでmobile lint / typecheck / 14 suites / 63 tests / Expo Doctor 19/19 / iOS export / Android exportが成功している。
- [x] localでbackend 52 suites / 300 tests、frontend 27 suites / 78 tests、両方のlint / buildが成功している。
- [ ] Expoの`xcode`→`uuid`経路に残るmoderate advisory 10件をupstream更新時に再評価する。high / criticalは0件で、Expo downgradeを伴う強制fixは適用しない。
- [ ] shared contractのWeb・backend・mobile棚卸しが完了し、backend互換性を確認している。
- [ ] production migrationsが`20260806165711`まで適用され、schema / RLS / receipt worker RPC / atomic anonymization / deleting-account room・Socket gate / room membership直列化 / registration smokeを確認している。
- [ ] EAS project ID、EAS environments、`EXPO_TOKEN`、Apple / Google署名・提出資格情報が設定されている。
- [ ] preview buildをiOS / Android実機で受入し、TestFlight / Play internal buildを各1回実施している。
- [ ] background、process kill、回線切替、Web + mobile混在、COM置換、次roundを実機で確認している。
- [ ] pushの許可・拒否・受信・tap・logout削除を実機で確認している。
- [ ] account deletionをactive-room拒否と成功の両ケースで確認している。
- [ ] privacy、data safety、content rating、support、account deletion、store素材が登録済みである。

判定が未完了の場合、このbranchで確認できるのは「実装、ローカル自動検証、browser smoke、JavaScript export」までであり、署名済みbuild、ストアリリース済み、審査提出済み、本番push稼働済みとは記載しない。
