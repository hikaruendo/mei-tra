# Supabase Migration Guide

このガイドでは、明専トランプのバックエンドをインメモリストレージからSupabaseに移行する手順について説明します。

## 前提条件

1. Supabaseアカウントの作成
2. 新しいSupabaseプロジェクトの作成
3. データベースアクセス情報の取得

## 環境の設定（開発・本番）

このプロジェクトでは開発環境と本番環境でSupabaseを使い分けています：

- **開発環境**: ローカル開発用のSupabaseプロジェクト
- **本番環境**: fly.io + 本番用Supabaseプロジェクト

`NODE_ENV`の値に基づいて自動的に適切な環境設定が選択されます。

## 移行手順

### Step 1: Supabaseプロジェクトの設定

**開発環境と本番環境で別々のSupabaseプロジェクトを作成することを推奨します。**

1. [Supabase](https://supabase.com/)にアクセスしてプロジェクトを作成
2. プロジェクトの設定画面から以下の情報を取得:
   - Project URL
   - anon public key
   - service_role key

### Step 2: 環境変数の設定

#### 開発環境の設定（ローカルSupabase）

**推奨**: ローカルSupabase CLI + Dockerを使用してコストを抑制

```bash
# Supabase CLIでローカル環境を起動
supabase start

# .env.developmentファイル（既に設定済み）
# Supabase Configuration - Local Development (Docker)
SUPABASE_URL_DEV=http://localhost:54321
SUPABASE_ANON_KEY_DEV=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SUPABASE_SERVICE_ROLE_KEY_DEV=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU

NODE_ENV=development
PORT=3333
```

**ローカル開発の利点**:
- 追加コストなし（Supabaseの2プロジェクト制限を回避）
- オフライン開発が可能
- 高速なリセット・テストが可能

#### 本番環境の設定

本番環境では環境変数をfly.ioまたはCI/CDで設定:

```bash
# 本番環境で必要な環境変数
SUPABASE_URL_PROD=your-production-supabase-project-url
SUPABASE_ANON_KEY_PROD=your-production-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY_PROD=your-production-supabase-service-role-key
NODE_ENV=production
```

### Step 3: データベーススキーマの作成

#### ローカル開発環境
マイグレーションファイルが自動適用されるため、追加作業不要:
```bash
# スキーマは supabase/migrations/001_initial_schema.sql に配置済み
# supabase start 実行時に自動適用される
```

#### 本番環境
Supabaseダッシュボードの SQL Editor で以下のスクリプトを実行:

```sql
-- database/schema.sql の内容をコピー＆ペースト
```

### Step 4: アプリケーションの起動

#### ローカル開発環境
```bash
# 1. ローカルSupabaseを起動
supabase start

# 2. アプリケーションを起動
npm install
npm run start:dev

# アクセス可能なURL:
# - アプリケーション: http://localhost:3001
# - Supabase Studio: http://localhost:54323
# - Supabase API: http://localhost:54321
```

#### 開発完了後のクリーンアップ
```bash
# ローカルSupabaseを停止
supabase stop
```

## 設計の特徴

### Repository Pattern

- **インターフェース**: `IRoomRepository`, `IGameStateRepository`
- **実装**: `SupabaseRoomRepository`, `SupabaseGameStateRepository`
- **DI**: NestJSの依存性注入でリポジトリを注入

### データ永続化戦略

1. **Room管理**: PostgreSQLテーブルで永続化
2. **GameState**: JSONB形式でフレキシブルに保存
3. **Player情報**: 正規化されたテーブル構造
4. **History**: ゲーム履歴の追跡（将来の拡張用）

### Fallback機能

- データベース接続エラー時はインメモリで継続動作
- 段階的移行が可能な設計
- 既存機能への影響を最小化

## 移行後の確認事項

### 基本機能テスト

1. **ルーム作成・参加**
   ```bash
   # フロントエンドから新規ルーム作成
   # 他のプレイヤーでルーム参加
   ```

2. **ゲーム開始・プレイ**
   ```bash
   # 4人プレイヤーでゲーム開始
   # ブロー・プレイフェーズの実行
   ```

3. **再接続テスト**
   ```bash
   # ブラウザリフレッシュで再接続確認
   # サーバー再起動後の状態復元確認
   ```

### データ確認

Supabaseダッシュボードでデータの永続化を確認:

```sql
-- ルーム一覧
SELECT * FROM rooms;

-- プレイヤー情報
SELECT * FROM room_players;

-- ゲーム状態
SELECT * FROM game_states;
```

## トラブルシューティング

### よくある問題

1. **環境変数が読み込まれない**
   - **開発環境**: `.env.development`ファイルの配置・権限確認
   - **本番環境**: fly.ioの環境変数設定確認（`flyctl secrets list`）
   - 環境変数の命名確認（`_DEV`/`_PROD`サフィックス）

2. **環境の切り替えがうまくいかない**
   - `NODE_ENV`の値確認（`development`/`production`）
   - 設定ファイルの読み込み順序確認
   - アプリケーション再起動

3. **データベース接続エラー**
   - 各環境のSupabase URLとキーの確認
   - RLSポリシーの確認
   - 環境別プロジェクト設定の確認

4. **型エラー**
   - Database型定義の確認
   - Supabaseクライアントのバージョン確認

### 環境確認方法

```bash
# 現在の環境設定確認
console.log('Current NODE_ENV:', process.env.NODE_ENV);
console.log('Supabase URL:', process.env.NODE_ENV === 'development' ? process.env.SUPABASE_URL_DEV : process.env.SUPABASE_URL_PROD);
```

### ログ確認

```bash
# アプリケーションログ
npm run start:dev

# エラーログの確認
# コンソールの "Failed to persist" メッセージを確認
```

## 本番デプロイメント

### fly.ioでの環境変数設定

```bash
# fly.ioに本番環境変数を設定
flyctl secrets set SUPABASE_URL_PROD=your-production-supabase-url
flyctl secrets set SUPABASE_ANON_KEY_PROD=your-production-anon-key
flyctl secrets set SUPABASE_SERVICE_ROLE_KEY_PROD=your-production-service-role-key
flyctl secrets set NODE_ENV=production

# 設定確認
flyctl secrets list
```

### デプロイ手順

```bash
# アプリケーションをビルド・デプロイ
flyctl deploy

# デプロイ状況確認
flyctl status
flyctl logs
```

### セキュリティ考慮事項

1. **環境変数の管理**
   - 本番環境変数は`.env.production`に直接記載しない
   - fly.ioのsecrets機能またはCI/CD環境変数を使用

2. **データベースアクセス制御**
   - 本番SupabaseのRLSポリシーを適切に設定
   - service_role_keyの取り扱いに注意

## 次のステップ

1. **パフォーマンス最適化**
   - クエリの最適化
   - インデックスの追加

2. **Redis統合**
   - アクティブゲーム状態のキャッシュ
   - スケーリング対応

3. **監視・アラート**
   - Supabaseダッシュボードでの監視
   - エラーアラートの設定

## 移行完了

Supabaseへの移行が正常に完了し、以下の機能が動作確認済みです:
- ルーム作成・参加
- プレイヤーの準備状態管理
- ゲーム状態の永続化
- リアルタイム通信

元のインメモリ実装はgitの履歴から参照可能です。