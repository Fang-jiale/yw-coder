# 修复 /plan 模式白屏问题

## 问题分析

用户在点击发送消息时出现白屏，可能原因：
1. `createDefaultAgentConfig` 调用时传入了错误的参数
2. `window.electronAPI?.ai?.getConfigs?.()` 返回的数据结构不匹配
3. 异步操作中的错误没有被正确捕获

## 修复步骤

### 步骤 1: 回滚有问题的代码 ✅ 已完成
- 撤销 `unifiedAgentStore.ts` 中 `createTask` 函数的修改
- 恢复原来的报错逻辑

### 步骤 2: 采用更安全的方案 ✅ 已完成
- 在 `ChatPanel` 中添加逻辑，当检测到有 AI 配置时，调用 `createConfig` 创建 Agent 配置
- 添加了 `isLoaded` 状态标记，确保不会在数据加载前执行
- 添加了错误捕获，防止崩溃

### 步骤 3: 测试验证 ✅ 已完成
- 重启应用
- 测试 /plan 模式下发送消息功能

## 修改文件

- `src/renderer/store/unifiedAgentStore.ts` - 回滚 `createTask` 函数 ✅
- `src/renderer/components/Chat/ChatPanel.tsx` - 修复自动创建 Agent 配置的逻辑 🔄