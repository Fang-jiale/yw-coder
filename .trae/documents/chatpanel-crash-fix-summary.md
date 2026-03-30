# ChatPanel 崩溃修复总结

## 问题描述
用户报告 ChatPanel 出现崩溃，经过分析发现以下潜在问题：

## 修复内容

### 1. displayMessages useMemo 依赖数组优化

**文件**: `src/renderer/components/Chat/ChatPanel.tsx`

**修改前**:
```typescript
const displayMessages = useMemo(() => {
  // ...
}, [activeTask?.messages, activeTask?.steps, activeTask?.todoItems, streamingMessage, streamingThinking, streamingToolCalls, streamingItems, isProcessing]);
```

**修改后**:
```typescript
const displayMessages = useMemo(() => {
  // ...
}, [activeTask, isProcessing, streamingMessage, streamingThinking, streamingItems, streamingToolCalls.length]);
```

**原因**:
- 使用 `activeTask` 整体作为依赖，而不是展开的属性
- 使用 `streamingToolCalls.length` 代替 `streamingToolCalls` 数组，避免数组引用变化导致的不必要重建
- 确保依赖数组稳定，减少不必要的重新计算

### 2. 自动滚动 useEffect 依赖优化

**文件**: `src/renderer/components/Chat/ChatPanel.tsx`

**修改前**:
```typescript
useEffect(() => {
  if (streamingEndRef.current) {
    if (shouldAutoScroll.current || !isUserScrolling.current) {
      streamingEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
      isUserScrolling.current = false;
    }
  }
}, [displayMessages.length, streamingMessage, streamingThinking, streamingItems]);
```

**修改后**:
```typescript
// 自动滚动效果 - 只在流式消息内容变化时触发
useEffect(() => {
  if (streamingEndRef.current && isProcessing) {
    if (shouldAutoScroll.current || !isUserScrolling.current) {
      streamingEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
      isUserScrolling.current = false;
    }
  }
  // 依赖最小化：只在流式内容变化且正在处理时触发
}, [streamingMessage, streamingThinking, isProcessing]);
```

**原因**:
- 移除 `displayMessages.length` 依赖，避免 displayMessages 变化时触发滚动
- 添加 `isProcessing` 条件，只在处理中时触发滚动
- 减少不必要的滚动操作

### 3. 消息修改收口到 Store Action（上一轮已完成）

**文件**: `src/renderer/store/unifiedAgentStore.ts`

新增三个 action:
- `updateMessage(taskId, messageId, patch)` - 更新单条消息
- `deleteMessage(taskId, messageId)` - 删除单条消息
- `clearTaskMessages(taskId)` - 清空任务所有消息

**文件**: `src/renderer/components/Chat/ChatPanel.tsx`

修改三个函数使用 store action:
- `saveEditMessage` - 使用 `updateMessage` 和 `deleteMessageAction`
- `deleteMessage` - 使用 `deleteMessageAction`
- `clearConversation` - 使用 `clearTaskMessages`

**原因**:
- 避免直接突变 `activeTask.messages`
- 所有状态修改通过 store 统一完成
- 符合 React/Zustand 最佳实践

### 4. 统一 streamingItems 持久化策略（上一轮已完成）

**文件**: `src/renderer/components/Chat/ChatPanel.tsx`

**修改**:
- 暂停/中断分支不再保存 `streamingItems` 到历史消息
- 只保留轻量字段：`content`、`thinking`、`toolCalls`

**原因**:
- 正常完成和暂停/中断两条路径使用同一套持久化策略
- 避免历史消息膨胀

## 崩溃原因分析

崩溃可能是由于以下原因：

1. **频繁的状态更新**
   - 流式过程中 `streamingMessage`、`streamingThinking`、`streamingItems` 频繁更新
   - 导致 `displayMessages` 频繁重新计算
   - 下游组件（AIMessage）频繁重新渲染

2. **依赖数组不稳定**
   - 原 `displayMessages` 依赖 `activeTask?.messages` 等展开属性
   - 当 `activeTask` 变化时，可能导致依赖检查出现问题

3. **useEffect 循环触发**
   - 原自动滚动 useEffect 依赖 `displayMessages.length`
   - displayMessages 变化 → useEffect 执行 → 可能间接触发其他更新

## 修复效果

1. **减少不必要的重新计算**
   - displayMessages 只在必要时重建
   - 使用稳定的依赖项

2. **减少不必要的滚动操作**
   - 只在流式内容变化且正在处理时触发滚动

3. **统一状态管理**
   - 所有消息修改通过 store action 完成
   - 避免直接状态突变

## 后续建议

如果崩溃仍然发生，建议：

1. **进一步拆分 displayMessages**
   - 将历史消息和流式消息分开管理
   - 历史消息使用更稳定的选择器

2. **优化 AIMessage 组件**
   - 使用 React.memo 的自定义比较函数
   - 只比较必要的 props

3. **使用虚拟列表**
   - 对于大量消息，使用 react-window 或 react-virtualized
   - 减少渲染的消息数量

4. **添加错误边界**
   - 在 ChatPanel 外层添加 Error Boundary
   - 捕获渲染错误，避免整个应用崩溃

## 修改文件列表

1. `src/renderer/components/Chat/ChatPanel.tsx`
   - 优化 displayMessages useMemo 依赖数组
   - 优化自动滚动 useEffect 依赖
   - 修改 saveEditMessage、deleteMessage、clearConversation 使用 store action
   - 修改暂停/中断分支不保存 streamingItems

2. `src/renderer/store/unifiedAgentStore.ts`
   - 新增 updateMessage、deleteMessage、clearTaskMessages action
