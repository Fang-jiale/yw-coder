# 流式事件驱动渲染架构改造规格说明

## Why

当前 Chat 输出展示采用"主进程解析一部分 + 前端再从字符串二次解析"的混合模式，导致：

1. **解析不一致**：主进程和前端各自解析 think/todo/question，容易出错
2. **跨 chunk 丢失**：半截标签在字符串拼接时容易丢失
3. **事件顺序丢失**：前端靠 parseMessageContent 推断结构，真实事件时间线被破坏
4. **维护困难**：同一逻辑在前后端重复实现，修改时需要同步

需要改造成真正的"事件流驱动渲染"架构：主进程是唯一解析器，前端只负责按事件顺序渲染。

## What Changes

### 架构改造
- **主进程**：唯一解析器，输出标准化 StreamEventItem 事件流
- **IPC 层**：统一 stream-item 事件通道，带 seq 保证顺序
- **Store 层**：保存结构化 streamingItems，不再从字符串解析
- **UI 层**：按 seq 顺序渲染事件流，不再固定板块布局

### 统一事件类型
- 定义 shared 层 StreamEventItem 类型，前后端共用
- 每个事件包含：id, seq, type, timestamp, 类型特定字段
- 类型覆盖：content, thinking, tool, todo, question

### 渲染逻辑改造
- 流式阶段：严格按 streamingItems 顺序渲染
- 历史消息：保留现有 fallback 兼容旧数据
- 不再依赖：appendStreamingMessage + parseMessageContent 二次解析

## Impact

- 受影响文件：
  - `src/shared/types.ts` - 新增 StreamEventItem 类型
  - `src/shared/agentTypes.ts` - 可能需要调整
  - `src/main/services/aiStreamService.ts` - 主进程事件标准化
  - `src/main/agent/unifiedAgentIPC.ts` - IPC 事件转发
  - `src/main/preload.ts` - 暴露新接口
  - `src/renderer/store/unifiedAgentStore.ts` - Store 改造
  - `src/renderer/components/Chat/ChatPanel.tsx` - 渲染逻辑改造

- 不影响：
  - 已修好的 continuation / budget / remediation 逻辑
  - 最终 message 落库格式（保留兼容）

## ADDED Requirements

### Requirement: 统一 StreamEventItem 类型定义

#### Scenario: 类型定义在 shared 层
- **WHEN** 定义流式事件项类型
- **THEN** 放在 `src/shared/types.ts` 或新建 `src/shared/streamEvents.ts`
- **AND** 前后端都能 import 使用
- **AND** 不要只在 ChatPanel 本地定义

#### Scenario: StreamEventItem 基础字段
- **GIVEN** 所有事件项都有以下基础字段：
  - id: string - 唯一标识
  - seq: number - 严格递增序列号，用于排序
  - type: 'content' | 'thinking' | 'tool' | 'todo' | 'question' - 事件类型
  - timestamp: number - 事件发生时间
- **WHEN** 创建任何事件项
- **THEN** 必须包含上述所有基础字段

#### Scenario: Content 事件类型
- **WHEN** type === 'content'
- **THEN** 包含字段：{ text: string }
- **AND** 表示普通文本内容片段

#### Scenario: Thinking 事件类型
- **WHEN** type === 'thinking'
- **THEN** 包含字段：{ text: string; done?: boolean }
- **AND** done 表示思考过程是否完成

#### Scenario: Tool 事件类型
- **WHEN** type === 'tool'
- **THEN** 包含字段：{ toolCallId: string; toolName: string; params: any; status: 'running' | 'completed' | 'error'; result?: any; error?: string }
- **AND** tool_start 和 tool_end 通过更新同一个 tool 事件项实现

#### Scenario: Todo 事件类型
- **WHEN** type === 'todo'
- **THEN** 包含字段：{ items: Array<{id: string; content: string; status: 'pending' | 'in_progress' | 'completed' | 'failed'}> }

#### Scenario: Question 事件类型
- **WHEN** type === 'question'
- **THEN** 包含字段：{ id: string; question: string; options?: Array<{id: string; label: string; value: string}>; context?: string }

### Requirement: 主进程统一输出结构化事件

#### Scenario: aiStreamService 输出标准化事件
- **WHEN** aiStreamService 产生 thinking / content / tool_start / tool_end / todo_update / agent_question 等事件
- **THEN** 统一转换为 StreamEventItem 格式
- **AND** 通过 unifiedAgentIPC 转发到 renderer
- **AND** 不再让前端从字符串解析 think/todo/question

#### Scenario: 统一 IPC 事件通道
- **WHEN** 主进程发送流式事件
- **THEN** 使用单一 channel：agent:event:stream-item
- **AND** 事件数据包含完整 StreamEventItem
- **AND** 不要让 renderer 靠多个 channel 自己拼时间线

#### Scenario: seq 序列号保证顺序
- **WHEN** 主进程发送多个流式事件
- **THEN** 每个事件的 seq 严格递增
- **AND** 前端按 seq 排序渲染，不靠推测顺序

### Requirement: Store 层改造成保存事件流

#### Scenario: unifiedAgentStore 新增 streamingItems
- **WHEN** 收到 stream-item 事件
- **THEN** 直接追加到 streamingItems 数组
- **AND** 按 seq 排序存储
- **AND** 不要再用 parseMessageContent 推断结构

#### Scenario: streamingMessage 职责调整
- **WHEN** 收到 content 事件
- **THEN** streamingMessage 可以继续追加文本
- **AND** 但只作为纯文本聚合，不再承担结构解析职责
- **AND** 流式展示优先使用 streamingItems

#### Scenario: Tool 事件合并更新
- **WHEN** 收到 tool_start 事件
- **THEN** 创建新的 tool 类型 StreamEventItem
- **WHEN** 收到 tool_end 事件
- **THEN** 找到相同 toolCallId 的 item 更新 status/result/error
- **AND** 不要在事件流里创建两个独立 item

#### Scenario: Todo/Question 进入事件流
- **WHEN** 收到 todo_update 或 agent_question 事件
- **THEN** 创建对应类型的 StreamEventItem
- **AND** 进入 streamingItems 时间线
- **AND** 不要只在最终 content 里解析标签

### Requirement: ChatPanel 按事件流渲染

#### Scenario: 流式阶段优先使用 streamingItems
- **WHEN** isStreaming === true 且 streamingItems.length > 0
- **THEN** 只按 streamingItems 顺序渲染
- **AND** 渲染顺序严格按 seq，不要写死固定板块顺序

#### Scenario: 事件类型渲染组件
- **WHEN** 渲染 streamingItems
- **THEN** 根据 type 选择对应渲染组件：
  - content -> 文本内容块
  - thinking -> 思考过程块
  - tool -> 工具调用卡片
  - todo -> 任务进度列表
  - question -> 提问卡片

#### Scenario: 历史消息兼容
- **WHEN** 渲染历史消息（没有 streamingItems）
- **THEN** 保留现有 fallback 逻辑
- **AND** 可以调用 parseMessageContent 解析
- **AND** 但当前流式消息不要走这个分支

#### Scenario: 不再固定板块布局
- **WHEN** 渲染流式消息
- **THEN** 不要写死：工具调用 -> 思考 -> 问题 -> todo -> 内容
- **AND** 严格按事件发生的真实时间顺序渲染

## MODIFIED Requirements

### Requirement: 流式消息展示逻辑
**原实现**：
- 依赖 streamingMessage 字符串
- 调用 parseMessageContent 解析 think/todo/question
- 固定板块顺序渲染

**修改后**：
- 优先使用 streamingItems 事件流
- 直接按事件类型渲染，不再二次解析
- 按 seq 顺序渲染，不固定板块

### Requirement: Tool 调用展示
**原实现**：
- 依赖 message.toolCalls 数组
- 流式阶段无法实时更新

**修改后**：
- 从 streamingItems 中筛选 tool 类型事件
- tool_start 立即展示，tool_end 更新状态
- 同一个 toolCallId 对应同一个事件项

## REMOVED Requirements

无

## 验收标准

### A. 思考内容
- [ ] 流式阶段思考块按 thinking 类型事件出现
- [ ] 不再依赖 content 字符串解析 `<think>` 标签
- [ ] thinking complete 时正确标记 done 状态

### B. 工具调用
- [ ] tool_start 事件出现时立即展示工具卡片
- [ ] tool_end 时更新同一个工具卡片状态
- [ ] 顺序跟随真实事件时间，不固定排在最上面

### C. Todo / Question
- [ ] todo_update 事件直接出现在流式时间线中
- [ ] agent_question 事件直接出现在流式时间线中
- [ ] 不需要等最终 content 再解析标签

### D. 内容正文
- [ ] content 事件按 seq 持续追加
- [ ] 不影响最终 assistant message.content 落库

### E. 兼容旧消息
- [ ] 老消息没有 streamingItems 时，仍可按现有逻辑展示
- [ ] 新流式消息优先走事件流渲染
- [ ] parseMessageContent 保留给历史消息 fallback

### F. 预算不破坏
- [ ] 不修改已修好的 continuation 逻辑
- [ ] 不修改已修好的 budget 计算
- [ ] 不修改已修好的 remediation 逻辑
