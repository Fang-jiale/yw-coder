# 渲染机制性能优化任务清单

## 任务 1：优化 parseContentTags 缓存

- [x] 1.1: 修改 content 类型渲染逻辑
  - 使用 useMemo 缓存 parseContentTags 结果
  - 只在 item.text 变化时重新解析
  - 避免每次渲染都执行正则匹配

## 任务 2：优化 sortedItems 创建

- [x] 2.1: 优化 sortedItems useMemo
  - 使用更精确的依赖项
  - 只在数组长度或最后一个 item 变化时重新排序
  - 避免不必要的数组创建

## 任务 3：StreamingContent 添加 Markdown 支持

- [x] 3.1: 修改 StreamingContent 组件
  - 使用 ReactMarkdown 渲染内容
  - 保持光标动画效果
  - 确保流式输出时也有格式化

## 任务 4：验证和测试

- [x] 4.1: 编译验证
  - 确保 TypeScript 编译通过
  - 确保无类型错误

- [ ] 4.2: 功能验证
  - 确认流式输出正常
  - 确认 Markdown 格式正确
  - 确认标签渲染正确

# 任务依赖关系

```
任务 1（parseContentTags 缓存）┐
任务 2（sortedItems 优化）    ├→ 任务 4（验证）
任务 3（Markdown 支持）       ┘
```

任务 1、2、3 可以并行执行，任务 4 依赖它们完成。
