# 明専トランプ (Mei-Tra)

オンライン対戦型トランプゲーム「明専トランプ」の実装です。

## 概要

明専トランプは、4人2チームで対戦するトランプゲームです。このプロジェクトでは、そのオンライン版を実装しています。

- プレイ可能: https://meitra.kando1.com/
- フロントエンド: Next.js
- バックエンド: NestJS
- 通信: WebSocket

最近の主要な設計方針は次の通りです。

- 外側は Next.js / NestJS の標準的な module、route、controller、gateway、DI に乗せる。一方で、ゲームの正しさに直結する `CardService` / `BlowService` / `PlayService` / `ScoreService` / `ChomboService` / `GamePhaseService` は domain層として扱い、UI・Socket・DB へ散らさない
- room/player 同期は `room-sync` を主系統にし、`room-updated` / `update-players` は互換 fallback として維持する
- 対局ログは `game_history` を write/read side の両方で使い、**プレイ中 UI ではなくプロフィールの「最近の対局」から詳細ページへ入る**

## リポジトリ構成

- `mei-tra-frontend/`: Next.js App Router の frontend。本番 UI、認証 UI、プロフィール、チュートリアルを持つ。`components/` は `game/`, `room/`, `shared/`, `auth/`, `social/` など feature 単位で整理している
- `mei-tra-backend/`: NestJS backend。ゲーム進行、Socket.IO、profile API、game-history API、chat API、Supabase 永続化を持つ
- `contracts/`: frontend / backend が共有する transport 契約。REST DTO と Socket.IO payload のみを置く
- `docs/developer-guide/`: 現行 `main` を読むための開発者向けドキュメント群
- `docs/architecture/game-core-design-and-realtime-scaling.md`: domain層を中心にゲームルール周辺を厚く守る設計方針と realtime 接続数の判断ライン

型の責務は次のように分けています。

- `contracts/`: wire 契約
- `mei-tra-frontend/types/`: UI state / view model
- `mei-tra-backend/src/types/`: domain / persistence / internal service types

## 技術スタック

### フロントエンド
- Next.js
- TypeScript
- SCSS
- Socket.IO Client

### バックエンド
- NestJS
- TypeScript
- Socket.IO
- Jest (テスト)

## 開発環境のセットアップ

### 必要条件
- Node.js (v18以上)
- npm または yarn
- Docker Desktop（Supabaseローカル環境用）
- Supabase CLI

#### 初回起動時のみ
```bash
# Supabaseを起動（1回だけ）
cd mei-tra-backend
npm run supabase:start
```

#### 通常の開発作業
```bash
# バックエンド
cd mei-tra-backend
bash scripts/create-test-users.sh  # テストユーザー作成
npm run start:dev  # ファイル変更を自動検知してリロード

# フロントエンド
cd mei-tra-frontend
npm run dev  # ファイル変更を自動検知してリロード
```

#### Supabaseを再起動が必要な場合

以下の場合のみSupabaseの操作が必要：

データベーススキーマを変更した場合
```bash
# 新しいマイグレーションファイルを作成した場合
supabase db reset  # データベースをリセットして最新のスキーマを適用
# または
supabase db push   # 現在のマイグレーションを適用
```

Supabase設定ファイル（supabase/config.toml）を変更した場合
```bash
supabase stop
npm run supabase:start
```

#### 開発終了時
```bash
# 開発が終わったらSupabaseを停止（Dockerリソース節約）
supabase stop
```

## テスト

### バックエンドテスト

```bash
cd mei-tra-backend

# ユニットテスト（個別の関数・サービスのテスト）
npm test                    # 全ユニットテスト実行
npm run test:watch         # ファイル変更を監視してテスト実行
npm run test:cov           # カバレッジ付きでテスト実行

# E2Eテスト（アプリケーション全体の統合テスト）
npm run test:e2e           # WebSocket通信、API呼び出しなど全体テスト

```

### フロントエンドテスト

```bash
cd mei-tra-frontend

# E2Eテスト（Playwright）
npx playwright test                              # 全E2Eテスト実行
npx playwright test __tests__/tutorial.e2e.test.ts  # 特定ファイルのみ実行
npx playwright test --headed                     # ブラウザ表示で実行
npx playwright test --debug                     # デバッグモードで実行

# 注意: フロントエンドが起動している必要があります（npm run dev）
```

### テスト種類の説明

- **ユニットテスト**: 個別の関数やサービスの動作確認（`*.spec.ts`）
- **E2Eテスト**: アプリケーション全体の統合テスト（`*.e2e-spec.ts`）
  - WebSocket通信のテスト
  - API呼び出しのテスト
  - 実際のユーザー操作の模擬テスト

### codex
Web検索を有効化
```bash
codex --search
```

## ライセンス

MIT License - 詳細は [LICENSE](LICENSE) を参照してください。

## 貢献

プロジェクトへの貢献を歓迎します。IssueやPull Requestをお待ちしています。

## 作者

Hikaru Endo とその友人
