# 本番デプロイチェックリスト

このチェックリストは、本番環境へのスキーマ変更を安全に適用するための手順です。

**⚠️ 重要**: 既存ユーザーデータ（auth.users, user_profiles）を保護するため、必ず全項目を確認してください。

---

## 📋 事前確認

### ローカル環境でのテスト

- [ ] マイグレーションファイルを作成・編集済み
- [ ] ローカル環境でマイグレーション適用成功
  ```bash
  cd mei-tra-backend
  supabase db reset
  ```
- [ ] 全ユニットテスト通過
  ```bash
  npm run test
  ```
- [ ] E2Eテスト通過
  ```bash
  npm run test:e2e
  ```
- [ ] ローカル環境で動作確認
  ```bash
  npm run start:dev
  # フロントエンドで以下をテスト:
  # - ユーザー登録
  # - ログイン
  # - プロフィール表示
  # - ゲーム作成・参加
  ```

### マイグレーション差分確認

- [ ] 本番環境との差分を確認
  ```bash
  supabase db diff --schema public --linked
  ```
- [ ] 差分内容が意図した変更のみであることを確認
- [ ] 既存テーブルの破壊的変更がないことを確認
  - ❌ DROP TABLE user_profiles
  - ❌ ALTER TABLE user_profiles DROP COLUMN
  - ✅ ALTER TABLE user_profiles ADD COLUMN (許容)
  - ✅ CREATE TABLE (新規テーブル - 許容)

---

## 🔒 バックアップ

### バックアップ取得

- [ ] バックアップスクリプト実行
  ```bash
  cd mei-tra-backend
  ./scripts/backup-production.sh
  ```
- [ ] バックアップファイルが作成されたことを確認
  ```bash
  ls -lh backups/
  # production_backup_YYYYMMDD_HHMMSS.sql が存在するか確認
  ```
- [ ] バックアップファイルサイズが正常（0バイトでない）
- [ ] バックアップファイルをローカルに保存
  - [ ] backups/ ディレクトリ内に保存済み
  - [ ] 念のため、別の場所にもコピー（推奨）

### バックアップの検証（オプション）

- [ ] バックアップファイルの内容確認
  ```bash
  head -n 50 backups/production_backup_YYYYMMDD_HHMMSS.sql
  # COPY auth.users や COPY user_profiles が含まれているか確認
  ```

---

## 🚀 デプロイ

### 本番環境への適用

- [ ] 本番プロジェクトにリンクされていることを確認
  ```bash
  supabase projects list
  # mei-tra (プロジェクトID) に ● マークがあるか確認
  ```
- [ ] デプロイ実行
  ```bash
  supabase db push --include-all --linked
  ```
- [ ] エラーなく完了したことを確認
- [ ] デプロイ時刻を記録: `____年__月__日 __:__`

---

## ✅ 動作確認

### 本番環境での確認

- [ ] 本番サイトにアクセス可能
- [ ] **既存ユーザーでログイン可能**（優先確認）
  - ユーザー名: `___________`
  - ログイン成功: はい / いいえ
- [ ] **既存ユーザーのプロフィール表示**
  - 表示名が正しい: はい / いいえ
  - アバターが正しい: はい / いいえ
  - ゲーム統計が残っている: はい / いいえ
- [ ] 新規ユーザー登録テスト
  - 新規登録成功: はい / いいえ
  - プロフィール自動作成: はい / いいえ
- [ ] ゲーム機能テスト
  - ルーム作成: はい / いいえ
  - ルーム参加: はい / いいえ
  - ゲーム開始: はい / いいえ

### ログ確認

- [ ] バックエンドログにエラーなし
  ```bash
  flyctl logs --app mei-tra-backend
  ```
- [ ] Supabase ダッシュボードでクエリエラーなし
  - Database → Query Performance

---

## 🚨 ロールバック（問題発生時）

**問題が発生した場合のみ実行**

### Step 1: アプリケーション停止（緊急時）

```bash
flyctl scale count 0 --app mei-tra-backend
```

### Step 2: データベース復元

```bash
# 方法1: psql コマンドで復元
# 本番DB URLは Supabase Dashboard > Settings > Database > Connection string から取得
psql "postgresql://postgres.[PROJECT-REF]@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres" \
  < backups/production_backup_YYYYMMDD_HHMMSS.sql

# 方法2: Supabase Studio で復元
# 1. Supabase Dashboard を開く
# 2. SQL Editor に移動
# 3. backups/production_backup_YYYYMMDD_HHMMSS.sql の内容を貼り付け
# 4. 実行
```

### Step 3: アプリケーション再起動

```bash
flyctl scale count 1 --app mei-tra-backend
```

### Step 4: 動作確認

- [ ] ログイン可能
- [ ] ユーザーデータが復元されている
- [ ] ゲーム機能が動作する

---

## 📊 デプロイ記録

### 今回のデプロイ情報

- **デプロイ日時**: `____年__月__日 __:__`
- **マイグレーションファイル**: `_______________________________`
- **変更内容**: `_______________________________________`
- **バックアップファイル**: `production_backup_YYYYMMDD_HHMMSS.sql`
- **デプロイ担当者**: `___________`
- **デプロイ結果**: 成功 / 失敗 / ロールバック実施

### 問題が発生した場合

- **問題内容**: `_______________________________________`
- **対応内容**: `_______________________________________`
- **解決時刻**: `____年__月__日 __:__`

---

## 📞 緊急連絡先

- **Supabase サポート**: https://supabase.com/dashboard/support
- **Fly.io サポート**: https://fly.io/dashboard

---

## 💡 Tips

### よくある問題と対処法

**問題**: `supabase db push` でエラー
```
Error: migration X failed
```
**対処**:
1. エラーメッセージを確認
2. マイグレーションファイルの SQL 構文をチェック
3. ローカルで `supabase db reset` が成功するか確認

**問題**: ユーザーがログインできない
**対処**:
1. auth.users テーブルが存在するか確認
2. user_profiles テーブルが存在するか確認
3. バックアップから復元

**問題**: プロフィールが表示されない
**対処**:
1. user_profiles の RLS ポリシーを確認
2. handle_new_user() トリガーが動作しているか確認

---

## ✨ デプロイ成功後

- [ ] チームに完了報告
- [ ] このチェックリストをアーカイブ
- [ ] 次回デプロイのために改善点をメモ

**改善点メモ**:
```
_________________________________________________
_________________________________________________
_________________________________________________
```
