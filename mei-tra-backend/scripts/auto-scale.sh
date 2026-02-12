#!/bin/bash

# 環境変数チェック
if [ -z "$FLY_API_TOKEN" ]; then
  echo "Error: FLY_API_TOKEN not set"
  exit 1
fi

APP_NAME="mei-tra-backend"
BACKEND_URL="https://mei-tra-backend.fly.dev"

# ヘルスチェックでアクティビティ状態を取得
HEALTH_RESPONSE=$(curl -s -m 10 "$BACKEND_URL/api/health" || echo '{"status":"error"}')

# JSONパース（jqを使用）
LAST_ACTIVITY_AGO=$(echo "$HEALTH_RESPONSE" | jq -r '.activity.lastActivityAgo // 999999999')
IS_IDLE=$(echo "$HEALTH_RESPONSE" | jq -r '.activity.isIdle // true')
ACTIVE_CONNECTIONS=$(echo "$HEALTH_RESPONSE" | jq -r '.activity.activeConnections // 0')

echo "Health check result:"
echo "  Last activity: $((LAST_ACTIVITY_AGO / 60000)) minutes ago"
echo "  Active connections: $ACTIVE_CONNECTIONS"
echo "  Is idle: $IS_IDLE"

# Fly configurationを確認（count=0だと自動起動できないため、countは常に1以上を維持）
SCALE_JSON=$(fly scale show -a "$APP_NAME" -j)
CURRENT_MIN=$(echo "$SCALE_JSON" | jq -r '.Groups[0].MinMachines // 0')
CURRENT_COUNT=$(echo "$SCALE_JSON" | jq -r '.Groups[0].Count // 0')
echo "Current min_machines_running: $CURRENT_MIN"
echo "Current machine count: $CURRENT_COUNT"

# コストを抑えるためmin=0を維持しつつ、count=1で停止マシンを確保する
TARGET_MIN=0
TARGET_COUNT=1

if [ "$CURRENT_MIN" -ne "$TARGET_MIN" ] || [ "$CURRENT_COUNT" -lt "$TARGET_COUNT" ]; then
  echo "Applying target scale: count=$TARGET_COUNT, min=$TARGET_MIN"
  fly scale count "$TARGET_COUNT" --min "$TARGET_MIN" -a "$APP_NAME" -y
  echo "✅ Scale updated (cold-start compatible mode)"
else
  echo "Scale already correct (count=1, min=0)"
fi
