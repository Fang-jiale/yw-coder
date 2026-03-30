# 任务列表

## 任务 1: 修复 resultCards/taskProgress 重复渲染问题
- [x] 1.1 修改 ChatPanel 消息 map 逻辑，只有 isStreaming === true 的消息才传 resultCards 和 taskProgress
- [x] 1.2 历史消息传 undefined 给 resultCards 和 taskProgress
- [x] 1.3 验证只有当前流式消息显示 resultCards 和 taskProgress

## 任务 2: 在 clearStreaming 中清理全局状态
- [x] 2.1 修改 unifiedAgentStore.ts 的 clearStreaming，添加 resultCards: [] 和 taskProgress: null
- [x] 2.2 验证流式结束后 resultCards 和 taskProgress 被清空

## 任务 3: 优化 displayMessages 依赖
- [x] 3.1 修改 displayMessages useMemo，优先依赖 activeTask 而不是整个 tasks 数组
- [x] 3.2 减少 message 对象的重复创建，能复用引用的地方尽量复用
- [x] 3.3 验证 store 其他字段更新时不会触发消息列表重建

## 任务 4: AIMessage 组件 memo 优化
- [x] 4.1 对 AIMessage 组件做 React.memo
- [x] 4.2 验证消息组件只在必要时重渲染

# 任务依赖关系
- 任务 1 和任务 2 可以并行进行
- 任务 3 和任务 4 可以并行进行
- 所有任务完成后进行整体验证
