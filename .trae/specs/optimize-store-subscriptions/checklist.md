# 订阅优化检查清单

## 任务 1：优化 ChatHistorySidebar 订阅

- [x] ChatHistorySidebar 使用 useShallow 或精确 selector
- [x] ChatHistorySidebar 不订阅任务消息内容
- [x] 流式消息累积时 ChatHistorySidebar 不重渲染
- [x] 任务列表切换正常工作

## 任务 2：优化 ChatPanel activeTask selector

- [x] ChatPanel 使用稳定的 activeTask selector
- [x] activeTask selector 使用 useShallow 或缓存
- [x] 其他任务变化不触发 ChatPanel 重渲染
- [x] 当前任务变化正常触发重渲染

## 任务 3：验证整体效果

- [x] TypeScript 编译通过
- [x] 无类型错误
- [ ] 任务列表正常显示（需运行时验证）
- [ ] 任务切换正常工作（需运行时验证）
- [ ] 流式消息正常显示（需运行时验证）
- [ ] 流式输出时渲染压力降低（需运行时验证）
