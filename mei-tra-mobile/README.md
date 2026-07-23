# Meitra Mobile

Expo / React Native で実装した Meitra のモバイル版です。既存の
NestJS + Socket.IO backend、Supabase Auth、ルート `contracts/` を
Web版と共有します。
EAS / Expo の依存解決はnpm workspacesを使い、`@meitra/contracts` と
`@meitra/game-client` を sibling package として取り込みます。

## 対応機能

- メール / パスワード登録・ログイン
- Google OAuth
- ルーム一覧、作成、参加、対局中の観戦
- 待機室、準備、COM追加、チームシャッフル、ゲーム開始
- 吹き、アゲ表示、ネグリ選択、カードプレイ、台札スート選択
- 得点、獲得ペア、ゲーム終了表示
- JWT更新、Socket.IO再接続、ルーム復帰
- 接続状態、オフライン、再同期中の表示と再試行導線
- 対局開始・手番のプッシュ通知、通知タップからのルーム復帰
- 通知トークンの端末単位登録・ログアウト時削除
- DELETE入力で確認するアカウント削除と参加中ルームのエラー表示
- safe area、キーボード、画面読み上げを考慮した操作UI
- 待機室・吹き・カード操作の二重送信防止と処理中表示

## セットアップ

```bash
cd mei-tra-mobile
npm install
cp .env.example .env.local
npm run ios
```

`npm install` は、npm workspacesによりリポジトリルートの
`../package-lock.json` を更新・使用します。`mei-tra-mobile/package-lock.json`
は作らず、EAS Buildでも同じroot lockfileで依存関係を解決します。

`.env.local` に次を設定します。

```dotenv
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
EXPO_PUBLIC_BACKEND_URL=...
```

実機からローカルbackendへ接続する場合、`localhost`ではなくMacのLAN
IPを`EXPO_PUBLIC_BACKEND_URL`へ設定してください。

Googleログインを使う場合は、Supabase AuthのRedirect URLsへ
`meitra://auth/callback`を追加します。

通知を使うには、実機のEASビルドへExpo Notificationsを含め、EASの
`projectId`を`app.json`の`extra.eas.projectId`へ設定してください。シミュレーター、
Web、通知拒否時は対局を継続できますが、プッシュ通知は登録されません。

## 検証

```bash
npm run typecheck
npm run lint
npm test
npm run validate:eas-monorepo
npm run doctor
npm run export:ios
npm run export:android
```

実機配布前に、iOSとAndroidの実機で次のシナリオを確認します。

- ログイン、Googleログインのキャンセル、ログアウト、アプリ再起動後のセッション復元
- 通知許可、通知拒否、シミュレーターでの起動、ログアウト前のトークン削除
- 通知タップで対象ルームを開くこと、未ログイン時のタップがログイン後に復帰すること
- アカウント削除の確認入力、active-roomエラー時の状態保持、成功時の完全なローカル掃除
- 待機室で準備、COM追加、チームシャッフル、ゲーム開始を連続タップしても一度だけ実行されること
- 吹き、ネグリ、Jokerを含むカードプレイ、台札スート選択、獲得ペアと得点表示
- 対局中にバックグラウンド化、回線切替、機内モードを行い、復帰後に最新状態へ戻ること
- ノッチ端末、320pt幅の縦画面、キーボード表示中でも主要ボタンが隠れないこと

アプリはリアルタイム対局を前提とし、オフライン中にゲーム操作をローカル確定しません。再接続後にサーバーのスナップショットを正とします。

## 設計境界

- `src/context/AuthContext.tsx`: Supabase sessionとプロフィール
- `src/context/GameContext.tsx`: Socket.IO接続とゲームスナップショット
- `src/components/game/`: React Native専用UI
- `@meitra/contracts`: Web / backend / mobile共通のwire contract
- `@meitra/game-client`: mobileでも使う副作用のないゲームルール補助

WebのReact componentやhookは共有せず、transport contractと副作用の
ないルール補助だけを共有します。

## リリースシェルの境界

- `src/app/**` と `src/components/**` は、サーバー状態を表示し、入力を既存のContext APIへ渡すだけにします。
- プロフィール画面は現在読み取り専用です。プロフィール編集・退会APIが整備されるまで、モバイル側に編集ボタンを表示しません。
- ルーム復帰の可否、手番、合法手、得点、勝敗は常にバックエンドの状態で確定します。
- `app.json` にExpo初期テンプレートのアイコン・favicon・splash画像は参照しません。正式なMeitraブランドアセットが用意できたら、別のアセット変更として追加します。
