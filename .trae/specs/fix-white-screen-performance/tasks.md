# 白屏问题深度优化任务清单

## 阶段一：streamingItems 上限保护

- [x] 1.1: 在 unifiedAgentStore.ts 中添加 streamingItems 上限检查
  - 修改 addStreamItem action，添加数组长度检查
  - 当长度超过 100 时，合并旧的 tool/todo 项
  - 优先保留 content/thinking 项

- [x] 1.2: 添加单个 content 项大小限制
  - 当单个 content 项文本超过 10KB 时触发截断
  - 添加截断提示

- [x] 1.3: 验证内存保护机制生效

## 阶段二：流式消息组件隔离

- [x] 2.1: 创建 StreamingMessage 组件
  - 新建文件 `src/renderer/components/Chat/StreamingMessage.tsx`
  - 独立订阅 streamingMessage、streamingThinking、streamingItems 等高频状态
  - 渲染流式消息内容

- [x] 2.2: 重构 ChatPanel 消息渲染逻辑
  - 将流式消息区域从 displayMessages 中分离
  - 历史消息只渲染已完成的消息
  - 流式消息由 StreamingMessage 组件独立渲染

- [x] 2.3: 验证组件隔离效果
  - 确认 streamingMessage 变化时只有 StreamingMessage 重渲染
  - 确认历史消息列表保持稳定

## 阶段三：MessageContent 计算优化

- [x] 3.1: 优化 parsedContent 缓存
  - 使用 useMemo 缓存 content 解析结果
  - 只在 content 变化时重新解析

- [x] 3.2: 优化 streamingItems 排序缓存
  - 使用 useMemo 缓存排序结果
  - 只在 streamingItems 变化时重新排序

- [x] 3.3: 验证计算缓存生效
  - 确认重复渲染时不重新执行解析和排序

## 阶段四：订阅粒度优化

- [x] 4.1: 重构 ChatPanel 状态订阅
  - 移除对 streamingMessage、streamingThinking、streamingItems 的直接订阅
  - 只订阅稳定状态（activeTaskId、isProcessing、activeTask 等）

- [x] 4.2: 子组件独立订阅高频状态
  - StreamingMessage 组件独立订阅流式状态
  - 使用精确 selector 控制重渲染范围

- [x] 4.3: 验证订阅优化效果
  - 确认高频状态变化不触发 ChatPanel 重渲染

## 阶段五：引用稳定性优化

- [x] 5.1: 自定义 AIMessage 比较函数
  - 实现深度比较关键属性
  - 确保 React.memo 生效

- [x] 5.2: 优化对象引用稳定性
  - 使用 useMemo 稳定 toolCalls、streamingItems 等对象
  - 避免每次渲染创建新对象

- [x] 5.3: 验证 memo 优化生效
  - 确认消息组件只在必要时重渲染

## 阶段六：集成与验证

- [x] 6.1: 编译验证
  - 确保 TypeScript 编译通过
  - 确保无类型错误

- [ ] 6.2: 功能验证
  - 流式消息正常显示
  - 工具调用正常显示
  - todo 进度正常显示
  - 消息折叠/展开正常

- [ ] 6.3: 性能验证（需运行时验证）
  - 长时间对话后不白屏
  - 复杂任务中 renderer 进程稳定
  - 内存使用稳定

# 任务依赖关系

```
阶段一（上限保护） → 阶段二（组件隔离） → 阶段四（订阅优化）
                          ↓
                   阶段三（计算优化） → 阶段五（引用优化） → 阶段六（集成验证）
```

阶段一、阶段二、阶段三可以并行开始
阶段四依赖阶段二完成
阶段五依赖阶段三完成
阶段六依赖所有阶段完成
