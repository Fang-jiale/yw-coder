# ywcoder 研发进展

## 2026-03-15 更新

### 已完成功能

#### 1. 待办清单（Todo List）
- **功能描述**: AI 可以使用 `<todo>` 标签来跟踪任务进展
- **实现方式**: 
  - 后端解析 `<todo>` 和 `<task>` 标签
  - 前端实时显示任务列表
  - 支持四种状态：pending、in_progress、completed、failed
- **文件修改**:
  - `src/main/services/aiStreamService.ts`: 添加 todo 标签解析
  - `src/renderer/components/Chat/ChatPanel.tsx`: 添加 todo 列表 UI
  - `src/shared/types.ts`: 添加 todo 相关类型

#### 2. 智能体主动提问（Agent Question）
- **功能描述**: AI 可以使用 `<question>` 标签向用户提问，支持选择题形式
- **实现方式**:
  - 后端解析 `<question>` 和 `<option>` 标签
  - 前端显示提问卡片，支持选项按钮和自由输入
  - 统一使用 `renderAgentQuestions` 函数渲染
- **文件修改**:
  - `src/main/services/aiStreamService.ts`: 添加 question 标签解析
  - `src/renderer/components/Chat/ChatPanel.tsx`: 添加提问 UI 和统一渲染函数
  - `src/shared/types.ts`: 添加 question 相关类型
  - `src/renderer/store/taskStore.ts`: 更新 TaskMessage 接口

#### 3. 提示词工程优化
- **功能描述**: 参考业内最佳实践，优化系统提示词
- **优化内容**:
  - 清晰的结构层次（角色定义、能力范围、输出格式等）
  - 明确的角色定义和能力边界
  - 示例驱动的说明（Few-shot 学习）
  - 工作流程指导（6步标准流程）
  - 代码审查指导（功能性、可读性、可维护性、性能）
  - 安全最佳实践（输入验证、敏感数据、常见漏洞）
  - 性能优化建议（前端、后端、算法）
- **文件修改**:
  - `src/main/services/aiStreamService.ts`: 重构系统提示词生成逻辑

### 技术改进

#### 1. 代码重构
- 创建统一的 `renderAgentQuestions` 函数，避免代码重复
- 流式输出和历史消息使用相同的渲染逻辑
- 优化类型定义，确保数据一致性

#### 2. 状态管理优化
- 修复 `agentQuestions` 在历史消息中的显示问题
- 确保 `streamingItems` 和 `agentQuestions` 正确保存到任务消息
- 优化消息同步逻辑

### 待解决问题

1. **`<question>` 标签解析**: 有时 `<question>` 标签内容会显示在对话文本中，需要进一步优化解析逻辑
2. **输入框焦点**: 提问输入框在流式输出时可能失去焦点

### 下一步计划

1. 修复 `<question>` 标签解析问题
2. 完善 Agent 系统（Plan/Build/Review 模式）
3. MCP 集成
4. 设置面板重构

---

*最后更新: 2026-03-15*
