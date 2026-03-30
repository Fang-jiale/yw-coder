# 流式事件驱动渲染架构改造检查清单

## 代码结构检查点

- [x] StreamEventItem 类型定义在 shared 层
- [x] ContentStreamEvent 类型正确
- [x] ThinkingStreamEvent 类型正确
- [x] ToolStreamEvent 类型正确
- [x] TodoStreamEvent 类型正确
- [x] QuestionStreamEvent 类型正确
- [x] AgentMessage 包含 streamingItems 字段
- [x] aiStreamService 输出标准化 StreamEventItem
- [x] unifiedAgentIPC 支持 agent:event:stream-item
- [x] preload.ts 暴露 onStreamItem 接口
- [x] unifiedAgentStore 管理 streamingItems 状态
- [x] ChatPanel 使用 StreamEventItem 类型

## 功能完整性检查点

- [x] thinking 事件进入事件流
- [x] content 事件进入事件流
- [x] tool_start 创建 tool 事件
- [x] tool_end 更新 tool 事件状态
- [x] todo_update 进入事件流
- [x] agent_question 进入事件流
- [x] seq 严格递增
- [x] 事件按 seq 排序存储
- [x] streamingMessage 仅保留文本聚合

## 兼容性检查点

- [x] 旧消息（无 streamingItems）正常显示
- [x] 新消息优先走事件流
- [x] 最终 message 落库格式兼容
- [x] parseMessageContent 保留给历史消息

## 不破坏已有功能

- [x] continuation 逻辑不受影响
- [x] budget 计算不受影响
- [x] remediation 逻辑不受影响
- [x] 最终 message 结构不变

## 编译验证检查点

- [x] main 进程编译通过
- [x] renderer 进程类型检查（pre-existing 错误除外）

## 待功能测试验证

- [ ] thinking 正确渲染
- [ ] content 正确渲染
- [ ] tool 正确渲染（状态更新）
- [ ] todo 正确渲染
- [ ] question 正确渲染
- [ ] 事件顺序正确
