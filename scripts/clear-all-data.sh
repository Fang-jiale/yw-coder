#!/bin/bash

echo "=== 清除 ywcoder 所有用户数据 ==="
echo ""

# 应用数据目录
APP_DIR="$HOME/Library/Application Support/ywcoder"

echo "正在清除数据..."

# 1. 清除 agent-data 目录
if [ -d "$APP_DIR/agent-data" ]; then
  rm -rf "$APP_DIR/agent-data"
  echo "✓ 已删除 agent-data"
fi

# 2. 清除 config 目录
if [ -d "$APP_DIR/config" ]; then
  rm -rf "$APP_DIR/config"
  echo "✓ 已删除 config"
fi

# 3. 清除其他可能的数据目录
if [ -d "$APP_DIR/Cache" ]; then
  rm -rf "$APP_DIR/Cache"
  echo "✓ 已删除 Cache"
fi

if [ -d "$APP_DIR/Session Storage" ]; then
  rm -rf "$APP_DIR/Session Storage"
  echo "✓ 已删除 Session Storage"
fi

if [ -d "$APP_DIR/Local Storage" ]; then
  rm -rf "$APP_DIR/Local Storage"
  echo "✓ 已删除 Local Storage"
fi

echo ""
echo "=== 清除完成 ==="
echo "请重新启动应用"
