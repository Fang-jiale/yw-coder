# 流式事件项渲染落地实施计划

## 目标

解决当前"事件流渲染还没真正落地"的3个关键问题：
1. 当前流式消息 streamingMsg 没有真正带上 streamingItems
2. ChatPanel 虽然有 streamingItems 分支，但仍然按固定板块渲染，不是按 seq 时间线渲染
3. streamingItems 还没有真正沉淀到最终 assistant message 中

## 实施步骤

### 步骤一：让当前流式消息真正带上 streamingItems

**文件**: `src/renderer/components/Chat/ChatPanel.tsx`

**修改内容**:

1. 在构造 `streamingMsg` 时，把 `streamingItems` 一起塞进去
   - 找到构造 `streamingMsg` 的代码位置（大约在消息列表渲染区域）
   - 添加 `streamingItems` 字段

2. 修改显示 `streamingMsg` 的条件
   - 当前条件：`streamingMessage || streamingThinking || streamingToolCalls.length > 0`
   - 新条件：增加 `streamingItems.length > 0`

3. 确保即使只有 stream-item 事件，没有旧字符串流内容，流式消息也能显示

**代码位置**: ChatPanel.tsx 中消息列表渲染部分，大约在 1600-1700 行附近

---

### 步骤二：ChatPanel 改成真正按 seq 渲染 streamingItems

**文件**: `src/renderer/components/Chat/ChatPanel.tsx`

**修改内容**:

1. 修改 `MessageContent` 组件中的 `streamingItems` 分支
   - 当前：按板块 filter（tool → thinking → question → todo → content）
   - 新：直接按 seq 排序后 map 渲染

2. 创建渲染函数 `renderStreamItem(item: StreamEventItem)`:
   ```typescript
   const renderStreamItem = (item: StreamEventItem) => {
     switch (item.type) {
       case 'thinking':
         return <ThinkingBlock ... />;
       case 'tool':
         return <ToolCallCard ... />;
       case 'todo':
         return <TodoList ... />;
       case 'question':
         return <AgentQuestion ... />;
       case 'content':
         return <ContentBlock ... />;
     }
   };
   ```

3. 修改渲染逻辑:
   ```typescript
   // 按 seq 排序
   const sortedItems = [...streamingItems].sort((a, b) => a.seq - b.seq);
   
   // 直接 map 渲染
   {sortedItems.map((item) => renderStreamItem(item))}
   ```

4. 删除固定板块顺序的代码:
   - 删除 tool 板块 filter
   - 删除 thinking 板块 filter
   - 删除 question 板块 filter
   - 删除 todo 板块 filter
   - 删除 content 板块 filter

**代码位置**: MessageContent 组件中，大约在 827-950 行附近

---

### 步骤三：把 streamingItems 沉淀到最终 assistant message

**文件**: `src/renderer/store/unifiedAgentStore.ts`

**修改内容**:

1. 修改 `addMessage` action，当添加 assistant 消息时，把当前 `streamingItems` 一并写入
   ```typescript
   addMessage: (taskId, message) => {
     set((state) => {
       const task = state.tasks.find((t) => t.id === taskId);
       if (task) {
         // 如果是 assistant 消息，把 streamingItems 一并写入
         if (message.role === 'assistant') {
           message.streamingItems = [...state.streamingItems];
         }
         task.messages.push(message);
         task.updatedAt = Date.now();
       }
     });
   },
   ```

2. 修改 `clearStreaming`，确保在 streamingItems 已经安全并入最终消息后再清空
   - 当前 `clearStreaming` 在 `onComplete` 时被调用
   - 需要确保调用时机在 `addMessage` 之后

3. 或者修改 `onMessage` 事件处理，在收到 assistant 消息时自动附加 streamingItems
   - 找到 `window.electronAPI?.unifiedAgent?.onMessage` 处理逻辑
   - 在添加消息前，把 `streamingItems` 附加到消息上

**代码位置**: 
- addMessage action: 约 469-477 行
- onMessage 事件监听: 约 820-865 行
- clearStreaming: 约 688-696 行

---

### 步骤四：setActiveTask 切任务时清理 streamingItems

**文件**: `src/renderer/store/unifiedAgentStore.ts`

**修改内容**:

在 `setActiveTask` 中，当切换任务时，确保清理 `streamingItems`:

```typescript
setActiveTask: async (taskId) => {
  // ... 现有代码 ...
  
  set({
    activeTaskId: taskId,
    // ... 其他状态 ...
    
    // 重置流式状态
    streamingMessage: '',
    streamingThinking: '',
    streamingToolCalls: [],
    streamingItems: [],  // 添加这行
    isProcessing: task?.status === 'running',
  });
},
```

**代码位置**: setActiveTask action，约 425-455 行

---

### 步骤五：验证旧历史消息兼容

**文件**: `src/renderer/components/Chat/ChatPanel.tsx`

**确保**:
- 历史消息没有 `streamingItems` 时，仍可按现有逻辑展示
- 新消息优先走 `streamingItems` 渲染
- 条件判断：`streamingItems && streamingItems.length > 0` 才走新逻辑

---

## 修改文件清单

1. `src/renderer/store/unifiedAgentStore.ts`
   - 修改 addMessage，附加 streamingItems
   - 修改 setActiveTask，清理 streamingItems
   - （可选）调整 clearStreaming 时机

2. `src/renderer/components/Chat/ChatPanel.tsx`
   - 修改 streamingMsg 构造，带上 streamingItems
   - 修改显示条件，包含 streamingItems.length > 0
   - 修改 MessageContent 的 streamingItems 分支，按 seq 渲染
   - 创建 renderStreamItem 函数
   - 删除固定板块顺序代码

3. （如有必要）`src/shared/types.ts`
   - 确认 StreamEventItem 类型已正确定义

---

## 验证要点

1. 流式阶段：UI 真正按 streamingItems 的 seq 时间线渲染
2. 结束后：最终 assistant message 自带 streamingItems
3. 旧消息：没有 streamingItems 时仍可按旧逻辑展示
4. 切任务：setActiveTask 时 streamingItems 被清理
5. 当前流式阶段：不再依赖 content 字符串二次解析
