#!/bin/bash
# 清除历史对话记录脚本

HISTORY_FILE="$HOME/Library/Application Support/Electron/agent-data/agent-tasks.json"

if [ -f "$HISTORY_FILE" ]; then
    echo "找到历史对话记录文件: $HISTORY_FILE"
    echo "文件大小: $(ls -lh "$HISTORY_FILE" | awk '{print $5}')"
    read -p "确定要删除吗? (y/n): " confirm
    if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
        rm "$HISTORY_FILE"
        echo "历史对话记录已删除"
    else
        echo "已取消"
    fi
else
    echo "未找到历史对话记录文件"
fi
