# Checklist

- [x] Logger 模块实现
  - [x] 单例模式正确工作
  - [x] 日志按天滚动
  - [x] JSON 格式输出
  - [x] 同时输出到控制台和文件

- [x] aiStreamService.ts 埋点
  - [x] chat_request_start 事件正确记录
  - [x] chat_request_params 事件正确记录
  - [x] tool_call_detected 事件正确记录
  - [x] stream_complete 事件正确记录
  - [x] stream_error 事件正确记录
  - [x] traceId 贯穿整个流程

- [x] aiToolService.ts 埋点
  - [x] tool_execute_start 事件正确记录
  - [x] tool_execute_end 事件正确记录
  - [x] durationMs 计算正确
  - [x] error 信息正确记录

- [x] unifiedAgentIPC.ts 埋点
  - [x] chat_request_received 事件正确记录
  - [x] emit_tool_start 事件正确记录
  - [x] emit_tool_end 事件正确记录
  - [x] emit_done 事件正确记录
  - [x] emit_error 事件正确记录

- [x] index.ts 埋点
  - [x] app_start 事件正确记录
  - [x] workspace_opened 事件正确记录

- [ ] 日志验证
  - [ ] 日志文件正确生成
  - [ ] JSON 格式可解析
  - [ ] traceId 能串联同一轮提问
  - [ ] 日志内容能回答排查问题
