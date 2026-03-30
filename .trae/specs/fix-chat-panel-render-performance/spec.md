# ChatPanel 渲染性能修复规格说明

## Why
当前 ChatPanel 存在严重的渲染性能问题，导致 renderer 进程频繁白屏/崩溃：
1. resultCards 和 taskProgress 被传给所有历史消息重复渲染，DOM 成本成倍放大
2. displayMessages 依赖整个 tasks 数组，每次 store 更新都触发全量重建
3. 消息对象每次重新创建，导致 React 认为所有消息都是新的

## What Changes
- 修复 resultCards/taskProgress 重复渲染问题，只渲染在当前流式消息上
- 优化 displayMessages 依赖，减少对 tasks 的全量依赖
- 在 clearStreaming 中清理 resultCards 和 taskProgress
- 对 AIMessage 做 React.memo 优化

## Impact
- 受影响组件：`src/renderer/components/Chat/ChatPanel.tsx`
- 相关状态管理：`src/renderer/store/unifiedAgentStore.ts`

## ADDED Requirements

### Requirement: resultCards 只渲染在当前消息
**描述**: resultCards 只应该显示在当前流式消息或最后一条 assistant 消息上，历史消息不应重复渲染
**场景**:
- **WHEN** 渲染消息列表时
- **THEN** 只有 isStreaming === true 的消息才接收 resultCards
- **AND** 历史消息传 undefined

### Requirement: taskProgress 只渲染在当前消息
**描述**: taskProgress 只应该显示在当前流式消息上
**场景**:
- **WHEN** 渲染消息列表时
- **THEN** 只有当前活跃消息才显示 taskProgress
- **AND** 历史消息不传 taskProgress

### Requirement: clearStreaming 清理全局状态
**描述**: clearStreaming 应该清理所有流式相关状态，避免泄漏到后续轮次
**场景**:
- **WHEN** 调用 clearStreaming 时
- **THEN** 清空 streamingMessage, streamingThinking, streamingToolCalls, streamingItems
- **AND** 清空 resultCards
- **AND** 清空 taskProgress

## MODIFIED Requirements

### Requirement: 优化 displayMessages 依赖
**原实现**: displayMessages 依赖整个 tasks 数组，每次创建新 message 对象
**修改后**: 
- 优先依赖 activeTask 或 activeTask.messages
- 减少不必要的对象重建
- 能复用原 message 引用的地方尽量复用

### Requirement: AIMessage 组件优化
**原实现**: AIMessage 每次都会重新渲染
**修改后**: 对 AIMessage 做 React.memo，减少不必要的重渲染

## REMOVED Requirements
无
