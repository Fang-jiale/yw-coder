# 模型稳定性改进任务清单

## 阶段一：代码分析与准备

- [x] 1.1: 阅读并理解 unifiedAgentIPC.ts 中 send-message 和 executeChatMode 逻辑
  - [x] 1.1.1: 分析当前 chat 模式历史构建流程
  - [x] 1.1.2: 识别 user message 写入 task.messages 的缺失点
  - [x] 1.1.3: 分析如何避免重复注入
- [x] 1.2: 阅读并理解 aiStreamService.ts 中 trimHistoryMessages 和 streamExecute 逻辑
  - [x] 1.2.1: 分析当前预算计算方式
  - [x] 1.2.2: 分析 finish_reason 处理逻辑
  - [x] 1.2.3: 分析 tool_calls 和 function.arguments 处理流程
- [x] 1.3: 设计预算模型数据结构
  - [x] 1.3.1: 定义 TokenBudget 接口
  - [x] 1.3.2: 定义预算计算函数

## 阶段二：修复 Chat 模式历史完整性

- [x] 2.1: 修改 unifiedAgentIPC.ts executeChatMode
  - [x] 2.1.1: 在调用 streamExecute 前将 user message 写入 task.messages
  - [x] 2.1.2: 确保 user message 格式正确（包含 id、role、content、timestamp）
  - [x] 2.1.3: 添加日志记录历史写入操作
- [x] 2.2: 修改 aiStreamService.ts streamExecute
  - [x] 2.2.1: 检查是否已包含当前轮 user message
  - [x] 2.2.2: 如果已包含，不再重复追加 userInput
  - [x] 2.2.3: 如果未包含（兼容旧逻辑），正常追加 userInput
  - [x] 2.2.4: 添加日志记录消息注入情况
- [ ] 2.3: 验证历史完整性
  - [ ] 2.3.1: 多轮对话后检查 task.messages 完整性
  - [ ] 2.3.2: 验证 user message 不重复

## 阶段三：统一预算管理

- [x] 3.1: 创建预算计算工具函数
  - [x] 3.1.1: 实现 calculateTokenBudget 函数
  - [x] 3.1.2: 实现 estimateTokens 函数（简单估算）
  - [x] 3.1.3: 定义预算常量（reservedCompletionTokens、reservedToolTokens、safetyMarginTokens）
- [x] 3.2: 修改 trimHistoryMessages
  - [x] 3.2.1: 接收 promptBudgetTokens 参数
  - [x] 3.2.2: 按 promptBudgetTokens 裁剪 history
  - [x] 3.2.3: 确保 system message 始终保留
  - [x] 3.2.4: 添加日志记录裁剪前后的 token 数
- [x] 3.3: 修改 streamExecute 预算逻辑
  - [x] 3.3.1: 调用 calculateTokenBudget 计算预算
  - [x] 3.3.2: 打印预算明细日志
  - [x] 3.3.3: 使用 promptBudgetTokens 调用 trimHistoryMessages
  - [x] 3.3.4: 使用 reservedCompletionTokens 设置 requestParams.max_tokens
- [ ] 3.4: 验证预算闭环
  - [ ] 3.4.1: 长对话场景验证预算计算正确
  - [ ] 3.4.2: 验证日志中预算明细完整

## 阶段四：finish_reason = length 自动续写

- [x] 4.1: 捕获 finish_reason
  - [x] 4.1.1: 在 streamExecute 中检测 finish_reason
  - [x] 4.1.2: 记录 finish_reason 到日志
  - [x] 4.1.3: 保存当前 assistant message 内容用于续写
- [x] 4.2: 实现自动续写逻辑
  - [x] 4.2.1: 如果 finish_reason === 'length'，触发续写
  - [x] 4.2.2: 构建 continuation 消息（包含已输出内容摘要）
  - [x] 4.2.3: 发送续写请求到模型
  - [x] 4.2.4: 限制续写次数（最多 2~3 次）
- [x] 4.3: 避免重复内容
  - [x] 4.3.1: 在 continuation 指令中指示模型不重复已输出内容
  - [x] 4.3.2: 分析已输出内容，提取断点位置
  - [x] 4.3.3: 续写内容追加到同一条 assistant message
- [ ] 4.4: 验证续写功能
  - [ ] 4.4.1: 长文本回答场景测试自动续写
  - [ ] 4.4.2: 验证续写次数限制有效
  - [ ] 4.4.3: 验证不重复内容

## 阶段五：function.arguments 截断补救

- [x] 5.1: 实现截断检测工具函数
  - [x] 5.1.1: 实现 isLikelyTruncatedJson 函数
    - [x] 检查括号/方括号平衡
    - [x] 检查引号闭合
    - [x] 检查末尾是否停在半个字段
  - [x] 5.1.2: 实现 remediateTruncatedArguments 函数
- [x] 5.2: 修改 tool_calls 处理逻辑
  - [x] 5.2.1: JSON.parse 失败时调用 isLikelyTruncatedJson
  - [x] 5.2.2: 如果是截断，进入补救流程
  - [x] 5.2.3: 如果不是截断，输出错误日志
- [x] 5.3: 实现 arguments 补救流程
  - [x] 5.3.1: 构建补救消息，指示模型补齐 JSON
  - [x] 5.3.2: 发送补救请求到模型
  - [x] 5.3.3: 解析补救后的 arguments
  - [x] 5.3.4: 限制补救次数（最多 2~3 次）
- [x] 5.4: 执行前验证
  - [x] 5.4.1: 只有 arguments 完整解析后才执行工具
  - [x] 5.4.2: 补救失败时输出清晰错误信息
  - [x] 5.4.3: 向用户展示错误信息，不静默失败
- [ ] 5.5: 验证补救功能
  - [ ] 5.5.1: 模拟截断场景测试自动补救
  - [ ] 5.5.2: 验证补救次数限制有效
  - [ ] 5.5.3: 验证补救失败时错误信息清晰

## 阶段六：集成与测试

- [ ] 6.1: 编译验证
  - [ ] 6.1.1: main 进程编译通过
  - [ ] 6.1.2: renderer 进程编译通过
- [ ] 6.2: 功能验证
  - [ ] 6.2.1: 验证 Chat 模式历史完整
  - [ ] 6.2.2: 验证预算日志输出正确
  - [ ] 6.2.3: 验证长文本自动续写
  - [ ] 6.2.4: 验证 tool arguments 截断补救
- [ ] 6.3: 回归测试
  - [ ] 6.3.1: 验证 solo 模式不受影响
  - [ ] 6.3.2: 验证 agent 模式不受影响
  - [ ] 6.3.3: 验证正常对话不受影响

## 任务依赖关系

```
阶段一（分析）
    ↓
阶段二（历史完整性）
    ↓
阶段三（预算管理）
    ↓
阶段四（自动续写）
    ↓
阶段五（截断补救）
    ↓
阶段六（测试）
```

阶段一可与其他阶段并行启动，为后续阶段提供输入。
阶段二和阶段三可以并行开发。
阶段四和阶段五可以并行开发。

## 实现状态说明

### 已完成
1. **Chat 模式历史完整性修复** - unifiedAgentIPC.ts 中 send-message 处理现在会先将 user message 写入 task.messages，然后才调用 executeChatMode。streamExecute 添加了 skipUserInputAppend 参数避免重复注入。

2. **统一预算管理** - 实现了 TokenBudget 接口和 calculateTokenBudget 函数，trimHistoryMessages 现在按 promptBudgetTokens 裁剪，requestParams.max_tokens 使用预算中预留的值。

3. **function.arguments 截断补救** - 实现了 isLikelyTruncatedJson 检测函数和 remediateTruncatedArguments 补救流程，最多尝试 3 次补救。

4. **finish_reason = length 自动续写** - 在 streamExecute 中捕获 finish_reason，当检测到 'length' 时自动触发续写，最多续写 3 次。续写指令指示模型不重复已输出内容。

### 待完成
1. **测试验证** - 需要功能测试验证各场景。
