# 修复思考过程流式更新时标签暴露问题检查清单

## 问题分析检查点

- [ ] unifiedAgentStore 流式更新方法已分析
- [ ] ChatPanel 消息渲染逻辑已分析
- [ ] rawContent vs visibleContent 使用情况已确认
- [ ] parser 流式场景行为已确认

## 接口改造检查点

- [ ] Message 接口已分离 rawContent、visibleContent、thinkingContent、taskList
- [ ] 解析辅助函数已实现

## 流式更新方法改造检查点

- [ ] appendStreamingMessage 每次 append 后重新解析
- [ ] updateThinking 每次更新后重新解析
- [ ] updateTodoItems 每次更新后重新解析

## ChatPanel 渲染改造检查点

- [ ] 只渲染 visibleContent
- [ ] 移除 rawContent 直接渲染

## 验证测试检查点

- [ ] 编译通过
- [ ] 流式更新时标签不暴露
- [ ] 多轮思考内容正确折叠
