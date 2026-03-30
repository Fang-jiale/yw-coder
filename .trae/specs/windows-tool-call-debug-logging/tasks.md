# Tasks

- [x] Task 1: 创建统一日志工具模块
  - [x] 在 src/main/utils/logger.ts 创建 Logger 类
  - [x] 实现单例模式，确保全局只有一个日志实例
  - [x] 实现日志按天滚动，文件名格式 ywcoder-YYYY-MM-DD.log
  - [x] 实现 JSON 格式输出
  - [x] 同时输出到控制台和文件

- [x] Task 2: 在 aiStreamService.ts 补充关键埋点
  - [x] streamExecute 入口记录 chat_request_start（含 model, useFunctionCall, toolsCount, traceId）
  - [x] 请求参数构建完成后记录 chat_request_params（含 messages 数量、tools 数量）
  - [x] 流处理过程中记录 tool_call_detected（当检测到 tool call 时）
  - [x] 流结束后记录 stream_complete（含 hasToolCall, toolCallCount）
  - [x] 错误时记录 stream_error（含 error message）
  - [x] 确保 traceId 贯穿整个流处理过程

- [x] Task 3: 在 aiToolService.ts 补充工具执行埋点
  - [x] executeTool 入口记录 tool_execute_start（含 toolName, traceId）
  - [x] 工具执行完成后记录 tool_execute_end（含 success, durationMs, error）
  - [x] 记录工具执行参数和结果摘要

- [x] Task 4: 在 unifiedAgentIPC.ts 补充事件埋点
  - [x] handleChatRequest 入口记录 chat_request_received（含 traceId）
  - [x] 发送 tool_start 事件前记录 emit_tool_start
  - [x] 发送 tool_end 事件后记录 emit_tool_end
  - [x] 发送 done 事件后记录 emit_done
  - [x] 发送 error 事件后记录 emit_error

- [x] Task 5: 在 index.ts 补充启动埋点
  - [x] app.whenReady 后记录 app_start
  - [x] 打开工作区后记录 workspace_opened（含 workspacePath）

- [ ] Task 6: 验证日志输出
  - [ ] 本地运行验证日志文件生成
  - [ ] 验证 JSON 格式正确
  - [ ] 验证 traceId 能串联同一轮提问

# Task Dependencies
- Task 2 依赖 Task 1（需要使用 Logger）
- Task 3 依赖 Task 1
- Task 4 依赖 Task 1
- Task 5 依赖 Task 1
- Task 6 依赖 Task 2, 3, 4, 5
