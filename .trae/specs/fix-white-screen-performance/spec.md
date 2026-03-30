# Chat 输出白屏问题深度优化规格说明

## Why

基于对 Chat 输出链路的深度分析，发现以下导致白屏的核心问题：

1. **streamingItems 数组无上限增长**：每个工具调用、todo更新、question 都会产生独立事件项，复杂任务中积累数百个
2. **displayMessages 频繁重建**：依赖项包含高频变化状态，流式输出时每秒触发数十次重建
3. **MessageContent 计算过重**：每次渲染都执行标签解析、数组排序、复杂 switch-case
4. **组件订阅粒度过粗**：ChatPanel 整体订阅高频状态，没有将流式区域隔离
5. **React.memo 优化失效**：streamingItems 等对象每次都是新引用，浅比较无法识别

## What Changes

### 1. streamingItems 上限保护（保险丝机制）
- 设置 streamingItems 数组上限（如 100 项）
- 超出时合并旧项或丢弃低优先级项
- 防止内存无限增长

### 2. 流式消息区域组件隔离
- 将流式消息渲染区域独立为 StreamingMessage 组件
- 与历史消息列表解耦，独立订阅状态
- 减少 ChatPanel 整体重渲染

### 3. MessageContent 计算优化
- 缓存解析结果，避免每次渲染重新解析
- streamingItems 排序结果缓存
- 减少不必要的计算

### 4. 订阅粒度优化
- ChatPanel 只订阅稳定状态（activeTaskId、isProcessing 等）
- 高频状态（streamingItems、streamingMessage）由子组件独立订阅
- 使用 Zustand selector 精确控制订阅范围

### 5. 引用稳定性优化
- 使用 useMemo 稳定对象引用
- 自定义 AIMessage 比较函数
- 确保 React.memo 生效

## Impact

- 受影响组件：`src/renderer/components/Chat/ChatPanel.tsx`
- 新增组件：`src/renderer/components/Chat/StreamingMessage.tsx`
- 相关状态管理：`src/renderer/store/unifiedAgentStore.ts`

## ADDED Requirements

### Requirement: streamingItems 上限保护

#### Scenario: 数组达到上限
- **WHEN** streamingItems 数组长度达到 100
- **THEN** 新的事件项触发合并或丢弃策略
- **AND** 优先保留 content/thinking，合并旧的 tool/todo 项

#### Scenario: 内存保护
- **WHEN** 单个 content 项文本超过 10KB
- **THEN** 触发截断或压缩
- **AND** 保证 renderer 进程内存稳定

### Requirement: 流式消息组件隔离

#### Scenario: 流式区域独立渲染
- **WHEN** 流式输出进行时
- **THEN** 只有 StreamingMessage 组件重渲染
- **AND** 历史消息列表保持稳定

#### Scenario: 状态订阅隔离
- **WHEN** streamingMessage 变化时
- **THEN** 只有 StreamingMessage 组件接收更新
- **AND** ChatPanel 不因此重渲染

### Requirement: MessageContent 计算缓存

#### Scenario: 内容解析缓存
- **WHEN** content 未变化时
- **THEN** 复用上一次的解析结果
- **AND** 避免重复正则匹配

#### Scenario: streamingItems 排序缓存
- **WHEN** streamingItems 引用未变化时
- **THEN** 复用上一次的排序结果
- **AND** 避免每次渲染都执行 sort

## MODIFIED Requirements

### Requirement: ChatPanel 订阅优化
**原实现**: ChatPanel 订阅所有高频状态（streamingMessage、streamingItems 等）
**修改后**:
- ChatPanel 只订阅稳定状态
- 高频状态由子组件独立订阅
- 使用 selector 精确控制重渲染范围

### Requirement: AIMessage 比较函数
**原实现**: 使用默认浅比较，streamingItems 每次都是新对象
**修改后**:
- 自定义比较函数
- 深度比较关键属性
- 确保 memo 优化真正生效

## REMOVED Requirements

无
