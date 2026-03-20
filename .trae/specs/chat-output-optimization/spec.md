# Chat对话结果输出优化规格说明

## Why
当前Chat对话结果的输出内容存在以下用户体验问题：
1. 思考内容和正式回答内容混杂在一起，缺乏视觉区分
2. 代码块语言标签外露，影响阅读体验
3. option标签不可真实选择，交互性差
4. todo标签不能通过UI友好展示任务状态（完成/进行中/计划）
5. 整体布局混乱，信息层次不清晰

## What Changes
- 重构消息内容渲染逻辑，分离思考过程与正式回答
- 优化代码块展示，隐藏语言标签（保留文件路径），提供复制功能
- 修复option标签交互，使其可点击选择
- 添加todo标签UI展示，区分任务状态
- 改进整体布局和视觉层次
- 添加消息状态指示器

## Impact
- 受影响组件：`src/renderer/components/Chat/ChatPanel.tsx`
- 相关状态管理：`src/renderer/store/unifiedAgentStore.ts`
- 样式系统：Tailwind CSS

## ADDED Requirements

### Requirement: 思考过程独立展示
**描述**: AI的思考过程应该以折叠/展开的形式展示，与正式回答内容分离
**场景**:
- **WHEN** AI生成思考内容时
- **THEN** 显示可折叠的思考块，默认收起状态
- **AND** 提供清晰的视觉区分（如不同背景色、图标）

### Requirement: 代码块优化展示
**描述**: 代码块应该隐藏语言标签，提供一键复制功能
**场景**:
- **WHEN** 消息包含代码块时
- **AND** 隐藏原始语言标签（如 javascript, python 等）
- **AND** 保留文件路径信息（如有）
- **AND** 提供复制按钮

### Requirement: Option标签真实交互
**描述**: Option选择标签应该支持真实点击选择
**场景**:
- **WHEN** 消息包含option标签时
- **THEN** 渲染为可点击的按钮选项
- **AND** 点击后触发相应的回答逻辑
- **AND** 提供视觉反馈（hover效果）

### Requirement: Todo标签UI展示
**描述**: Todo任务应该以友好的UI形式展示，区分不同状态
**场景**:
- **WHEN** 消息包含todoItems时
- **THEN** 渲染为任务清单列表
- **AND** 使用不同颜色区分状态：
  - pending (计划任务) - 灰色边框
  - in_progress (进行中) - 蓝色背景 + 旋转图标
  - completed (已完成) - 绿色 + 删除线
  - failed (失败) - 红色边框
- **AND** 显示进度统计 (已完成/总数)
- **AND** 显示进度条

## MODIFIED Requirements

### Requirement: 消息内容布局重构
**原实现**: 所有内容混杂在一起渲染
**修改后**: 按类型分离渲染，建立清晰的信息层次

### Requirement: 消息头部信息展示
**原实现**: 简单的头部信息
**修改后**: 添加状态指示器、时间戳等

## REMOVED Requirements
无