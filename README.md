# 明専トランプ (Mei-Tra)

オンライン対戦型トランプゲーム「明専トランプ」の実装です。

## 概要

明専トランプは、4人2チームで対戦するトランプゲームです。このプロジェクトでは、そのオンライン版を実装しています。

- プレイ可能: https://mei-tra-frontend.vercel.app/
- フロントエンド: Next.js
- バックエンド: NestJS
- 通信: WebSocket

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
supabase start
```

#### 通常の開発作業
```bash
# バックエンド
cd mei-tra-backend
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
supabase start
```

#### 開発終了時
```bash
# 開発が終わったらSupabaseを停止（Dockerリソース節約）
supabase stop
```

## ライセンス

MIT License - 詳細は [LICENSE](LICENSE) を参照してください。

## 貢献

プロジェクトへの貢献を歓迎します。IssueやPull Requestをお待ちしています。

## 作者

Hikaru Endo とその友人
