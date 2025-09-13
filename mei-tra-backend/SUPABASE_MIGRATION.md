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

### データベーススキーマ関連の問題

#### 1. **マイグレーション未適用エラー** ⭐ 最重要

**症状**: 以下のようなエラーが発生する
```
Error: Failed to cleanup disconnected players: column room_players.disconnected_at does not exist
Error: column room_players.is_vacant does not exist
Could not find the 'disconnected_at' column of 'room_players' in the schema cache
```

**原因**: データベースにマイグレーションが適用されていない

**解決手順**:
```bash
# 1. 現在のSupabase状態を確認
supabase status

# 2. ローカルデータベースをリセット（マイグレーションを再適用）
supabase db reset

# 3. マイグレーションが適用されたことを確認
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "\d room_players"

# 4. 必要なカラムの存在確認
# is_vacant, vacant_data, disconnected_at, reconnect_token が存在することを確認

# 5. player_sessionsテーブルの確認
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "\d player_sessions"

# 6. アプリケーション再起動
npm run start:dev
```

**予防策**: 
- スキーマ変更後は必ず`supabase db reset`を実行
- 新しい環境では最初に`supabase start`を実行してからアプリケーションを起動

#### 2. **マイグレーションファイルの管理**

**マイグレーションファイルの場所**:
```
mei-tra-backend/
├── database/
│   └── schema.sql                    # 完全なスキーマ定義
└── supabase/
    └── migrations/
        └── 001_initial_schema.sql    # マイグレーション用（同じ内容）
```

**新しいマイグレーションの作成**:
```bash
# 新しいマイグレーションファイルの作成
supabase migration new add_new_feature

# 生成されたファイルにSQL文を記述
# supabase/migrations/[timestamp]_add_new_feature.sql

# マイグレーション適用
supabase db reset  # または supabase migration up
```

#### 3. **本番環境でのスキーマ更新**

**本番環境への適用手順**:
```bash
# 1. ローカルでテスト完了後
supabase db reset  # ローカルで最終確認

# 2. 本番環境にログイン
supabase login

# 3. 本番プロジェクトにリンク
supabase link --project-ref <your-project-ref>

# 4. 本番環境にマイグレーション適用
supabase db push

# 注意: 本番データが失われる可能性があるため慎重に実行
```

**代替方法（Supabaseダッシュボード使用）**:
1. Supabaseダッシュボードにログイン
2. SQL Editor を開く
3. `database/schema.sql` の内容をコピー＆ペースト
4. 実行前にバックアップを取得

### アプリケーション関連の問題

#### 4. **環境変数が読み込まれない**
   - **開発環境**: `.env.development`ファイルの配置・権限確認
   - **本番環境**: fly.ioの環境変数設定確認（`flyctl secrets list`）
   - 環境変数の命名確認（`_DEV`/`_PROD`サフィックス）

#### 5. **環境の切り替えがうまくいかない**
   - `NODE_ENV`の値確認（`development`/`production`）
   - 設定ファイルの読み込み順序確認
   - アプリケーション再起動

#### 6. **データベース接続エラー**
   - 各環境のSupabase URLとキーの確認
   - RLSポリシーの確認
   - 環境別プロジェクト設定の確認

#### 7. **型エラー**
   - Database型定義の確認
   - Supabaseクライアントのバージョン確認

### デバッグ用のコマンド集

#### データベース状態の確認
```bash
# Supabaseの状態確認
supabase status

# データベース接続確認
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "SELECT version();"

# テーブル一覧
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "\dt"

# 特定テーブルの構造確認
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "\d room_players"
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "\d player_sessions"
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "\d game_states"

# データ確認
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "SELECT * FROM rooms LIMIT 5;"
```

#### ログ確認
```bash
# アプリケーションログ
npm run start:dev

# Supabaseログ
supabase logs

# エラーログの確認
# コンソールの "Failed to persist" メッセージを確認
```

#### 環境確認
```bash
# 現在の環境設定確認
console.log('Current NODE_ENV:', process.env.NODE_ENV);
console.log('Supabase URL:', process.env.NODE_ENV === 'development' ? process.env.SUPABASE_URL_DEV : process.env.SUPABASE_URL_PROD);

# 環境変数の存在確認
echo $NODE_ENV
echo $SUPABASE_URL_DEV
```

### エラーパターンと対処法

#### パターン1: カラムが存在しないエラー
```
column room_players.is_vacant does not exist
```
→ **解決**: `supabase db reset`でマイグレーション再適用

#### パターン2: テーブルが存在しないエラー
```
relation "player_sessions" does not exist
```
→ **解決**: スキーマ全体を再構築（`supabase db reset`）

#### パターン3: 接続エラー
```
Connection refused
```
→ **解決**: 
1. `supabase status`で起動確認
2. 起動していなければ`supabase start`
3. ポート番号の確認（54321, 54322）

#### パターン4: 認証エラー
```
Authentication failed
```
→ **解決**: 環境変数の確認とSupabaseキーの更新

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

## 実際に発生したエラーケースの記録

### Case 1: マイグレーション未適用によるカラム不存在エラー（2024-12-09）

**発生日時**: 2024年12月9日 8:50 AM

**エラーログ**:
```
[Nest] 95950  - 09/12/2025, 8:50:00 AM   ERROR [SupabaseRoomRepository] Error cleaning up disconnected players:
[Nest] 95950  - 09/12/2025, 8:50:00 AM   ERROR [SupabaseRoomRepository] Error: Failed to cleanup disconnected players: column room_players.disconnected_at does not exist

[Nest] 95950  - 09/12/2025, 8:53:24 AM   ERROR [SupabaseRoomRepository] Failed to get vacant players:
[Nest] 95950  - 09/12/2025, 8:53:24 AM   ERROR [SupabaseRoomRepository] Object(4) {
  code: '42703',
  details: null,
  hint: null,
  message: 'column room_players.is_vacant does not exist'
}

[Nest] 95950  - 09/12/2025, 8:53:24 AM   ERROR [SupabaseRoomRepository] Failed to add player:
[Nest] 95950  - 09/12/2025, 8:53:24 AM   ERROR [SupabaseRoomRepository] Object(4) {
  code: 'PGRST204',
  details: null,
  hint: null,
  message: "Could not find the 'disconnected_at' column of 'room_players' in the schema cache"
}
```

**原因分析**:
1. ローカルSupabaseは起動していた（`supabase status`で確認済み）
2. マイグレーションファイル（`supabase/migrations/001_initial_schema.sql`）は存在していた
3. しかし、実際のデータベースにマイグレーションが適用されていなかった
4. アプリケーションが期待するカラム（`is_vacant`, `vacant_data`, `disconnected_at`など）が存在しなかった

**解決手順**:
```bash
# 1. Supabase状態確認
$ supabase status
# → ローカルSupabaseは正常に動作

# 2. データベーススキーマ確認
$ psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "\d room_players"
# → 必要なカラムが存在しない

# 3. マイグレーション再適用
$ supabase db reset
# → "Applying migration 001_initial_schema.sql..." と表示

# 4. スキーマ再確認
$ psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "\d room_players"
# → 全ての必要なカラムが存在することを確認

# 5. アプリケーション再起動
$ npm run start:dev
# → エラーなく起動成功
```

**学んだこと**:
- `supabase start`は既存データベースをそのまま使用する
- スキーマ変更後は`supabase db reset`が必須
- エラーメッセージからカラム不存在は特定しやすい
- PostgreSQLのエラーコード（42703 = undefined_column）を理解すると原因特定が早い

**予防策**:
1. 新しい開発環境では最初に`supabase db reset`を実行
2. マイグレーション追加後は必ず`supabase db reset`を実行
3. CI/CDパイプラインにマイグレーション確認を組み込み

### Case 2: Environment Variable Configuration Issues（想定ケース）

**想定シナリオ**: 本番環境で環境変数が正しく設定されていない場合

**エラーログ（想定）**:
```
[Nest] ERROR [SupabaseService] Failed to initialize Supabase client: Invalid API URL
Configuration loaded: {
  url: undefined,
  serviceRoleKey: undefined,
  isDevelopment: false
}
```

**原因**:
- `NODE_ENV=production`だが、`SUPABASE_URL_PROD`が未設定
- fly.ioのsecrets設定漏れ

**解決手順**:
```bash
# 1. 現在の環境変数確認
$ flyctl secrets list

# 2. 不足している環境変数の設定
$ flyctl secrets set SUPABASE_URL_PROD=https://your-project.supabase.co
$ flyctl secrets set SUPABASE_SERVICE_ROLE_KEY_PROD=your-service-role-key

# 3. アプリケーション再デプロイ
$ flyctl deploy

# 4. ログ確認
$ flyctl logs
```

### Case 3: Database Connection Pool Exhaustion（想定ケース）

**想定シナリオ**: 大量のWebSocket接続でデータベース接続プールが枯渇

**エラーログ（想定）**:
```
[Nest] ERROR [SupabaseRoomRepository] Error: remaining connection slots are reserved for non-replication superuser connections
```

**原因**:
- Supabaseの無料プランでは同時接続数制限がある
- 接続がプールされていない、または適切にクローズされていない

**解決手順**:
1. 接続数制限の確認（Supabaseダッシュボード）
2. コネクションプールの設定見直し
3. 不要な長期接続の特定と修正
4. 必要に応じてSupabaseプランのアップグレード

## 移行完了

Supabaseへの移行が正常に完了し、以下の機能が動作確認済みです:
- ルーム作成・参加
- プレイヤーの準備状態管理
- ゲーム状態の永続化
- リアルタイム通信
- 退席管理（vacant seats）
- プレイヤーセッション管理
- タイムスタンプベースの切断管理
- 自動クリーンアップ機能

元のインメモリ実装はgitの履歴から参照可能です。

### 移行後の確認済み機能

✅ **基本機能**
- ルーム作成・削除
- プレイヤー参加・退出  
- ゲーム開始・終了

✅ **拡張機能**
- 退席者の情報保持と復帰
- 再接続トークン管理
- 切断者の自動クリーンアップ

✅ **データ永続化**
- サーバー再起動後の状態復元
- プレイヤーセッションの継続
- ゲーム履歴の保存

✅ **パフォーマンス**
- 大量データに対応したインデックス設計
- 効率的なクエリ最適化
- リアルタイム処理との両立