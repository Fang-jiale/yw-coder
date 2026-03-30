# ChatPanel Store Selector 拆分计划

## 问题背景
ChatPanel 当前一次性从 useUnifiedAgentStore() 整包解构大量字段，导致任意 store 字段变化都会触发整个组件重渲染。

## 修改目标
将大范围整包订阅改为细粒度 selector 订阅，降低高频流式更新时的重渲染成本。

## 具体修改方案

### 一、当前整包订阅的字段（约 20+ 个）
```typescript
const {
  configs,
  activeConfigId,
  tasks,              // 整个数组，问题最大
  activeTaskId,
  isCreating,
  isProcessing,
  streamingMessage,
  streamingThinking,
  streamingToolCalls,
  streamingItems,
  error,
  createTask,
  createConfig,
  sendMessage,
  loadConfigs,
  loadTasks,
  setError,
  clearError,
  startTask,
  stopTask,
  deleteTask,
  setIsProcessing,
  answerQuestion,
  resultCards,
  taskProgress,
  collapsedThinking,
  collapsedToolCalls,
  toggleCollapsedThinking,
  toggleCollapsedToolCalls,
} = useUnifiedAgentStore();
```

### 二、拆分后的 Selector 方案

#### 1. 当前任务相关
```typescript
const activeTaskId = useUnifiedAgentStore(state => state.activeTaskId);
const activeTask = useUnifiedAgentStore(state => 
  state.activeTaskId ? state.tasks.find(t => t.id === state.activeTaskId) : null
);
const isProcessing = useUnifiedAgentStore(state => state.isProcessing);
```

#### 2. 当前流式相关
```typescript
const streamingMessage = useUnifiedAgentStore(state => state.streamingMessage);
const streamingThinking = useUnifiedAgentStore(state => state.streamingThinking);
const streamingToolCalls = useUnifiedAgentStore(state => state.streamingToolCalls);
const streamingItems = useUnifiedAgentStore(state => state.streamingItems);
const resultCards = useUnifiedAgentStore(state => state.resultCards);
const taskProgress = useUnifiedAgentStore(state => state.taskProgress);
```

#### 3. UI 折叠状态相关
```typescript
const collapsedThinking = useUnifiedAgentStore(state => state.collapsedThinking);
const collapsedToolCalls = useUnifiedAgentStore(state => state.collapsedToolCalls);
```

#### 4. Action 方法相关
```typescript
const toggleCollapsedThinking = useUnifiedAgentStore(state => state.toggleCollapsedThinking);
const toggleCollapsedToolCalls = useUnifiedAgentStore(state => state.toggleCollapsedToolCalls);
const createTask = useUnifiedAgentStore(state => state.createTask);
const sendMessage = useUnifiedAgentStore(state => state.sendMessage);
// ... 其他方法
```

### 三、displayMessages 依赖收缩

**当前依赖：**
```typescript
}, [activeTask, streamingMessage, streamingThinking, streamingToolCalls, streamingItems, isProcessing]);
```

**优化后：**
- 保持现有依赖不变（已经优化过了）
- 但注意 activeTask 现在来自 selector，引用稳定性取决于 selector 实现

### 四、需要额外处理的问题

#### 1. activeTask 的引用稳定性
当前方案：`tasks.find(t => t.id === activeTaskId)`
- 每次 tasks 数组变化都会返回新的 activeTask 对象
- 可能导致 displayMessages 仍然频繁重算

**建议方案：**
使用浅比较或只订阅 messages：
```typescript
const activeTaskMessages = useUnifiedAgentStore(state => {
  const task = state.activeTaskId ? state.tasks.find(t => t.id === state.activeTaskId) : null;
  return task?.messages;
});
```

#### 2. 方法引用稳定性
store 中的 action 方法需要确保引用稳定，否则子组件会认为 props 变化。

### 五、本轮不改的内容

1. **aiStreamService.ts** - 不涉及
2. **budget / continuation / remediation 逻辑** - 不涉及
3. **ChatPanel 整体渲染结构** - 只改订阅方式，不改渲染逻辑
4. **虚拟滚动** - 本轮不上
5. **streamingItems 持久化策略** - 已改好，不再动
6. **MessageContent 组件** - 已改好，不再动
7. **resultCards/taskProgress 传递逻辑** - 已改好，不再动

## 预期效果

1. **减少重渲染范围**：只有真正变化的字段对应的 selector 会触发更新
2. **隔离高频更新**：streamingMessage/items 等高频字段变化不会导致整个 ChatPanel 重渲
3. **保持功能完整**：所有原有功能保持不变，只优化订阅粒度
