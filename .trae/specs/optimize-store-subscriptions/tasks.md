# 订阅优化任务清单

## 任务 1：优化 ChatHistorySidebar 订阅

- [x] 1.1: 修改 ChatHistorySidebar 使用精确 selector
  - 使用 `useShallow` 或精确 selector 订阅 tasks
  - 只订阅任务列表的元数据（id、title、createdAt、status、runtimeMode）
  - 避免订阅任务的消息内容

- [x] 1.2: 验证 ChatHistorySidebar 不因消息变化重渲染
  - 确认流式消息累积时 ChatHistorySidebar 不重渲染
  - 确认任务列表切换正常工作

## 任务 2：优化 ChatPanel activeTask selector

- [x] 2.1: 使用稳定的 activeTask selector
  - 使用 `useShallow` 或缓存 find 结果
  - 避免每次 `tasks` 变化都返回新引用

- [x] 2.2: 验证 ChatPanel 不因其他任务变化重渲染
  - 确认只有当前活跃任务变化时才触发重渲染

## 任务 3：验证整体效果

- [x] 3.1: 编译验证
  - 确保 TypeScript 编译通过
  - 确保无类型错误

- [x] 3.2: 功能验证
  - 任务列表正常显示
  - 任务切换正常工作
  - 流式消息正常显示

- [x] 3.3: 性能验证（需运行时验证）
  - 流式输出时 ChatHistorySidebar 不重渲染
  - 渲染进程压力降低

# 任务依赖关系

```
任务 1（ChatHistorySidebar） ─┐
                              ├─→ 任务 3（验证）
任务 2（ChatPanel selector） ─┘
```

任务 1 和任务 2 可以并行执行
任务 3 依赖任务 1 和任务 2 完成
