#!/bin/bash

echo "🎮 Setting production mode (min_machines_running = 1)"

# fly.tomlのmin_machines_runningを1に変更
sed -i.bak 's/min_machines_running = 0/min_machines_running = 1/g' fly.toml

echo "✅ Updated fly.toml"
cat fly.toml | grep min_machines_running

echo "🚀 Deploying..."
fly deploy

echo "🎯 Production mode activated! Game server will keep 1 machine running." 