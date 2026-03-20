# 可配置上下文长度预算系统

## Why

当前系统缺乏精细化的上下文长度控制能力：
- Token 预算控制粗糙（仅靠 `DEFAULT_CONTEXT_LENGTH = 4000`）
- 前端无法感知当前上下文限制
- 模型能力上限和产品策略未做区分

## 当前阶段目标

**简化设计**：前端当前只显示 32KB 限制，不可更改。
- 后端：固定 32KB 上下文预算
- 前端：只显示当前限制，为未来扩展留接口
- 未来：可扩展为多档位选择

## What Changes

### 1. 后端数据结构

**ModelCapability - 模型真实能力上限**：
```typescript
type ModelCapability = {
  modelId: string;
  maxContextWindow: number; // 32768 (32KB)
};
```

**ContextPolicy - 产品策略配置**：
```typescript
type ContextPolicy = {
  defaultBudget: number;      // 32768 (32KB)
  maxAllowedBudget: number;  // 允许的最大值
  mode: 'conservative';       // 当前仅支持保守模式
};
```

### 2. 前端数据结构

**UserContextPreference - 用户偏好（未来扩展用）**：
```typescript
type UserContextPreference = {
  preferredBudget?: number;  // 固定为 32768
  mode?: 'conservative';     // 固定为 conservative
};
```

### 3. 核心计算函数

```typescript
function getEffectiveContextBudget(
  userPreference: UserContextPreference,
  contextPolicy: ContextPolicy,
  modelCapability: ModelCapability
): number {
  return Math.min(
    userPreference.preferredBudget ?? contextPolicy.defaultBudget,
    contextPolicy.maxAllowedBudget,
    modelCapability.maxContextWindow
  );
}
```

### 4. 前端配置界面（当前简化版）

- 当前阶段：只显示"32KB 上下文限制"提示
- 不可更改配置
- 提示"更多选项即将推出"
- 为未来多档位选择预留接口

## Impact

- 受影响文件：
  - `src/main/services/aiStreamService.ts` - 添加配置结构和计算函数
  - `src/shared/types.ts` - 添加类型定义
  - `src/renderer/components/Settings/` - 添加限制提示 UI

## ADDED Requirements

### Requirement: 后端上下文预算计算

#### Scenario: 基础计算
- **WHEN** 后端接收到请求
- **THEN** 调用 `getEffectiveContextBudget` 计算最终预算
- **AND** 结果固定为 32KB

### Requirement: 前端显示当前限制

#### Scenario: 用户打开设置
- **WHEN** 用户查看上下文设置区域
- **THEN** 显示"当前上下文限制：32KB"
- **AND** 显示"更多选项即将推出"

## MODIFIED Requirements

### Requirement: 上下文预算注入

**原实现**：
- `DEFAULT_CONTEXT_LENGTH = 4000` 硬编码

**修改后**：
- 使用 `getEffectiveContextBudget` 动态计算
- 结果固定为 32KB
- 注入到 `trimHistoryMessages` 和 token 预算逻辑
