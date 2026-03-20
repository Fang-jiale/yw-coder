#!/bin/bash

# YWCodeR 启动脚本

echo "🚀 正在启动 YWCodeR..."

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 错误：未检测到 Node.js，请先安装 Node.js >= 18"
    exit 1
fi

# 检查 npm
if ! command -v npm &> /dev/null; then
    echo "❌ 错误：未检测到 npm"
    exit 1
fi

# 显示版本
echo "📦 Node.js 版本: $(node --version)"
echo "📦 npm 版本: $(npm --version)"

# 检查 node_modules
if [ ! -d "node_modules" ]; then
    echo "📥 正在安装依赖..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ 依赖安装失败"
        exit 1
    fi
fi

# 启动应用
echo "✨ 正在启动应用..."
npm run dev
