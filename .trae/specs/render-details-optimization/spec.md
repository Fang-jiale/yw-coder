# 渲染机制细节优化规格说明

## Why

当前渲染机制仍存在以下细节问题：

1. **contentElements 依赖项过多**：onToggleToolCall 和 onAnswerQuestion 是函数引用，可能每次渲染都变化
2. **ToolCallCard 显示不友好**：显示的是 id 而不是 toolName
3. **未使用的变量**：handleToggleThinking 定义了但没有使用

## What Changes

### 优化 1：优化 contentElements 依赖项

- 使用 useCallback 缓存 onToggle 回调
- 减少 useMemo 的依赖项

### 优化 2：ToolCallCard 显示优化

- 显示 toolName 而不是 id
- 提升用户体验

### 优化 3：清理未使用代码

- 移除 handleToggleThinking 未使用的变量

## Impact

- 受影响组件：
  - `src/renderer/components/Chat/StreamingMessage.tsx`

- 不影响：
  - 功能逻辑
  - 性能

## ADDED Requirements

无

## MODIFIED Requirements

### Requirement: ToolCallCard 显示优化

**原实现**：
```typescript
<span>{toolCall.id}</span>
```

**修改后**：
```typescript
<span>{toolCall.toolName || toolCall.id}</span>
```

### Requirement: contentElements 依赖项优化

**原实现**：
```typescript
}, [sortedItems, collapsedThinking, expandedToolCalls, onToggleToolCall, onAnswerQuestion, messageId]);
```

**修改后**：
- 使用 useCallback 缓存 onToggle 回调
- 减少不必要的依赖项

## REMOVED Requirements

### Requirement: handleToggleThinking 变量
**Reason**: 未使用
**Migration**: 直接删除
