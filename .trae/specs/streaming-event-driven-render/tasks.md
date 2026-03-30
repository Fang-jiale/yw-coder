# 流式事件驱动渲染架构改造任务清单

## 阶段一：Shared 层类型定义

- [x] 1.1: 在 shared 层定义 StreamEventItem 类型
  - [x] 1.1.1: 创建基础接口 StreamEventItemBase（id, seq, type, timestamp）
  - [x] 1.1.2: 创建 ContentStreamEvent 类型
  - [x] 1.1.3: 创建 ThinkingStreamEvent 类型
  - [x] 1.1.4: 创建 ToolStreamEvent 类型
  - [x] 1.1.5: 创建 TodoStreamEvent 类型
  - [x] 1.1.6: 创建 QuestionStreamEvent 类型
  - [x] 1.1.7: 导出统一的 StreamEventItem 联合类型

- [x] 1.2: 更新 AgentMessage 类型支持 streamingItems
  - [x] 1.2.1: 在 AgentMessage 中添加可选的 streamingItems 字段
  - [x] 1.2.2: 确保类型前后端都能正确导入

## 阶段二：主进程事件标准化

- [x] 2.1: 在 aiStreamService.ts 中添加 seq 计数器
  - [x] 2.1.1: 在 streamExecute 中添加 streamEventSeq 变量
  - [x] 2.1.2: 每次发送事件时 seq 递增

- [x] 2.2: 改造 thinking 事件输出
  - [x] 2.2.1: thinking chunk 时发送 ThinkingStreamEvent
  - [x] 2.2.2: thinking complete 时发送带 done=true 的 ThinkingStreamEvent

- [x] 2.3: 改造 content 事件输出
  - [x] 2.3.1: content chunk 时发送 ContentStreamEvent

- [x] 2.4: 改造 tool 事件输出
  - [x] 2.4.1: tool_start 时发送 ToolStreamEvent（status='running'）
  - [x] 2.4.2: tool_end 时发送 ToolStreamEvent（status='completed'/'error'）

- [x] 2.5: 改造 todo 事件输出
  - [x] 2.5.1: todo_update 时发送 TodoStreamEvent

- [x] 2.6: 改造 question 事件输出
  - [x] 2.6.1: agent_question 时发送 QuestionStreamEvent

## 阶段三：IPC 层改造

- [x] 3.1: 在 unifiedAgentIPC.ts 中添加统一 stream-item 事件
  - [x] 3.1.1: 新增 agent:event:stream-item IPC 事件
  - [x] 3.1.2: 在 executeChatMode 中处理 stream-item 转发

- [x] 3.2: 在 preload.ts 中暴露新接口
  - [x] 3.2.1: 添加 onStreamItem(callback) 接口
  - [x] 3.2.2: 确保类型定义正确

## 阶段四：Store 层改造

- [x] 4.1: 在 unifiedAgentStore.ts 中添加 streamingItems 状态
  - [x] 4.1.1: 添加 streamingItems 数组到 store state
  - [x] 4.1.2: 添加 addStreamItem action
  - [x] 4.1.3: 添加 updateStreamItem action（用于 tool_end 更新）
  - [x] 4.1.4: 添加 clearStreamingItems action

- [x] 4.2: 改造事件接收逻辑
  - [x] 4.2.1: 监听 onStreamItem 事件
  - [x] 4.2.2: 根据事件类型调用 add 或 update
  - [x] 4.2.3: 保持 streamingMessage 文本聚合（仅用于兼容）

- [x] 4.3: 在消息完成时保存 streamingItems
  - [x] 4.3.1: done 事件时将 streamingItems 保存到 message
  - [x] 4.3.2: 清空临时 streamingItems

## 阶段五：ChatPanel 渲染改造

- [x] 5.1: 更新 ChatPanel 使用 StreamEventItem 类型
  - [x] 5.1.1: 导入 StreamEventItem 类型
  - [x] 5.1.2: 更新 Message 接口中的 streamingItems 类型
  - [x] 5.1.3: 更新 MessageContentProps 接口
  - [x] 5.1.4: 更新 AIMessageProps 接口
  - [x] 5.1.5: 删除旧的 StreamingItem 本地定义

- [x] 5.2: 改造工具调用渲染逻辑
  - [x] 5.2.1: 从 streamingItems 中筛选 tool 类型事件
  - [x] 5.2.2: 将 StreamEventItem 转换为 ToolCallInfo
  - [x] 5.2.3: 渲染 ToolCallCard 组件

- [x] 5.3: 保留历史消息兼容
  - [x] 5.3.1: 旧消息（无 streamingItems）正常显示
  - [x] 5.3.2: 新消息优先走事件流

## 阶段六：集成测试

- [x] 6.1: 编译验证
  - [x] 6.1.1: main 进程编译通过
  - [x] 6.1.2: renderer 进程类型检查（pre-existing 错误除外）

- [ ] 6.2: 功能验证
  - [ ] 6.2.1: thinking 事件正确渲染
  - [ ] 6.2.2: content 事件正确渲染
  - [ ] 6.2.3: tool 事件正确渲染（start/end 状态更新）
  - [ ] 6.2.4: todo 事件正确渲染
  - [ ] 6.2.5: question 事件正确渲染
  - [ ] 6.2.6: 事件顺序正确（按 seq）

- [ ] 6.3: 兼容性验证
  - [ ] 6.3.1: 旧消息（无 streamingItems）正常显示
  - [ ] 6.3.2: 新消息优先走事件流
  - [ ] 6.3.3: 最终 message 落库格式兼容

- [ ] 6.4: 回归测试
  - [ ] 6.4.1: continuation 逻辑不受影响
  - [ ] 6.4.2: budget 计算不受影响
  - [ ] 6.4.3: remediation 逻辑不受影响

## 任务依赖关系

```
阶段一（类型定义）
    ↓
阶段二（主进程事件）
    ↓
阶段三（IPC 层）
    ↓
阶段四（Store 层）
    ↓
阶段五（ChatPanel 渲染）
    ↓
阶段六（测试）
```

阶段一、二可以并行开发。
阶段三依赖阶段二。
阶段四依赖阶段三。
阶段五依赖阶段四。
阶段六依赖阶段五。
