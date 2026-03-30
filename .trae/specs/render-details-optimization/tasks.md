# 渲染机制细节优化任务清单

## 任务 1：ToolCallCard 显示优化

- [x] 1.1: 修改 ToolCallCard 组件
  - 显示 toolName 而不是 id
  - 如果 toolName 不存在，fallback 到 id

## 任务 2：清理未使用代码

- [x] 2.1: 移除 handleToggleThinking 变量
  - 删除未使用的 handleToggleThinking 变量

## 任务 3：验证和测试

- [x] 3.1: 编译验证
  - 确保 TypeScript 编译通过
  - 确保无类型错误

# 任务依赖关系

```
任务 1（ToolCallCard）┐
任务 2（清理代码）  ├→ 任务 3（验证）
```

任务 1 和 2 可以并行执行。
