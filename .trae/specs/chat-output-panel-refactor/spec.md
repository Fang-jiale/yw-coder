# 对话输出面板重构规格说明

## Why

当前对话输出面板存在严重的产品体验问题：

1. **信息架构混乱**：思考内容、工具调用、任务进度、输出内容混在一起，像调试视图而非产品界面
2. **状态不可信**：任务结束后，进度仍显示"进行中"——依赖模型输出文本而非真实 runtime 状态
3. **输出不克制**：HTML/PHP/代码全文直接渲染，聊天区过长，用户难以快速理解结果
4. **工具暴露过细**：直接显示 `list_files`、`read_file` 等原始工具名，适合调试但不适合用户
5. **思考内容暴露**：首次思考有样式，之后的思考内容原样暴露 `<think>`、`<todo>` 内部结构

## What Changes

### 信息架构重构（展示优先级）
- **最高**：结果摘要（文件卡片、命令执行结果）
- **次高**：任务进度（基于真实 runtime 状态）
- **次低**：工具调用明细（折叠）
- **最低**：思考过程（默认折叠或隐藏）

### 状态同步机制
- **废除**：依赖模型输出文本解析任务状态（`<todo>`、`<task status="...">`）
- **新建**：任务进度基于真实 agent runtime / task manager / execution state
- **要求**：任务完成时，UI 必须立即显示 `completed`，不是 `in_progress`

### 输出策略
- **克制输出**：不渲染大段 HTML/PHP/代码全文
- **卡片化**：文件操作、命令执行、环境检查等渲染为结构化卡片
- **折叠机制**：工具调用明细、思考过程默认折叠

### 可扩展性
- 定义清晰的卡片类型接口，便于后续添加新卡片类型
- 统一的状态管理，便于接入新的 runtime 状态源

## Impact

- 受影响组件：`src/renderer/components/Chat/ChatPanel.tsx`
- 相关状态管理：`src/renderer/store/unifiedAgentStore.ts`
- Agent Runtime：`src/main/agent/solo/SoloExecutor.ts`
- 消息流服务：`src/main/services/aiStreamService.ts`

## ADDED Requirements

### Requirement: 结果卡片化展示

#### Scenario: 文件创建结果
- **WHEN** AI 完成文件创建操作时
- **THEN** 渲染文件创建结果卡片
- **AND** 卡片包含：标题（文件名）、状态（成功/失败）、简短说明、操作按钮（打开文件/查看代码）

#### Scenario: 文件修改结果
- **WHEN** AI 完成文件修改操作时
- **THEN** 渲染文件修改结果卡片
- **AND** 卡片包含：标题（文件路径）、状态、变更摘要、可选操作（查看 diff/预览）

#### Scenario: 命令执行结果
- **WHEN** AI 执行命令（如 `npm run build`）时
- **THEN** 渲染命令执行结果卡片
- **AND** 卡片包含：命令名称、执行状态（成功/失败）、输出摘要

#### Scenario: 环境检查结果
- **WHEN** AI 进行环境检查时
- **THEN** 渲染环境检查结果卡片
- **AND** 卡片包含：检查项名称、检测结果、状态

### Requirement: 任务进度状态可信

#### Scenario: 任务状态绑定
- **WHEN** Agent runtime 状态变化时
- **THEN** UI 任务进度立即同步更新
- **AND** 不依赖模型输出文本

#### Scenario: 任务完成状态
- **WHEN** 任务完成时
- **THEN** UI 立即显示 `completed` 状态
- **AND** 停止所有进行中的动画/指示器

#### Scenario: 任务失败状态
- **WHEN** 任务失败时
- **THEN** UI 立即显示 `failed` 状态
- **AND** 显示失败原因摘要

### Requirement: 折叠机制

#### Scenario: 思考内容折叠
- **WHEN** 消息包含思考内容时
- **THEN** 默认折叠思考块
- **AND** 提供展开按钮

#### Scenario: 工具调用折叠
- **WHEN** 消息包含工具调用时
- **THEN** 默认折叠工具调用明细
- **AND** 显示工具调用摘要（如 "调用了 3 个工具"）

## MODIFIED Requirements

### Requirement: 消息展示优先级
**原实现**：思考内容 → 工具调用 → 任务进度 → 输出内容
**修改后**：结果摘要 → 任务进度 → 工具调用（折叠） → 思考过程（折叠）

### Requirement: 任务进度数据源
**原实现**：解析模型输出 `<todo>`、`<task status="...">` 文本
**修改后**：接入 agent runtime / task manager 真实状态

### Requirement: 大段内容展示
**原实现**：HTML/PHP/代码全文渲染到聊天区
**修改后**：渲染为结构化卡片，代码预览需主动点击展开

## REMOVED Requirements

### Requirement: 原始工具名展示
**Reason**: 不适合用户视角，改为卡片化摘要展示
**Migration**: 显示 "创建文件" 而不是 "write_file"

### Requirement: 长文本直接渲染
**Reason**: 导致聊天区过长，用户难以快速理解结果
**Migration**: 用卡片摘要替代，完整内容需主动查看
