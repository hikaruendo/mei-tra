#!/bin/bash
set -e

# 本番データベースバックアップスクリプト
# 使用方法: ./scripts/backup-production.sh

BACKUP_DIR="backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# バックアップディレクトリ作成
mkdir -p "$BACKUP_DIR"

echo "🔒 本番データベースをバックアップ中..."
echo "📅 タイムスタンプ: $TIMESTAMP"

# 重要データのバックアップ（--linked フラグを使用）
supabase db dump \
  --linked \
  --data-only \
  --use-copy \
  > "$BACKUP_DIR/production_backup_$TIMESTAMP.sql"

if [ $? -eq 0 ]; then
    echo "✅ バックアップ成功: $BACKUP_DIR/production_backup_$TIMESTAMP.sql"
    echo "📊 バックアップサイズ: $(du -h "$BACKUP_DIR/production_backup_$TIMESTAMP.sql" | cut -f1)"
else
    echo "❌ バックアップ失敗"
    exit 1
fi

# 30日以上古いバックアップを自動削除
OLD_BACKUPS=$(find "$BACKUP_DIR" -name "production_backup_*.sql" -mtime +30 2>/dev/null)
if [ -n "$OLD_BACKUPS" ]; then
    echo "🗑️  30日以上古いバックアップを削除中..."
    find "$BACKUP_DIR" -name "production_backup_*.sql" -mtime +30 -delete
    echo "✅ 古いバックアップを削除しました"
fi

echo ""
echo "🎉 バックアップ完了！"
echo ""
echo "📋 次のステップ:"
echo "   1. DEPLOYMENT_CHECKLIST.md を確認"
echo "   2. supabase db push --linked でデプロイ"
echo "   3. 本番環境で動作確認"
echo ""
echo "🚨 問題が発生した場合のロールバック:"
echo "   psql \"<本番DB URL>\" < $BACKUP_DIR/production_backup_$TIMESTAMP.sql"
