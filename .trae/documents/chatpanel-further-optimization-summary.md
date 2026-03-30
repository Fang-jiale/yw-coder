# ChatPanel 进一步优化总结

## 优化背景
在前几轮优化的基础上，继续针对 ChatPanel 的订阅方式和消息列表渲染进行深度优化，进一步降低重渲染成本和崩溃风险。

## 优化内容

### 一、直接 Selector 订阅当前 activeTask

**问题：**
- 之前虽然拆分了 selector，但仍然订阅了整个 `tasks` 数组
- 然后在组件内通过 `tasks.find(t => t.id === activeTaskId)` 查找 activeTask
- 这导致任意任务变化都会触发 ChatPanel 重渲染

**修复：**
```typescript
// 原来
const tasks = useUnifiedAgentStore(state => state.tasks);
const activeTask = activeTaskId ? tasks.find(t => t.id === activeTaskId) : null;

// 现在
const activeTask = useUnifiedAgentStore(state =>
  state.activeTaskId ? state.tasks.find(t => t.id === state.activeTaskId) : null
);
```

**效果：**
- ChatPanel 不再直接依赖整个 tasks 数组
- 订阅范围收窄到"当前任务"本身
- 其他任务变化对 ChatPanel 的影响降低

---

### 二、减少 displayMessages 对历史消息对象的重建

**问题：**
- displayMessages 里对 `activeTask.messages` 做 map，重新包装 message/toolCalls 等对象
- 导致历史消息引用不稳定，每次都会创建新对象
- React 难以复用历史消息节点，长对话时渲染成本过高

**修复：**
```typescript
// 原来
const messages: Message[] = activeTask.messages.map((m) => ({
  id: m.id,
  role: m.role as 'user' | 'assistant',
  content: m.content,
  // ... 每次都创建新对象
}));

// 现在
const historicalMessages: Message[] = activeTask.messages as Message[];

// 只有在流式阶段才构造临时消息
if (isProcessing && ...) {
  const streamingMsg: Message = { ... };
  return [...historicalMessages, streamingMsg];
}

return historicalMessages;
```

**效果：**
- 历史消息直接使用原对象，避免无意义的重新构造
- 只有"当前流式中的临时消息"需要额外构造
- 历史消息列表保持稳定，React.memo 更容易生效
- 流式更新时，尽量只影响当前 streaming message

---

### 三、保守处理 AIMessage Memo

**问题：**
- 之前使用了自定义的比较函数，可能遗漏某些应该触发更新的字段
- 存在"内容变了但组件不更新"的隐性 bug 风险

**修复：**
```typescript
// 原来
const AIMessage = React.memo(AIMessageComponent, (prevProps, nextProps) => {
  return (
    prevProps.messageId === nextProps.messageId &&
    prevProps.content === nextProps.content &&
    // ... 多个字段比较
  );
});

// 现在
const AIMessage = React.memo(AIMessageComponent);
// 使用默认浅比较，确保所有 props 变化都能触发更新
```

**效果：**
- 采用更保守、更安全的默认浅比较
- 避免自定义 comparator 遗漏字段导致的隐性 bug
- 在 displayMessages 优化后，消息引用更稳定，memo 效果自然更好

---

### 四、修复使用 tasks 的地方

在优化过程中，发现并修复了多处直接使用 `tasks` 的地方，改为使用 `activeTask`：

1. **saveEditMessage** - 使用 activeTask 替代 tasks.find
2. **deleteMessage** - 使用 activeTask 替代 tasks.find
3. **clearConversation** - 使用 activeTask 替代 tasks.find
4. **exportConversation** - 使用 activeTask 替代 tasks.find
5. **onAnswerQuestion** - 使用 activeTask 替代 tasks.find

---

## 本轮未改动的内容

1. **aiStreamService.ts** - 不涉及
2. **budget / continuation / remediation 逻辑** - 不涉及
3. **streamingItems 持久化策略** - 保持之前修改（不持久化到历史消息）
4. **虚拟滚动** - 本轮不上
5. **主进程事件模型** - 不涉及
6. **ChatPanel 整体渲染结构** - 只改订阅方式和消息构造逻辑

---

## 优化效果

1. **订阅范围进一步收窄**：ChatPanel 不再依赖整个 tasks 数组，只关注当前 activeTask
2. **历史消息列表稳定**：不再无意义地重建历史消息对象，引用更稳定
3. **React.memo 更有效**：消息引用稳定后，memo 能真正发挥作用
4. **流式更新隔离**：高频流式更新尽量只影响当前消息，不带动整批历史消息重渲
5. **代码更安全**：AIMessage memo 采用保守策略，避免隐性 bug

---

## 为什么能进一步降低崩溃风险

1. **减少重渲染范围**：从"任意任务变化"缩小到"当前任务变化"
2. **对象引用稳定**：历史消息不再频繁创建新对象，React 调和算法更高效
3. **内存压力降低**：不再为每条历史消息创建包装对象，内存占用更稳定
4. **渲染批次减少**：消息列表稳定后，React 批处理更有效
