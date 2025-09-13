# Supabase 運用操作手順書

このドキュメントは、明専トランプバックエンドのSupabase運用における具体的な操作手順を記載します。

## 📋 目次

- [日常的な開発作業](#日常的な開発作業)
- [スキーマ変更作業](#スキーマ変更作業)
- [データベースのメンテナンス](#データベースのメンテナンス)
- [本番環境への反映](#本番環境への反映)
- [緊急時対応](#緊急時対応)
- [定期メンテナンス](#定期メンテナンス)

## 日常的な開発作業

### 開発環境の起動手順

```bash
# 1. プロジェクトディレクトリに移動
cd mei-tra-backend

# 2. Supabaseローカル環境の起動
supabase start

# 3. 起動状態の確認
supabase status

# 期待される出力:
#          API URL: http://127.0.0.1:54321
#      GraphQL URL: http://127.0.0.1:54321/graphql/v1
#   S3 Storage URL: http://127.0.0.1:54321/storage/v1/s3
#           DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
#       Studio URL: http://127.0.0.1:54323

# 4. アプリケーションの起動
npm run start:dev
```

### 開発環境の終了手順

```bash
# 1. アプリケーションの停止
Ctrl + C

# 2. Supabaseローカル環境の停止
supabase stop

# 確認
supabase status
# "supabase local development setup is not running." と表示される
```

### データの確認方法

#### 方法1: Supabase Studio（GUI）
```bash
# Studio URLを開く
open http://127.0.0.1:54323

# テーブル一覧: Table Editor
# SQL実行: SQL Editor
# 認証情報: Authentication
```

#### 方法2: コマンドライン（CLI）
```bash
# データベースに直接接続
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres

# よく使用するクエリ
\dt                                    # テーブル一覧
\d room_players                        # テーブル構造確認
SELECT * FROM rooms LIMIT 10;         # データ確認
SELECT COUNT(*) FROM player_sessions;  # レコード数確認
```

## スキーマ変更作業

### 新機能追加時のスキーマ変更

#### Step 1: マイグレーションファイルの作成

```bash
# 新しいマイグレーションファイルを作成
supabase migration new add_new_feature_name

# 生成されるファイル例:
# supabase/migrations/20240312123456_add_new_feature_name.sql
```

#### Step 2: マイグレーション内容の記述

```sql
-- 例: 新しいテーブルの追加
-- supabase/migrations/20240312123456_add_tournament_system.sql

-- Tournament table
CREATE TABLE tournaments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'preparing',
    max_participants INTEGER NOT NULL DEFAULT 16,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_tournaments_status ON tournaments(status);
CREATE INDEX idx_tournaments_created_at ON tournaments(created_at);

-- RLS Policy
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow service role full access on tournaments" ON tournaments
    FOR ALL USING (auth.role() = 'service_role');
```

#### Step 3: ローカル環境での適用とテスト

```bash
# マイグレーションを適用
supabase db reset

# または、特定のマイグレーションのみ適用
supabase migration up

# 適用結果の確認
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "\d tournaments"

# アプリケーションのテスト
npm run start:dev
```

### 既存テーブルの変更

#### カラム追加の場合

```sql
-- マイグレーションファイル例
-- supabase/migrations/20240312134567_add_user_preferences.sql

-- Add new columns to existing table
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS 
    tournament_mode BOOLEAN DEFAULT FALSE;

ALTER TABLE rooms ADD COLUMN IF NOT EXISTS 
    tournament_id UUID REFERENCES tournaments(id) ON DELETE SET NULL;

-- Update existing records with default values
UPDATE rooms SET tournament_mode = FALSE WHERE tournament_mode IS NULL;

-- Add index for new column
CREATE INDEX IF NOT EXISTS idx_rooms_tournament_id ON rooms(tournament_id);
```

#### データ型変更の場合（注意が必要）

```sql
-- 既存データのバックアップ
CREATE TABLE rooms_backup AS SELECT * FROM rooms;

-- データ型変更（例：VARCHAR → TEXT）
ALTER TABLE rooms ALTER COLUMN description TYPE TEXT;

-- 変更確認後、バックアップテーブル削除
-- DROP TABLE rooms_backup;  -- 確認後に実行
```

### スキーマ変更のテスト手順

```bash
# 1. 変更前の状態を記録
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "\d+ rooms" > before_migration.txt

# 2. マイグレーション適用
supabase db reset

# 3. 変更後の状態を確認
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "\d+ rooms" > after_migration.txt

# 4. 差分確認
diff before_migration.txt after_migration.txt

# 5. アプリケーション動作テスト
npm run test          # ユニットテスト
npm run start:dev     # 起動テスト

# 6. 手動テスト
# - ルーム作成・参加
# - ゲーム開始
# - 新機能の動作確認
```

## データベースのメンテナンス

### データベースの初期化・リセット

```bash
# 完全リセット（全データ削除 + スキーマ再構築）
supabase db reset

# 確認プロンプトが表示される場合は 'y' で確定

# リセット完了後の確認
supabase status
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "\dt"
```

### データのバックアップ

```bash
# 全データベースのバックアップ
pg_dump postgresql://postgres:postgres@127.0.0.1:54322/postgres > backup_$(date +%Y%m%d_%H%M%S).sql

# 特定テーブルのバックアップ
pg_dump -t rooms -t room_players postgresql://postgres:postgres@127.0.0.1:54322/postgres > rooms_backup.sql

# バックアップからの復元
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres < backup_20240312_143000.sql
```

### パフォーマンス分析

```sql
-- 実行中のクエリ確認
SELECT query, state, query_start 
FROM pg_stat_activity 
WHERE state != 'idle';

-- テーブルサイズ確認
SELECT schemaname, tablename, 
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- インデックス使用状況
SELECT schemaname, tablename, indexname, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_tup_read DESC;
```

## 本番環境への反映

### 本番環境の準備

```bash
# 1. Supabase CLIにログイン
supabase login

# 2. 本番プロジェクトの情報確認
supabase projects list

# 3. プロジェクトとのリンク
supabase link --project-ref <your-production-project-ref>

# 4. 現在のリンク状態確認
supabase status
```

### 本番環境へのマイグレーション適用

⚠️ **注意**: 本番データに影響するため、必ず以下の手順を守ってください

```bash
# 1. ローカル環境での最終確認
supabase db reset
npm run test
npm run start:dev  # 動作確認

# 2. 本番データのバックアップ（Supabaseダッシュボードから）
# - Settings → Database → Backup and Restore
# - Manual backup を実行

# 3. マイグレーションの差分確認
supabase db diff --schema public

# 4. 本番環境への適用
supabase db push

# ⚠️ WARNING: This will push database changes to your linked project.
# Do you want to continue? [y/N]
# 'y' で確定
```

### 本番環境の動作確認

```bash
# 1. アプリケーションログ確認
flyctl logs --app your-app-name

# 2. データベース接続確認
# Supabaseダッシュボードでクエリ実行:
SELECT COUNT(*) FROM rooms;
SELECT COUNT(*) FROM room_players;

# 3. 機能テスト
# フロントエンド経由で基本機能をテスト
```

### ロールバック手順

本番環境で問題が発生した場合：

```bash
# 1. 緊急対応: アプリケーション停止
flyctl scale count 0 --app your-app-name

# 2. データベースの復元
# Supabaseダッシュボード → Settings → Database → Backup and Restore
# 直前のバックアップから復元

# 3. アプリケーション再起動
flyctl scale count 1 --app your-app-name

# 4. 動作確認
flyctl logs --app your-app-name
```

## 緊急時対応

### アプリケーションがDB接続できない場合

#### Step 1: 問題の特定

```bash
# 1. Supabaseの状態確認
supabase status

# 2. 接続テスト
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "SELECT 1;"

# 3. アプリケーションログ確認
tail -f logs/app.log
```

#### Step 2: 対処法

**ケース1: Supabaseが停止している**
```bash
supabase start
```

**ケース2: 環境変数の問題**
```bash
# 環境変数確認
echo $NODE_ENV
echo $SUPABASE_URL_DEV

# .env.development ファイル確認
cat .env.development
```

**ケース3: ポートの競合**
```bash
# ポート使用状況確認
lsof -i :54321
lsof -i :54322

# 競合プロセス停止後、Supabase再起動
supabase stop
supabase start
```

### データ破損・不整合の対応

#### Step 1: 問題の調査

```sql
-- データ整合性チェック
SELECT r.id as room_id, r.name, COUNT(rp.id) as player_count
FROM rooms r
LEFT JOIN room_players rp ON r.id = rp.room_id
GROUP BY r.id, r.name
HAVING COUNT(rp.id) > 4;  -- 4人を超えるルーム

-- 孤立データの確認
SELECT rp.* FROM room_players rp
LEFT JOIN rooms r ON rp.room_id = r.id
WHERE r.id IS NULL;  -- 親テーブルに存在しないプレイヤー
```

#### Step 2: データ修復

```sql
-- 孤立データの削除
DELETE FROM room_players 
WHERE room_id NOT IN (SELECT id FROM rooms);

-- ゲーム状態の修復
UPDATE game_states 
SET current_player_index = 0 
WHERE current_player_index >= (
    SELECT COUNT(*) FROM room_players WHERE room_id = game_states.room_id
);
```

### パフォーマンス問題の対応

```sql
-- 実行時間の長いクエリを特定
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY total_time DESC
LIMIT 10;

-- 必要に応じてインデックス追加
CREATE INDEX CONCURRENTLY idx_room_players_status 
ON room_players(is_ready, is_vacant);
```

## 定期メンテナンス

### 日次メンテナンス

```bash
# 1. ログローテーション
# アプリケーションログのアーカイブ

# 2. データベース統計情報更新
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "ANALYZE;"

# 3. 不要データの削除（アプリケーションが自動実行）
# - 期限切れsessions
# - 古い game_history
# - 放棄されたrooms
```

### 週次メンテナンス

```sql
-- 1. データベースサイズ確認
SELECT pg_size_pretty(pg_database_size('postgres'));

-- 2. 未使用インデックスの確認
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY relname;

-- 3. テーブル統計情報
SELECT schemaname, tablename, n_tup_ins, n_tup_upd, n_tup_del
FROM pg_stat_user_tables
ORDER BY n_tup_ins DESC;
```

### 月次メンテナンス

```bash
# 1. バックアップ作成とテスト
pg_dump postgresql://postgres:postgres@127.0.0.1:54322/postgres > monthly_backup.sql

# 2. 復元テスト（別のデータベースで）
createdb test_restore
psql test_restore < monthly_backup.sql
dropdb test_restore

# 3. Supabase CLIアップデート
supabase update

# 4. パッケージ依存関係の更新
npm audit
npm update
```

## 運用チェックリスト

### 新機能リリース前

- [ ] ローカル環境でのマイグレーション確認
- [ ] データバックアップ取得
- [ ] 本番環境での差分確認
- [ ] ロールバック手順の確認
- [ ] 関係者への事前通知

### 定期点検項目

#### 毎日
- [ ] アプリケーションの起動確認
- [ ] エラーログの確認
- [ ] データベース接続確認

#### 毎週
- [ ] データベースサイズの確認
- [ ] パフォーマンスメトリクスの確認
- [ ] 不要データの削除状況確認

#### 毎月
- [ ] バックアップとリストアのテスト
- [ ] セキュリティアップデートの確認
- [ ] 容量・パフォーマンスの長期トレンド分析

---

## 📞 サポート情報

- **Supabase公式ドキュメント**: https://supabase.com/docs
- **Supabase CLI リファレンス**: https://supabase.com/docs/reference/cli
- **PostgreSQL公式ドキュメント**: https://www.postgresql.org/docs/

## 📝 更新履歴

- 2024-12-09: 初版作成
- 2024-12-09: マイグレーション未適用エラー対応手順追加
- 2024-12-09: 緊急時対応手順詳細化