# ChatPanel 渲染性能优化总结

## 优化背景
ChatPanel 存在严重的渲染性能问题，导致 renderer 进程频繁白屏/崩溃。经过多轮优化，将问题逐一解决。

## 优化内容

### 一、MessageContent 改为纯 props 组件

**问题：** MessageContent 内部直接调用 useUnifiedAgentStore()，订阅了 resultCards、taskProgress 等全局状态。

**修复：**
- 将 resultCards、taskProgress、collapsedThinking、collapsedToolCalls 等通过 props 传入
- MessageContent 不再直接订阅 store，只根据 props 渲染

**效果：** 减少消息子组件的 store 订阅和重渲染放大效应。

---

### 二、content/thinking 事件聚合

**问题：** streamingItems 中 content 和 thinking 事件粒度太细，一个词/短句一个块，节点数暴涨。

**修复：**
在 unifiedAgentStore.ts 的 addStreamItem 中合并连续事件：
```typescript
if (item.type === 'content' && lastItem.type === 'content') {
  lastItem.text += item.text;
  return;
}
if (item.type === 'thinking' && lastItem.type === 'thinking') {
  lastItem.text += item.text;
  return;
}
```

**效果：** 减少 streamingItems 数量，降低渲染节点数和渲染频率。

---

### 三、resultCards/taskProgress 不再传给所有历史消息

**问题：** resultCards 和 taskProgress 被传给所有历史消息重复渲染，DOM 成本成倍放大。

**修复：**
```typescript
<AIMessage
  ...
  resultCards={isStreaming ? resultCards : undefined}
  taskProgress={isStreaming ? taskProgress : undefined}
/>
```

**效果：** 只有当前流式消息显示 resultCards 和 taskProgress，历史消息不再重复渲染。

---

### 四、历史消息不再持久化完整 streamingItems

**问题：** onMessage 中把当前整份 streamingItems 保存到历史 assistant 消息，导致消息对象越来越重。

**修复：**
删除 onMessage 中保存 streamingItems 的代码：
```typescript
// 注意：不再把 streamingItems 保存到历史消息中
// streamingItems 只作为当前流式阶段的临时状态，不持久化
```

**效果：**
- 历史消息不再携带 streamingItems
- 内存占用不再随对话轮次线性增长
- displayMessages 构造开销大幅降低

---

### 五、ChatPanel Store Selector 拆分订阅

**问题：** ChatPanel 一次性从 useUnifiedAgentStore() 整包解构 20+ 个字段，任意字段变化都触发整体重渲染。

**修复：**
将大范围解构改为多个细粒度 selector：
```typescript
// 1. 当前任务相关
const activeTaskId = useUnifiedAgentStore(state => state.activeTaskId);
const tasks = useUnifiedAgentStore(state => state.tasks);
const isProcessing = useUnifiedAgentStore(state => state.isProcessing);

// 2. 当前流式相关（高频更新，单独订阅）
const streamingMessage = useUnifiedAgentStore(state => state.streamingMessage);
const streamingItems = useUnifiedAgentStore(state => state.streamingItems);
// ...

// 3. UI 折叠状态相关
const collapsedThinking = useUnifiedAgentStore(state => state.collapsedThinking);

// 4. Action 方法相关
const createTask = useUnifiedAgentStore(state => state.createTask);
// ...
```

**效果：**
- 只有特定字段变化才会触发对应组件更新
- 高频流式更新被隔离，不会带动整个组件树更新

---

### 六、displayMessages 依赖优化

**问题：** displayMessages 依赖整个 tasks 数组，每次 store 更新都触发全量重建。

**修复：**
```typescript
// 从依赖整个 tasks 数组改为依赖 activeTask
}, [activeTask, streamingMessage, streamingThinking, streamingToolCalls, streamingItems, isProcessing]);
```

**效果：** 降低"任意 store 更新 -> 整个消息列表全重建"的概率。

---

### 七、AIMessage 组件 React.memo 优化

**问题：** AIMessage 每次都会重新渲染，即使 props 没有实质变化。

**修复：**
```typescript
const AIMessage = React.memo(AIMessageComponent, (prevProps, nextProps) => {
  return (
    prevProps.messageId === nextProps.messageId &&
    prevProps.content === nextProps.content &&
    // ... 其他关键属性比较
  );
});
```

**效果：** 消息组件只在必要时重渲染。

---

### 八、clearStreaming 清理全局状态

**问题：** clearStreaming 没有清理 resultCards 和 taskProgress，导致状态泄漏到后续轮次。

**修复：**
```typescript
clearStreaming: () => {
  set({
    // ... 原有清理
    resultCards: [],
    taskProgress: null,
  });
},
```

**效果：** 流式结束后全局状态被正确清理。

---

## 修复的 Bug

### activeConfigId 未定义错误
在拆分 selector 过程中，发现代码中原有 bug：
```typescript
// 错误
const activeConfig = displayConfigs.find((c) => c.id === activeConfigId);

// 正确
const activeConfig = displayConfigs.find((c) => c.id === activeAIConfigId);
```

---

## 本轮未改动的内容

1. **aiStreamService.ts** - 不涉及
2. **budget / continuation / remediation 逻辑** - 不涉及
3. **ChatPanel 整体渲染结构** - 只改订阅方式，不改渲染逻辑
4. **虚拟滚动** - 本轮不上
5. **主进程事件模型** - 不涉及
6. **第一优先级逻辑** - 未重做

---

## 优化效果

1. **减少重渲染范围**：只有真正变化的字段对应的 selector 会触发更新
2. **隔离高频更新**：streamingMessage/items 等高频字段变化不会导致整个 ChatPanel 重渲
3. **降低 DOM 成本**：resultCards/taskProgress 不再被重复渲染到所有历史消息
4. **减少内存占用**：历史消息不再携带完整的 streamingItems
5. **保持功能完整**：所有原有功能保持不变，只优化性能和订阅粒度
