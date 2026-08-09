# Meitra Mobile リリースランブック

対象: `mei-tra-mobile/` の Expo SDK 55 / EAS Build 運用

## 1. 現在の前提

このランブックは、Web版と同じ Supabase Auth、Socket.IO backend、`@meitra/contracts`、`@meitra/game-client` を利用するネイティブアプリを対象にする。EASの責務は、JavaScriptの品質確認、署名済みiOS/Androidバイナリの作成、TestFlight / Google Play内部テストへの提出である。

現行の `app.json` は次の識別子とバージョンを持つ。

- iOS bundle identifier: `com.kando1.meitra`
- Android package: `com.kando1.meitra`
- app version: `0.1.0`
- orientation: `portrait`

このリリース設定では `development` / `preview` / `production` のEAS環境と同名channelを定義している。ただし、現行 `app.json` には `expo.extra.eas.projectId`、`expo.runtimeVersion`、`expo.updates.url` がまだないため、EAS Updateは意図的に実行しない。channel設定だけでOTAが有効になるわけではない。

development buildには、SDK 55対応の公式パッケージ `expo-dev-client` を利用する。`mei-tra-mobile/package.json` とrootの `package-lock.json` に依存関係を反映した状態で、development profileを実行できる。

### 2026-07-24 ローカル検証済み基準

- npm `10.9.2`のclean installで、root workspacesの`mei-tra-mobile`、`@meitra/contracts`、`@meitra/game-client`を解決した。
- mobileは14 suites / 63 tests、lint、typecheck、Expo Doctor 19/19、iOS / Android exportに成功した。
- backendは52 suites / 300 tests、lint、buildに成功した。
- frontendは27 suites / 78 tests、lint、buildに成功し、Web dev serverはHTTP 200を返した。
- local Supabase migration historyは`20260806165611_push_receipt_tracking.sql`と`20260806165711_serialize_account_deletion_room_membership.sql`を含む`20260806165711`まで適用し、push token register / delete smokeに成功した。
- transactional `account_anonymization`を含む全SQL self-testに成功した。
- seat identityのserver derivation後に390×844のPlaywright final normal flowを再実行し、signup、room作成、COM補充、shuffle、start、blow pass、合法card play、reload後のauthoritative restore、leave、settings/legal links、account deletion HTTP 200と成功後redirect、parameterなしcallbackの安全なredirectを確認した。
- active game reloadでは、標準のdevelopment情報を除きerror / warnを検出していない。
- `npm audit --omit=dev`はExpoの`xcode`→`uuid`依存経路でmoderate 10件、high / critical 0件を報告した。Expo downgradeを伴う強制fixは適用せず、upstream dependency review項目として残す。

これはローカルbrowser / exportの検証結果である。EAS upload archive、署名済みpreview、TestFlight / Play、実端末push、background / foreground、実回線切替は含まない。

### Push receipt worker運用値

- workerは30秒ごとに起動し、accepted ticketのreceiptだけをqueryする。Gameplay処理自身はreceiptをpollしない。
- queryは初回をおよそT+15分、その後をT+20 / 35 / 65 / 125 / 245 / 485 / 965分で行う。worker起動による最大約30秒のjitterを許容する。
- 最大8回、最終queryのおよそ16時間5分でExpo receipt retention内に`expired`とする。ticket response時点の`DeviceNotRegistered`はreceipt待ちにせず即時にtokenを削除する。
- これらは実装・local test済みの値であり、production migration適用、Expo実配送、監視確認は外部ゲートである。

## 2. EAS profile

設定は `mei-tra-mobile/eas.json` にある。

| profile | 用途 | 配布 | EAS environment | channel |
| --- | --- | --- | --- | --- |
| `development` | Dev Clientでの開発 | internal | development | development |
| `preview` | 実機・関係者の受入確認 | internal | preview | preview |
| `production` | ストア向け署名済みビルド | store | production | production |

productionはEASのremote app version sourceとbuild number自動増分を使う。初回だけEAS上のiOS build number / Android version codeを、ストアに存在する最後の値へ同期する。app version (`0.1.0`)自体はproduction releaseのたびに、別のアプリ設定変更として明示的に更新する。

### CIの起動

品質CIはモバイルコード、共有 `contracts/`、共有 `shared/game-client/`、npm workspace metadata、またはworkflow変更時に自動実行する。

```bash
gh workflow run mobile-release.yml \
  --ref main \
  -f profile=preview \
  -f platform=all \
  -f submit=false
```

productionは `main` からのみ起動できる。`submit=true` の場合はproduction profileだけが許可され、build完了後に同じsubmit profileで提出する。

## 3. 初回EASセットアップ

以下はプロジェクトオーナーが一度だけ行う。値はGitへコミットしない。

1. Expoアカウント、Apple Developer、Google Play Consoleの所有者・請求設定を確認する。
2. `mei-tra-mobile` でEASプロジェクトを作成・リンクし、`app.json` に `expo.extra.eas.projectId` を登録する。
3. iOSのbundle identifierとAndroid packageを、それぞれApp Store Connect / Play Consoleに同じ値で登録する。
4. EASでremote version sourceを初期化する。

```bash
cd mei-tra-mobile
npm ci
npm run validate:eas-monorepo
npx eas-cli@21.1.0 build:version:set --platform ios --profile production
npx eas-cli@21.1.0 build:version:set --platform android --profile production
```

既存ストアアプリがある場合は、現在ストアにあるbuild number / version codeを入力する。新規アプリなら初回値を1から始める。

5. OTAを有効化する場合は、実装側で `expo.runtimeVersion` を設計どおり `appVersion` policyにし、`expo.updates.url` をEAS projectへ紐付ける。現行の変更範囲ではここを自動変更しない。

## 4. EAS環境変数

EAS DashboardまたはEAS CLIの `development` / `preview` / `production` 環境に、次の3つを登録する。

```bash
npx eas-cli@21.1.0 env:create --name EXPO_PUBLIC_SUPABASE_URL \
  --value 'https://<project>.supabase.co' --environment production --visibility plaintext
npx eas-cli@21.1.0 env:create --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY \
  --value '<publishable-key>' --environment production --visibility sensitive
npx eas-cli@21.1.0 env:create --name EXPO_PUBLIC_BACKEND_URL \
  --value 'https://<backend-host>' --environment production --visibility plaintext
```

previewとdevelopmentには、それぞれ接続先に対応する値を登録する。`EXPO_PUBLIC_*` はアプリに埋め込まれるため、publishable key以外の秘密値やservice role keyを絶対に登録しない。Supabase service role key、DB password、`EXPO_TOKEN`はアプリ環境変数に入れない。

GitHub Actionsには、選択したGitHub Environmentへ `EXPO_TOKEN` をsecretとして登録する。production environmentには必須レビュー担当者を設定し、preview/developmentの権限と分離する。EASの環境変数はEAS Build側で解決されるため、GitHub Actionsへ公開値を複製する必要はない。

## 5. 署名・提出資格情報

EAS Credentialsで管理し、証明書や秘密鍵をリポジトリへ保存しない。

- iOS: Apple Developer Team、distribution certificate、App Store provisioning profile。
- App Store Connect: API key、issuer ID、key ID。TestFlight提出権限を持つApp Store Connectユーザーで検証する。
- Android: upload keystore。Play Consoleの既存アプリでは既存upload keyを壊さない。
- Google Play: Play Console API service account。対象アプリへのrelease権限だけを付与する。
- 失効・更新手順: credential更新後にpreview buildを作成し、iOS/Android実機へインストールしてからproductionへ進む。

CIの `--freeze-credentials` は、CIが署名資格情報を自動更新しないための安全弁である。資格情報が未設定なら、CIを通すために無理に秘密値をコミットせず、EAS Credentials側を先に整備する。

## 6. リリース前チェックリスト

### コードと接続

- [x] npm `10.9.2`のclean installがroot lockfileと一致する。
- [x] root workspace lockfileで`@meitra/contracts`と`@meitra/game-client`を解決する。
- [x] mobileのlint、typecheck、14 suites / 63 tests、Expo Doctor 19/19が成功する。
- [x] iOS / AndroidのJavaScript exportが成功する。
- [x] backendの52 suites / 300 tests、lint、buildが成功する。
- [x] frontendの27 suites / 78 tests、lint、buildが成功し、Web dev serverがHTTP 200を返す。
- [x] `npm audit --omit=dev`でmoderate 10件、high / critical 0件を確認する。
- [ ] Expoの`xcode`→`uuid`経路に残るmoderate advisoryをupstream dependency更新で再評価する。Expo downgradeを伴う強制fixは適用しない。
- [ ] release候補commitで`npm run validate:eas-monorepo`を再実行し、結果を記録する。
- [ ] Expoログイン後、`npx eas-cli@21.1.0 build:inspect -p android -s archive -o /tmp/meitra-eas-archive --profile preview --force` でEAS upload archiveに `package.json`、`package-lock.json`、`contracts/`、`shared/game-client/` が含まれることを確認する。
- [x] seat identityのserver derivation後に390×844 browser smokeのfinal normal flowを再実行し、signup、room作成、COM補充、shuffle、game startを確認する。
- [x] 390×844 browser smokeでblow pass、合法card play、reload後のauthoritative restore、leaveを確認する。
- [ ] Web / mobile混在、human→COM置換、トリック完了、次ラウンド、ゲーム終了を確認する。
- [ ] background復帰、アプリkill後復帰、Wi-Fi/モバイル回線切替、WebSocket失敗時のpolling fallbackを確認する。
- [ ] 最新JWTで再接続し、古いsocket IDを本人判定に使わないことを確認する。
- [ ] production backend、Supabase Auth redirect、CORS、health endpointを確認する。
- [x] local migration historyを`20260806165711`まで揃え、transactional `account_anonymization`を含む全SQL self-testに成功する。
- [ ] production Supabaseへ`20260806160844_add_account_deletion_started_at.sql`、`20260806162505_anonymize_account_references_atomically.sql`、`20260806162619_reject_deleting_room_players.sql`、`20260806165611_push_receipt_tracking.sql`、`20260806165711_serialize_account_deletion_room_membership.sql`を適用し、linked history、schema、RLS、receipt RPC、atomic RPC、room / Socket gate、room membership直列化を確認する。

### プライバシーとアカウント

- [ ] App Store ConnectのPrivacy Nutrition Labelsに、メール、ユーザーID、プロフィール、ゲーム履歴、push tokenの収集・用途・関連付けを実装内容どおり登録する。
- [ ] Google Play Data safetyに同じデータ分類、共有先、削除方針を登録する。
- [x] seat identityのserver derivation後のlocal Playwrightでaccount deletionがHTTP 200を返し、成功後にsign-inへredirectすることを確認する。
- [x] local Playwrightでsettingsのprivacy / terms / support linkを確認する。
- [ ] active room拒否、実端末、production dataでaccount deletionの削除・匿名化結果を確認する。
- [ ] プライバシーポリシー、利用規約、サポートURL、アカウント削除URLをstore metadataへ登録する。
- [ ] 賭博・換金要素がないことを説明文とスクリーンショットで明確にする。

account deletionの実装とlocal成功経路は確認済みである。ただし、active room拒否、production data、実端末、store metadataの確認が完了するまで、審査提出ゲートは閉じたままにする。

## 7. TestFlight / Play内部テスト

### TestFlight

1. GitHub Actionsの `mobile-release.yml` を `profile=production`、`platform=ios`、`submit=true` で `main` から起動する。
2. App Store Connectでbuild processing、export compliance、Missing Compliance、beta app informationを確認する。
3. Internal Testing groupへチームを追加し、実機release buildを配布する。
4. 招待、ログイン、room deep link、background復帰、通知、1ゲーム完了を実機で確認する。
5. crash、起動不能、認証不能、対局停止がないことを確認してから外部テスターへ広げる。

### Google Play内部テスト

1. `profile=production`、`platform=android`、`submit=true` でbuildを作成する。submit profileは `internal` trackへ送る。
2. Play Consoleでversion code、AAB、target SDK、Data safety、content ratingを確認する。
3. Internal testingのtester listへ追加し、招待URLから実機へインストールする。
4. back gesture、回線切替、JWT refresh、次ラウンド、ゲーム終了を確認する。
5. 問題がなければ、段階的にclosed testingまたはproductionへ昇格する。

## 8. OTAとnative変更のルール

現在は `runtimeVersion` / `updates.url` 未設定のため、`eas update` を実行しない。将来OTAを有効化した後も、次を守る。

- JavaScript、文言、純粋なレイアウト修正だけを、同じruntime versionのchannelへ公開する。
- Expo SDK、React Native、Expo module、native config、permissions、bundle identifier、`app.json` のnative関連変更はOTAで配信しない。runtime versionを上げ、iOS/Androidのproduction buildを作成する。
- `eas update` にはbuildと同じ `--environment` を指定する。
- preview buildで検証してからproduction channelへ公開する。productionは最初から100%にせず、可能ならrolloutを使う。
- OTA更新の前後で、起動、ログイン、Socket.IO handshake、カード表示、1トリック完了を確認する。
- OTAが起動不能または対局停止を起こした場合は、直ちに前回の正常なupdateへrollbackし、必要ならembedded updateへ戻す。その後、同じruntimeで再配布せず、原因修正とpreview検証を行う。

## 9. ロールバック

- EAS Build中: EAS dashboardまたは `eas build:cancel` で停止し、署名・設定を修正して再ビルドする。
- TestFlight / Play内部テスト: 問題のbuildをtester配布から外し、直前の正常buildを再配布する。ストア公開後はストア側の段階的公開・撤回方針に従う。
- OTA: 同じruntimeの直前の正常updateへrollbackする。native module変更をOTAで直そうとしない。
- backend互換性: mobileを先に配布せず、既存Web clientと新mobileの両方を受け入れるbackendを先にproductionへ出す。wire contractを壊す変更は、backend → mobile binaryの順で段階移行する。
- すべてのrollbackで、対象build/update ID、runtime version、channel、原因、再発防止テストを記録する。

## 10. 現時点の外部ブロッカー

このリポジトリ内のリリース設定だけでは解消できない項目は次のとおり。

1. EAS login未実施、`app.json`のEAS `projectId`未登録。
2. EAS environment、`EXPO_TOKEN`、iOS / Android署名・提出資格情報が未設定または未確認。
3. production Supabase migrationはこのworktreeから未適用・未検証。localではpush receipt trackingとaccount deletion room membership直列化を含む`20260806165711`まで適用済み。productionへ`20260806165611_push_receipt_tracking.sql`と`20260806165711_serialize_account_deletion_room_membership.sql`を適用・確認する必要がある。
4. `eas build:inspect`、署名済みpreview build、TestFlight / Play内部テストを未実施。
5. 実端末のpush token取得・通知受信・通知tap、background / foreground、process kill、Wi-Fi / mobile回線切替を未実施。
6. `app.json`の`runtimeVersion` / `updates.url`未設定。OTAを開始する場合にだけ設計・追加する。
7. `npm audit --omit=dev`のmoderate 10件はExpoの`xcode`→`uuid`経路に残る。high / criticalは0件だが解消済みとはせず、Expoをdowngradeしないupstream dependency更新を確認する。

これらが未完了の間は、ローカルtest・build・export・browser smokeの成功を「ストアリリース可能」と解釈しない。exportはJavaScript bundleの検証であり、署名、EAS project、store metadata、実機対局、審査要件の代替ではない。
