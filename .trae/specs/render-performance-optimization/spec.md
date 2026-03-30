# 渲染机制性能优化规格说明

## Why

当前渲染机制存在以下性能问题：

1. **parseContentTags 性能问题**：每次渲染都调用正则匹配，CPU 密集型操作
2. **sortedItems 创建新数组**：每次都创建新数组并排序，内存压力 + 计算开销
3. **StreamingContent 无 Markdown**：流式输出时没有格式化
4. **useMemo 依赖项过多**：频繁触发重新计算

## What Changes

### 优化 1：缓存 parseContentTags 结果

- 使用 useMemo 缓存解析结果
- 只在 item.text 变化时重新解析

### 优化 2：优化 sortedItems 创建

- 使用更精确的依赖项
- 避免不必要的重新排序

### 优化 3：StreamingContent 添加 Markdown 解析

- 流式输出时也支持 Markdown 格式化
- 提升阅读体验

### 优化 4：优化 useMemo 依赖项

- 使用 useCallback 缓存回调函数
- 减少不必要的重新计算

## Impact

- 受影响组件：
  - `src/renderer/components/Chat/StreamingMessage.tsx`

- 不影响：
  - 主进程逻辑
  - 状态管理
  - 历史消息

## ADDED Requirements

### Requirement: parseContentTags 结果缓存

#### Scenario: 缓存解析结果
- **WHEN** 渲染 content 类型的 streamingItem
- **THEN** 使用 useMemo 缓存 parseContentTags 结果
- **AND** 只在 item.text 变化时重新解析

### Requirement: sortedItems 优化

#### Scenario: 避免不必要的重新排序
- **WHEN** streamingItems 引用变化但内容相同
- **THEN** 不重新创建数组
- **AND** 不重新排序

### Requirement: StreamingContent Markdown 支持

#### Scenario: 流式输出 Markdown 格式化
- **WHEN** 流式输出内容
- **THEN** 支持 Markdown 格式化
- **AND** 保持光标动画

## MODIFIED Requirements

### Requirement: StreamingMessage 组件优化

**原实现**：
```typescript
const sortedItems = useMemo(() => {
  return [...streamingItems].sort((a, b) => a.seq - b.seq);
}, [streamingItems]);

case 'content': {
  const segments = parseContentTags(item.text);
  // ...
}
```

**修改后**：
```typescript
const sortedItems = useMemo(() => {
  if (!streamingItems || streamingItems.length === 0) return [];
  return [...streamingItems].sort((a, b) => a.seq - b.seq);
}, [streamingItems?.length, streamingItems?.[streamingItems.length - 1]?.id]);

case 'content': {
  const segments = useMemo(() => parseContentTags(item.text), [item.text]);
  // ...
}
```

## REMOVED Requirements

无
