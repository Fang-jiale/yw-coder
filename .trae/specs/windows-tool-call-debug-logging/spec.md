# Windows 工具调用调试日志方案 Spec

## Why
项目打包后部署到内网 Windows 10 云桌面环境，无法现场调试。需要通过预先埋好的日志来排查工具调用失效问题：模型知道有哪些工具，但执行任务时没有明显工具调用痕迹。

## What Changes
- 设计统一、简洁、可落盘的日志方案
- 在关键链路补充必要埋点
- 日志同时输出到控制台和文件
- 按天落盘，格式为单行 JSON
- 每轮提问生成 traceId，同一轮日志带相同 traceId

## Impact
- Affected files:
  - src/main/index.ts - 基础启动信息
  - src/main/agent/unifiedAgentIPC.ts - 请求接收和事件发送
  - src/main/services/aiStreamService.ts - 核心流式处理（重点）
  - src/main/services/aiToolService.ts - 工具执行

## ADDED Requirements

### Requirement: 日志基础设施
The system SHALL provide a simple logger that writes to both console and file.

#### Scenario: 日志初始化
- **WHEN** 应用启动
- **THEN** 日志系统初始化，确定日志目录和文件路径
- **AND** 日志按天滚动，格式为 ywcoder-YYYY-MM-DD.log

#### Scenario: 日志写入
- **WHEN** 调用 logger.info/error/debug
- **THEN** 同时输出到控制台和日志文件
- **AND** 格式为单行 JSON

### Requirement: TraceId 追踪
The system SHALL generate a unique traceId for each user question round.

#### Scenario: 新提问开始
- **WHEN** 用户发起新一轮提问
- **THEN** 生成 traceId（格式：chat_${timestamp}_${random}）
- **AND** 该轮所有相关日志都携带此 traceId

### Requirement: 关键链路埋点
The system SHALL log key events in the tool call chain.

#### Scenario: aiStreamService 埋点
- **WHEN** streamExecute 被调用
- **THEN** 记录 chat_request_start（含 model, useFunctionCall, toolsCount）
- **WHEN** 请求参数构建完成
- **THEN** 记录 chat_request_params（含完整请求参数摘要）
- **WHEN** 流结束
- **THEN** 记录 stream_complete（含是否有 tool call）
- **WHEN** 发生错误
- **THEN** 记录 stream_error

#### Scenario: aiToolService 埋点
- **WHEN** 工具开始执行
- **THEN** 记录 tool_execute_start（含 toolName, traceId）
- **WHEN** 工具执行结束
- **THEN** 记录 tool_execute_end（含 success, durationMs, error）

#### Scenario: unifiedAgentIPC 埋点
- **WHEN** 收到聊天请求
- **THEN** 记录 chat_request_received
- **WHEN** 发送 tool_start 事件
- **THEN** 记录 emit_tool_start
- **WHEN** 发送 tool_end 事件
- **THEN** 记录 emit_tool_end

#### Scenario: 主进程埋点
- **WHEN** 应用启动
- **THEN** 记录 app_start
- **WHEN** 打开工作区
- **THEN** 记录 workspace_opened

## 日志字段规范
每条日志必须包含：
- ts: ISO 8601 时间戳
- level: DEBUG/INFO/WARN/ERROR
- event: 事件名称（snake_case）
- traceId: 追踪ID（如有）
- message: 可选描述
- 关键业务字段（根据事件类型）

示例：
```json
{"ts":"2026-03-23T20:15:11.123Z","level":"INFO","event":"chat_request_start","traceId":"chat_abc123","model":"gpt-4","useFunctionCall":true,"toolsCount":8}
```
