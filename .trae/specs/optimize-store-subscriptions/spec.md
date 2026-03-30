# 订阅优化修复白屏问题规格说明

## Why

经过深度分析，发现白屏问题的根本原因是**多重因素叠加导致渲染压力过大**：

1. **重复 IPC 事件**：每个 content chunk 触发两个 IPC 事件（stream-item + stream-content）
2. **重复状态存储**：`streamingMessage` 和 `streamingItems` 存储相同内容
3. **过度订阅**：ChatHistorySidebar 订阅整个 `tasks` 数组，每次消息变化都触发重渲染
4. **低效 selector**：`activeTask` 使用 `find` 每次返回新引用

## What Changes

### 第一步：优化订阅（低风险，立即实施）

1. **ChatHistorySidebar 订阅优化**
   - 使用 `useShallow` 或精确 selector
   - 避免订阅整个 `tasks` 数组
   - 只订阅必要的数据

2. **ChatPanel activeTask selector 优化**
   - 使用稳定的 selector
   - 缓存 find 结果
   - 避免每次返回新引用

### 第二步：移除重复 IPC 事件（中风险）

- 只保留 `stream-item` 事件
- 移除 `stream-content` 和 `stream-thinking` 独立事件
- 减少一半的 IPC 通信开销

### 第三步：移除重复状态（中风险）

- 移除 `streamingMessage` 和 `streamingThinking`
- 只保留 `streamingItems`
- 修改暂停功能从 `streamingItems` 提取内容

## Impact

- 受影响组件：
  - `src/renderer/components/Chat/ChatHistorySidebar.tsx`
  - `src/renderer/components/Chat/ChatPanel.tsx`
  - `src/renderer/store/unifiedAgentStore.ts`
  - `src/main/agent/unifiedAgentIPC.ts`

## ADDED Requirements

### Requirement: ChatHistorySidebar 订阅优化

#### Scenario: 任务列表稳定
- **WHEN** 当前活跃任务的流式消息变化时
- **THEN** ChatHistorySidebar 不重渲染
- **AND** 只有切换任务时才更新

### Requirement: activeTask selector 稳定

#### Scenario: 引用稳定
- **WHEN** activeTask 内容未变化时
- **THEN** selector 返回相同引用
- **AND** ChatPanel 不因此重渲染

## MODIFIED Requirements

### Requirement: ChatHistorySidebar 数据订阅
**原实现**: 订阅整个 `tasks` 数组
**修改后**:
- 使用 `useShallow` 或精确 selector
- 只订阅任务列表的元数据（id、title、createdAt 等）
- 不订阅任务的消息内容

## REMOVED Requirements

无
