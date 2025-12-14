#!/bin/bash

# 環境変数チェック
if [ -z "$FLY_API_TOKEN" ]; then
  echo "Error: FLY_API_TOKEN not set"
  exit 1
fi

APP_NAME="mei-tra-backend"
BACKEND_URL="https://mei-tra-backend.fly.dev"
IDLE_THRESHOLD_MINUTES=30

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

# 現在のmin_machines_runningを取得
CURRENT_MIN=$(fly scale show -a "$APP_NAME" -j | jq -r '.Groups[0].MinMachines // 0')
echo "Current min_machines_running: $CURRENT_MIN"

# スケーリング判定
if [ "$IS_IDLE" = "true" ] && [ "$ACTIVE_CONNECTIONS" -eq 0 ]; then
  if [ "$CURRENT_MIN" -ne 0 ]; then
    echo "Scaling down to 0..."
    fly scale count 0 --min 0 -a "$APP_NAME" -y
    echo "✅ Scaled to min=0 (standby mode)"
  else
    echo "Already at min=0"
  fi
else
  if [ "$CURRENT_MIN" -eq 0 ]; then
    echo "Activity detected, scaling up to 1..."
    fly scale count 1 --min 1 -a "$APP_NAME" -y
    echo "✅ Scaled to min=1 (active mode)"
  else
    echo "Already at min=1"
  fi
fi
