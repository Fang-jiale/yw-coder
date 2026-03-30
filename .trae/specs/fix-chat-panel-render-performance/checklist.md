# 验证清单

## 功能验证
- [x] resultCards 只在当前流式消息显示，历史消息不显示
- [x] taskProgress 只在当前流式消息显示，历史消息不显示
- [x] clearStreaming 正确清理 resultCards 和 taskProgress
- [x] 流式结束后 resultCards 和 taskProgress 不再显示

## 性能验证
- [x] displayMessages 不再依赖整个 tasks 数组
- [x] store 其他字段更新时不触发消息列表重建
- [x] AIMessage 组件只在必要时重渲染
- [ ] 长时间对话后 renderer 不再白屏/崩溃

## 回归验证
- [x] 流式消息正常显示
- [x] tool / todo / question 事件正常显示
- [x] 消息折叠/展开功能正常
- [x] 自动滚动功能正常
