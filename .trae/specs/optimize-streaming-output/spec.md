# 优化对话流式输出处理和展示 Spec

## Why
当前流式输出存在以下问题需要优化：
1. 流式内容渲染不够平滑，存在卡顿感
2. 打字机效果不够自然，没有 Trae 那种流畅的逐字显示体验
3. 代码块在流式输出过程中频繁重渲染，导致视觉闪烁
4. 长消息流式输出时滚动体验不佳
5. 缺少流式输出的视觉反馈（如光标闪烁、进度指示等）

## What Changes
- 实现平滑的打字机效果，逐字/逐词显示流式内容
- 优化 Markdown 渲染器，支持增量更新避免重复渲染
- 改进流式输出时的自动滚动策略，更智能的用户滚动检测
- 添加流式输出状态指示器（打字光标、接收进度等）
- 优化代码块在流式输出时的渲染性能
- 实现消息内容的平滑过渡动画
- **BREAKING**: 修改 `useStreaming` hook 的返回值结构，新增 `displayContent` 字段用于渐进式显示

## Impact
- Affected specs: 流式消息处理、消息展示、Markdown 渲染
- Affected code:
  - src/renderer/components/Chat/hooks/useStreaming.ts
  - src/renderer/components/Chat/components/Content/MarkdownRenderer.tsx
  - src/renderer/components/Chat/components/MessageArea/MessageItem.tsx
  - src/renderer/components/Chat/components/MessageArea/MessageList.tsx
  - src/renderer/components/Chat/hooks/useAutoScroll.ts
  - src/renderer/components/Chat/ChatPanelRefactored.tsx
  - src/renderer/styles/animations.ts

## ADDED Requirements

### Requirement: 打字机效果流式显示
The system SHALL provide 平滑的打字机效果，对标 Trae 的流式输出体验：
- 内容按词组/字符渐进显示，而非一次性渲染
- 支持可调节的显示速度
- 在流式过程中显示闪烁的光标指示器
- 完成流式后光标平滑消失

#### Scenario: AI 流式回复
- **WHEN** AI 开始流式输出内容
- **THEN** 内容以打字机效果逐词显示，带有闪烁光标

#### Scenario: 流式输出完成
- **WHEN** 流式输出结束
- **THEN** 光标平滑消失，内容完整显示

### Requirement: 增量式 Markdown 渲染
The system SHALL provide 增量更新的 Markdown 渲染器：
- 只重新渲染变更部分，避免整段重渲染
- 代码块在流式过程中保持稳定，不闪烁
- 支持部分 Markdown 语法（如列表、代码块）的渐进解析

#### Scenario: 流式代码块
- **WHEN** AI 流式输出代码块
- **THEN** 代码块容器立即显示，内容渐进填充，无闪烁

#### Scenario: 流式列表
- **WHEN** AI 流式输出列表
- **THEN** 列表项渐进显示，格式正确渲染

### Requirement: 智能自动滚动
The system SHALL provide 更智能的流式输出滚动体验：
- 用户主动滚动时暂停自动滚动
- 检测用户阅读位置，避免强行拉到底部
- 提供"新消息"提示按钮，点击后滚动到底部
- 平滑滚动动画，不突兀

#### Scenario: 用户滚动查看历史
- **WHEN** 用户在 AI 回复时向上滚动
- **THEN** 暂停自动滚动，显示"新消息"提示

#### Scenario: 用户点击新消息按钮
- **WHEN** 用户点击"新消息"提示按钮
- **THEN** 平滑滚动到最新消息位置

### Requirement: 流式状态视觉反馈
The system SHALL provide 清晰的流式输出状态指示：
- 输入框区域显示接收中动画
- 消息气泡显示流式进度指示
- 网络延迟时的等待提示
- 流式中断时的错误提示

#### Scenario: 等待 AI 响应
- **WHEN** 发送消息后等待 AI 开始回复
- **THEN** 显示等待动画和预计时间提示

#### Scenario: 流式接收中
- **WHEN** 正在接收流式内容
- **THEN** 显示接收进度和打字机效果

### Requirement: 消息内容平滑过渡
The system SHALL provide 消息内容的平滑过渡动画：
- 新消息进入时的淡入动画
- 流式内容更新时的平滑过渡
- 消息完成时的完成状态指示

#### Scenario: 新消息出现
- **WHEN** 新消息添加到列表
- **THEN** 以淡入动画平滑出现

## MODIFIED Requirements

### Requirement: useStreaming Hook 增强
**现有功能**: 基础的流式内容管理
**修改内容**:
- 新增 `displayContent` 字段，用于打字机效果显示
- 新增 `isTyping` 状态，标识是否正在打字
- 新增 `typingSpeed` 配置，控制打字速度
- 优化节流逻辑，支持更细粒度的更新

### Requirement: MessageItem 流式展示
**现有功能**: 基础的消息展示
**修改内容**:
- 集成打字机效果显示
- 优化流式状态下的渲染性能
- 添加流式完成状态指示

## REMOVED Requirements
无移除需求
