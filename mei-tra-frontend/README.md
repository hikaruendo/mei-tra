# mei-tra-frontend

明専トランプの Next.js App Router frontend です。

## 現在の UI 導線

- プレイ中の realtime UI
  - ルーム参加、ready、ゲーム開始、プレイ進行、チャット
- プロフィール
  - 自分の stats / account info
  - **最近の対局** 一覧
- 対局ログ詳細
  - `/{locale}/game-history/[roomId]`
  - replay / audit の詳細ページ

対局ログの主導線は、プレイ中の `GameDock` ではなく **プロフィールの recent matches** です。

## 現在の主要 state / contract 方針

- room/player 同期の主系統は `room-sync`
- `room-updated` / `update-players` は互換 fallback
- transport 契約は `contracts/`、UI view model は `types/` に分けています

## 開発

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開きます。

## 主要ページ

- `/[locale]`
  - lobby / room / game のメイン画面
- `/[locale]/profile`
  - プロフィール画面
- `/[locale]/game-history/[roomId]`
  - 対局ログ詳細ページ

## テスト / 品質確認

```bash
npm run lint
npm test -- --runInBand
npm run build
```
