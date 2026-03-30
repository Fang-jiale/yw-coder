# 模型稳定性改进规格说明

## Why

当前 Chat 模式存在以下稳定性问题，严重影响用户体验：

1. **Chat 模式历史不完整**：主进程 task.messages 缺少当前轮 user message，导致历史记录不完整，影响多轮对话的上下文理解
2. **32KB 场景下回答半路停止**：prompt 和 completion 预算没有统一管理，导致总 token 数超限，模型输出被截断
3. **function/tool arguments 被截断后无补救**：JSON.parse 失败后仅记录日志，工具调用失败但链路继续，用户无感知

## What Changes

### 一、修复 Chat 模式主进程历史不完整
- **统一历史管理**：Chat 模式也要把当前 user message 写入主进程 session.task.messages
- **避免重复注入**：确保 user message 只进入模型一次，不重复
- **完整历史保存**：chat 模式下主进程 task.messages 完整保存每轮 user/assistant 历史

### 二、统一 prompt/completion 总预算
- **建立预算模型**：明确 effectiveContextBudget、systemPromptTokens、reservedCompletionTokens、reservedToolTokens、safetyMarginTokens、promptBudgetTokens
- **按预算裁剪 history**：trimHistoryMessages 只能按 promptBudgetTokens 裁剪
- **统一 max_tokens**：requestParams.max_tokens 使用同一套预算预留的 completionTokens
- **预算日志**：打印预算明细，方便验证

### 三、处理 finish_reason = length，自动续写
- **捕获 finish_reason**：在 streamExecute 中检测模型停止原因
- **自动 continuation**：如果 finish_reason === 'length'，自动继续生成
- **续写次数限制**：最多自动续写 2~3 次，避免死循环
- **避免重复内容**：continuation 时尽量不重复前面已输出内容
- **保持消息连续性**：continuation 过程尽量保持为同一条 assistant 消息

### 四、修复 function.arguments 截断后的补救逻辑
- **截断检测**：区分"普通格式错误"和"明显截断"
- **截断特征识别**：finish_reason === 'length'、括号/方括号不平衡、引号未闭合、末尾停在半个字段
- **自动补救**：判断为截断时进入 continuation，让模型补齐 arguments
- **执行前验证**：只有 function.arguments 成功解析成完整 JSON 后才执行工具
- **失败处理**：连续补救 2~3 次仍失败时输出清晰日志，不静默失败

## Impact

- 受影响文件：
  - `src/main/agent/unifiedAgentIPC.ts` - send-message、executeChatMode、history 构建
  - `src/main/services/aiStreamService.ts` - trimHistoryMessages、streamExecute、tool_calls 处理
- 不影响：
  - ChatPanel / streamingItems / 输出分层 UI
  - solo / agent 模式

## ADDED Requirements

### Requirement: Chat 模式历史完整性

#### Scenario: user message 写入主进程历史
- **WHEN** Chat 模式下收到用户消息
- **THEN** 将 user message 写入 session.task.messages
- **AND** 确保同一轮 user message 不会重复传给模型
- **AND** 主进程 task.messages 包含完整的 user/assistant 历史

#### Scenario: 避免重复注入
- **GIVEN** aiStreamService.streamExecute() 会把 userInput 追加到 messages
- **WHEN** Chat 模式调用 streamExecute
- **THEN** 统一处理，保证当前轮 user message 只进入模型一次
- **AND** 不重复、不遗漏

### Requirement: 统一预算管理

#### Scenario: 预算模型定义
- **GIVEN** 总预算为 effectiveContextBudget（如 32KB）
- **THEN** 预算分配如下：
  - systemPromptTokens: system prompt 占用的 token
  - reservedCompletionTokens: 预留的 completion 空间
  - reservedToolTokens: 预留的工具调用空间
  - safetyMarginTokens: 安全边距
  - promptBudgetTokens: history 可用预算 = effectiveContextBudget - systemPromptTokens - reservedCompletionTokens - reservedToolTokens - safetyMarginTokens

#### Scenario: 按预算裁剪 history
- **WHEN** trimHistoryMessages 执行时
- **THEN** 只能按 promptBudgetTokens 裁剪 history
- **AND** 保留 system message 和尽可能多的历史消息

#### Scenario: 统一 max_tokens 设置
- **WHEN** 设置 requestParams.max_tokens
- **THEN** 使用同一套预算中预留的 reservedCompletionTokens
- **AND** 打印预算日志，包含所有预算项明细

### Requirement: finish_reason = length 自动续写

#### Scenario: 检测长度限制停止
- **WHEN** 模型流式输出完成
- **THEN** 检查 finish_reason
- **AND** 如果 finish_reason === 'length'，触发自动续写

#### Scenario: 自动续写实现
- **WHEN** 触发自动续写
- **THEN** 发送 continuation 指令："继续上一条未完成的回复，禁止重复已输出内容；如果停在 JSON / 标签 / 结构中间，请先补齐结构，再继续正文。"
- **AND** 最多自动续写 2~3 次
- **AND** 尽量保持为同一条 assistant 消息

#### Scenario: 避免重复内容
- **WHEN** 续写时
- **THEN** 分析已输出内容
- **AND** 指示模型不重复已输出部分
- **AND** 从断点继续

### Requirement: function.arguments 截断补救

#### Scenario: 截断检测
- **GIVEN** 工具参数 JSON 字符串
- **WHEN** JSON.parse 失败
- **THEN** 检查是否为截断：
  - finish_reason === 'length'
  - 括号/方括号不平衡
  - 引号未闭合
  - 末尾明显停在半个字段/半个字符串

#### Scenario: 截断自动补救
- **WHEN** 判断为截断
- **THEN** 进入 continuation 流程
- **AND** 让模型补齐 arguments
- **AND** 重新尝试 JSON.parse

#### Scenario: 执行前验证
- **WHEN** 准备执行工具
- **THEN** 验证 function.arguments 已完整解析为 JSON
- **AND** 只有验证通过后才执行工具
- **AND** 验证失败时进入补救流程

#### Scenario: 补救失败处理
- **WHEN** 连续补救 2~3 次仍失败
- **THEN** 输出清晰错误日志
- **AND** 向用户展示错误信息
- **AND** 不静默失败

## MODIFIED Requirements

无

## REMOVED Requirements

无
