# Tasks

## 阶段一：后端数据结构与计算函数

- [x] Task 1: 在 `src/shared/types.ts` 中添加类型定义
  - [x] SubTask 1.1: 添加 `ModelCapability` 类型
  - [x] SubTask 1.2: 添加 `ContextPolicy` 类型
  - [x] SubTask 1.3: 添加 `UserContextPreference` 类型

- [x] Task 2: 在 `src/main/services/aiStreamService.ts` 中实现配置和计算函数
  - [x] SubTask 2.1: 添加 `DEFAULT_MODEL_CAPABILITY` 配置（maxContextWindow: 32768）
  - [x] SubTask 2.2: 添加 `DEFAULT_CONTEXT_POLICY` 配置（固定 32KB）
  - [x] SubTask 2.3: 实现 `getEffectiveContextBudget` 函数
  - [x] SubTask 2.4: 修改 `streamExecute` 使用动态预算

## 阶段二：前端限制显示

- [x] Task 3: 在设置面板中添加上下文限制提示
  - [x] SubTask 3.1: 创建 `ContextSettings.tsx` 组件
  - [x] SubTask 3.2: 显示"当前上下文限制：32KB"
  - [x] SubTask 3.3: 显示"更多选项即将推出"提示

## 阶段三：集成与验证

- [x] Task 4: 修改 `trimHistoryMessages` 使用动态预算
  - [x] SubTask 4.1: 将 `contextLength` 参数改为动态计算

- [x] Task 5: 验证上下文预算生效
  - [x] SubTask 5.1: 验证历史消息被正确裁剪到 32KB
  - [x] SubTask 5.2: 验证前端显示正确的限制值

## Task Dependencies

- Task 2 依赖 Task 1
- Task 3 和 Task 4 依赖 Task 2
- Task 5 依赖 Task 4
