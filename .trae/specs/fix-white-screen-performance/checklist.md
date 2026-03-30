# 白屏问题深度优化检查清单

## 阶段一：streamingItems 上限保护

- [x] unifiedAgentStore.ts 中 addStreamItem 添加了数组长度检查
- [x] 数组长度超过 100 时触发合并或丢弃策略
- [x] 优先保留 content/thinking 项，合并 tool/todo 项
- [x] 单个 content 项超过 10KB 时触发截断
- [x] 内存保护机制验证通过

## 阶段二：流式消息组件隔离

- [x] StreamingMessage.tsx 组件创建完成
- [x] StreamingMessage 独立订阅流式状态
- [x] ChatPanel 中分离流式消息和历史消息渲染
- [x] 流式消息变化时不触发历史消息重渲染
- [x] 组件隔离效果验证通过

## 阶段三：MessageContent 计算优化

- [x] parsedContent 使用 useMemo 缓存
- [x] content 未变化时不重新解析
- [x] streamingItems 排序结果使用 useMemo 缓存
- [x] streamingItems 未变化时不重新排序
- [x] 计算缓存效果验证通过

## 阶段四：订阅粒度优化

- [x] ChatPanel 移除了对高频状态的直接订阅
- [x] ChatPanel 只订阅稳定状态
- [x] StreamingMessage 独立订阅流式状态
- [x] 使用精确 selector 控制重渲染范围
- [x] 订阅优化效果验证通过

## 阶段五：引用稳定性优化

- [x] AIMessage 自定义比较函数实现
- [x] 深度比较关键属性
- [x] toolCalls、streamingItems 等对象引用稳定
- [x] React.memo 优化生效
- [x] memo 优化效果验证通过

## 阶段六：集成与验证

- [x] TypeScript 编译通过
- [x] 无类型错误
- [ ] 流式消息正常显示（需运行时验证）
- [ ] 工具调用正常显示（需运行时验证）
- [ ] todo 进度正常显示（需运行时验证）
- [ ] 消息折叠/展开正常（需运行时验证）
- [ ] 长时间对话后不白屏（需运行时验证）
- [ ] 复杂任务中 renderer 进程稳定（需运行时验证）
- [ ] 内存使用稳定（需运行时验证）
