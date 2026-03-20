# 修复思考过程流式更新时标签暴露问题

## Why

当前对话面板存在流式更新时思考过程标签暴露的问题：
- 第一段 assistant 输出时，思考过程可以被折叠
- 后续流式输出中，`<think>`、`<todo>`、` <task>` 等内部协议文本直接出现在正文区域
- 这说明消息分区逻辑不是稳定地作用于整个流式生命周期

## 问题分析

### 当前消息渲染链路

```
AI 输出 → aiStreamService 解析 → unifiedAgentStore 存储 → ChatPanel 渲染
```

**潜在问题点**：
1. 是否只有在消息首次创建时做了解析，而消息 update/streaming 阶段只是 raw append，没有重新 parse
2. 最终正文渲染是否直接使用了 rawContent，而不是 cleanedVisibleContent
3. parser 是否只能处理完整闭合标签，无法处理流式分块场景
4. 在提取 think/todo/task 后，是否真的把这些片段从最终可见正文中移除了
5. 任务进度和思考过程是否共享同一份原始文本，导致"提取了但未消费掉"

### 当前流式更新链路

**分析要点**：
1. `setupUnifiedAgentEventListeners` 中 `onStreamContent`、`onThinking`、`onThinkingComplete` 的处理逻辑
2. `appendStreamingMessage` 是否每次都重新解析 content
3. `updateThinking` 是否在每次思考更新时重新解析

### 问题根因

**假设 1**：流式 append 时只追加 rawContent，没有重新解析
**假设 2**：渲染时使用了未经清理的 rawContent
**假设 3**：parser 依赖完整闭合标签，流式场景下标签可能未闭合

## 修复目标

- 每次流式更新后，都基于完整 rawContent 重新解析
- 将消息拆成 `rawContent` / `visibleContent` / `thinkingContent` / `taskList` 等结构化字段
- 正文区只渲染 `visibleContent`，不再直接渲染 `rawContent`
- `<think>`/` <todo>`/` <task>` 等内部标签永远不直接出现在用户可见正文中

## What Changes

### 1. 消息结构改造

**修改 `Message` 接口**：
```typescript
interface Message {
  rawContent: string;          // 原始内容（含标签）
  visibleContent: string;     // 清理后的可见内容（不含标签）
  thinkingContent: string;     // 思考过程内容
  taskList: TaskItem[];        // 任务列表
  todoItems: TodoItem[];       // 待办事项
  // ... 其他现有字段
}
```

### 2. 流式更新链路改造

**修改 unifiedAgentStore 中的流式更新方法**：
- `appendStreamingMessage` 每次追加后重新解析，生成 `visibleContent`
- `updateThinking` 每次更新后重新解析，生成 `thinkingContent`
- `updateTodoItems` 每次更新后重新解析，生成 `taskList`

### 3. ChatPanel 渲染改造

**只渲染 `visibleContent`**：
- 不再渲染 `rawContent`
- 思考内容和任务列表使用独立的结构化字段

### 4. 解析器改造

**支持流式场景**：
- 处理未闭合标签（贪婪匹配或等待闭合）
- 每次解析都是幂等的、可重复的

## Impact

- 受影响组件：
  - `src/renderer/store/unifiedAgentStore.ts`
  - `src/renderer/components/Chat/ChatPanel.tsx`
  - `src/shared/types.ts`
- 相关系统：
  - AI Stream Service
  - IPC 事件处理

## ADDED Requirements

### Requirement: 流式更新时重新解析

#### Scenario: 流式思考内容更新
- **WHEN** 思考内容流式更新时
- **THEN** 每次 append 后都基于完整 rawContent 重新解析
- **AND** 生成新的 visibleContent 供渲染使用

#### Scenario: 流式任务列表更新
- **WHEN** 任务列表更新时
- **THEN** 重新解析并更新 taskList 字段
- **AND** 任务标签从 visibleContent 中移除

### Requirement: 消息结构分离

#### Scenario: 消息渲染
- **WHEN** 渲染消息时
- **THEN** 只渲染 visibleContent
- **AND** 不直接渲染 rawContent

## MODIFIED Requirements

### Requirement: Message 接口
**原实现**：`content` 混合存储原始内容和解析后内容
**修改后**：分离为 `rawContent`、`visibleContent`、`thinkingContent`、`taskList`

### Requirement: 流式更新方法
**原实现**：append 时不清除标签
**修改后**：每次 append 后重新解析生成可见内容
