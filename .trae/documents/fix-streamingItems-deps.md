# 修复 streamingItems 依赖问题

## 任务描述
修复 ChatPanel.tsx 中两个 useEffect/useMemo 依赖数组不完整的问题，确保 streamingItems 变化时能正确触发重渲染和自动滚动。

## 修改文件
- src/renderer/components/Chat/ChatPanel.tsx

## 具体修改点

### 1. displayMessages useMemo 依赖数组
**位置**: 约第 1544 行开始的 useMemo

**当前代码**:
```typescript
}, [tasks, activeTaskId, streamingMessage, streamingThinking, streamingToolCalls, isProcessing]);
```

**修改为**:
```typescript
}, [tasks, activeTaskId, streamingMessage, streamingThinking, streamingToolCalls, streamingItems, isProcessing]);
```

**原因**: 
- displayMessages 在构造 streamingMsg 时已经使用了 streamingItems
- 如果本轮主要靠 stream-item 更新，而 streamingMessage / streamingThinking / streamingToolCalls 没变化
- displayMessages 可能不会及时重算，导致流式消息显示不稳定

### 2. 自动滚动 useEffect 依赖数组
**位置**: 约第 1612 行开始的 useEffect

**当前代码**:
```typescript
}, [displayMessages.length, streamingMessage, streamingThinking]);
```

**修改为**:
```typescript
}, [displayMessages.length, streamingMessage, streamingThinking, streamingItems]);
```

**原因**:
- 自动滚动 effect 依赖了 displayMessages.length、streamingMessage、streamingThinking
- 如果当前新增的是 tool / todo / question 等 stream-item，而不是普通文本内容
- 滚动可能不会及时跟随

## 明确不做的事情
- 不改渲染逻辑（保持现有的按 seq 渲染 streamingItems 逻辑）
- 不改 store（unifiedAgentStore.ts 保持现状）
- 不做 content/thinking 聚合（保持现有的独立处理逻辑）
- 不做任何重构
- 不改其他文件
