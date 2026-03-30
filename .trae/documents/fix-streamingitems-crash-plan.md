# 修复 streamingItems 导致白屏的计划

## 问题分析
白屏发生在 chat 输出过程中，没有报错，是永久的。根本原因是：
1. `streamingItems` 数组在流式输出过程中不断累积，没有上限
2. `displayMessages` 中复制了整个数组：`streamingItems: streamingItems.length > 0 ? [...streamingItems] : undefined`
3. 每次流式更新都导致大量内存分配，最终浏览器崩溃

## 修复方案

### 方案一：去掉 displayMessages 里对 streamingItems 的数组复制

**文件**: `src/renderer/components/Chat/ChatPanel.tsx`

**修改内容**:
```typescript
// 修改前
streamingItems: streamingItems.length > 0 ? [...streamingItems] : undefined,

// 修改后
// 直接传递引用，避免复制大数组
streamingItems: streamingItems.length > 0 ? streamingItems : undefined,
```

**原因**: 
- 避免每次渲染都复制整个 `streamingItems` 数组
- 减少内存分配和 GC 压力
- `streamingItems` 是临时状态，不需要深拷贝

### 方案二：给 streamingItems 添加上限（保险丝）

**文件**: `src/renderer/store/unifiedAgentStore.ts`

**修改内容**:
在 `addStreamItem` 中添加长度限制：
```typescript
addStreamItem: (item) => {
  set((state) => {
    // 保险丝：限制最大长度，防止内存溢出
    const MAX_STREAMING_ITEMS = 200;
    if (state.streamingItems.length >= MAX_STREAMING_ITEMS) {
      // 移除最旧的非活跃项，保留最近的
      state.streamingItems.splice(0, state.streamingItems.length - MAX_STREAMING_ITEMS + 1);
    }
    
    // 检查是否可以与最后一个同类型事件合并
    const lastItem = state.streamingItems[state.streamingItems.length - 1];
    // ... 原有逻辑
  });
},
```

**原因**:
- 防止极端情况下数组无限增长
- 200 个 item 足够显示最近的流式事件
- 保留原有合并逻辑，减少冗余

## 实施步骤

1. **修改 ChatPanel.tsx**
   - 找到 `displayMessages` useMemo
   - 修改 `streamingItems` 的赋值，去掉 `[...streamingItems]` 复制

2. **修改 unifiedAgentStore.ts**
   - 找到 `addStreamItem` action
   - 在添加新 item 前检查数组长度
   - 超过上限时移除最旧的 item

3. **测试验证**
   - 长文本流式输出测试
   - 确认不会白屏
   - 确认流式渲染正常

## 风险评估

- **低风险**: 只是去掉不必要的数组复制和添加长度限制
- **不影响功能**: `streamingItems` 是临时渲染状态，不影响历史消息
- **向后兼容**: 不需要修改其他代码
