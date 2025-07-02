#!/bin/bash

echo "💤 Setting standby mode (min_machines_running = 0)"

# fly.tomlのmin_machines_runningを0に変更
sed -i.bak 's/min_machines_running = 1/min_machines_running = 0/g' fly.toml

echo "✅ Updated fly.toml"
cat fly.toml | grep min_machines_running

echo "🚀 Deploying..."
fly deploy

echo "💰 Standby mode activated! Cost optimization enabled." 