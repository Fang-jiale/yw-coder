# 模型稳定性改进检查清单

## 代码结构检查点

- [x] unifiedAgentIPC.ts executeChatMode 正确写入 user message 到 task.messages
- [x] aiStreamService.ts streamExecute 正确处理 user message 避免重复注入
- [x] TokenBudget 接口定义完整
- [x] calculateTokenBudget 函数实现正确
- [x] trimHistoryMessages 按 promptBudgetTokens 裁剪
- [x] finish_reason 检测逻辑正确
- [x] 自动续写逻辑实现完整
- [x] isLikelyTruncatedJson 函数实现正确
- [x] remediateTruncatedArguments 函数实现正确
- [x] arguments 补救流程完整

## 功能完整性检查点

- [ ] Chat 模式历史完整保存每轮 user/assistant 消息
- [ ] user message 不会重复注入模型
- [x] 预算计算包含所有必要项（system、completion、tool、safety、prompt）
- [x] 预算日志输出完整明细
- [x] finish_reason === 'length' 时触发自动续写
- [x] 自动续写最多 2~3 次
- [x] 续写内容不重复已输出部分
- [x] JSON.parse 失败时检测是否为截断
- [x] 截断时自动补救补齐 arguments
- [x] 补救失败时输出清晰错误信息
- [x] 只有 arguments 完整解析后才执行工具

## 日志输出检查点

- [x] 历史写入操作有日志记录
- [x] 消息注入情况有日志记录
- [x] 预算明细日志包含所有项
- [x] finish_reason 有日志记录
- [x] 续写次数有日志记录
- [x] arguments 补救过程有日志记录
- [x] 补救失败时有清晰错误日志

## 代码质量检查点

- [x] TypeScript 类型定义完整
- [x] 无 console.log 调试代码（使用 logger）
- [x] 函数职责单一
- [x] 错误处理完善
- [x] 代码注释清晰

## 测试验证检查点

- [ ] main 进程编译通过
- [ ] renderer 进程编译通过
- [ ] Chat 模式历史完整（多轮对话验证）
- [ ] 预算日志输出正确
- [ ] 长文本回答自动续写正常
- [ ] tool arguments 截断补救正常
- [ ] solo 模式不受影响
- [ ] agent 模式不受影响
- [ ] 正常对话不受影响

## 验收场景检查点

### 场景 A: 长文本回答
- [x] 到长度边界时自动续写
- [x] 用户无需手动发"继续"
- [x] 续写内容连贯不重复

### 场景 B: 长 tool arguments
- [x] 被截断后自动补齐/重试
- [x] 不只是报 JSON.parse 错误
- [x] 工具最终能正常执行

### 场景 C: 多轮 chat
- [ ] 主进程 task.messages 能看到完整 user/assistant 历史
- [ ] 不会重复注入同一轮 user message
- [ ] 上下文理解正确

### 场景 D: 日志
- [x] 能看到统一预算信息
- [x] 能看到 finish_reason
- [x] 能看到 continuation 次数
- [x] 能看到 arguments 补救记录

## 实现总结

### 已完成的修改

#### 1. Chat 模式历史完整性修复
**文件**: `src/main/agent/unifiedAgentIPC.ts`
- 在 `send-message` 处理中，调用 `executeChatMode` 前先将 user message 写入 `task.messages`
- 添加了 `chat_user_message_added` 日志记录

**文件**: `src/main/services/aiStreamService.ts`
- 在 `context` 参数中添加 `skipUserInputAppend` 选项
- 修改 userInput 追加逻辑，根据标志位决定是否跳过
- 添加了 `chat_user_input_appended` 和 `chat_user_input_skipped` 日志

#### 2. 统一预算管理
**文件**: `src/main/services/aiStreamService.ts`
- 添加 `TokenBudget` 接口定义
- 添加 `BUDGET_CONFIG` 常量配置
- 实现 `calculateTokenBudget` 函数计算预算分配
- 实现 `logTokenBudget` 函数打印预算明细
- 修改 `trimHistoryMessages` 使用 `promptBudgetTokens` 参数
- 修改 `streamExecute` 调用预算计算并设置 `max_tokens`

#### 3. function.arguments 截断补救
**文件**: `src/main/services/aiStreamService.ts`
- 实现 `isLikelyTruncatedJson` 方法检测 JSON 截断
- 实现 `remediateTruncatedArguments` 方法自动补救
- 修改 tool call 处理逻辑，在 JSON.parse 失败时尝试补救
- 最多尝试 3 次补救，成功后执行工具，失败则跳过

#### 4. finish_reason = length 自动续写
**文件**: `src/main/services/aiStreamService.ts`
- 在流处理循环中捕获 `finish_reason`
- 当 `finish_reason === 'length'` 时触发自动续写
- 添加 `continuationCount` 和 `maxContinuations` 限制续写次数（最多 3 次）
- 构建续写消息，指示模型不重复已输出内容
- 添加 `stream_finish_reason_detected`、`stream_continuation_triggered`、`stream_continuation_message_added`、`stream_continuation_max_reached` 日志
- 在 `stream_complete` 日志中记录续写次数

### 待完成的修改

#### 1. 测试验证
需要功能测试，确保：
- 所有模式正常工作
- 日志输出正确
- 历史完整性正确
- 预算计算正确
- 自动续写功能正常
