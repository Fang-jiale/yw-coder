# Checklist

## 后端类型定义

- [x] `ModelCapability` 类型定义在 `src/shared/types.ts`
- [x] `ContextPolicy` 类型定义在 `src/shared/types.ts`
- [x] `UserContextPreference` 类型定义在 `src/shared/types.ts`

## 后端配置与计算

- [x] `DEFAULT_MODEL_CAPABILITY` 配置添加（maxContextWindow: 32768）
- [x] `DEFAULT_CONTEXT_POLICY` 配置添加
- [x] `getEffectiveContextBudget` 函数实现正确
- [x] 函数正确取 min(userPreference, maxAllowedBudget, maxContextWindow)

## 上下文预算生效

- [x] `trimHistoryMessages` 使用动态 contextLength
- [x] 32KB 模式下，历史消息被正确裁剪
- [x] 最终上下文不超过模型能力上限 (32KB)

## 前端限制显示

- [x] `ContextSettings` 组件创建
- [x] 显示"当前上下文限制：32KB"
- [x] 显示"更多选项即将推出"提示
- [x] 设置面板中正确集成
