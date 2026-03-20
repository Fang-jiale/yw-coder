# 修复思考过程流式更新时标签暴露问题任务清单

## 阶段一：问题链路分析

- [ ] 1.1: 分析 unifiedAgentStore 中的流式更新方法（appendStreamingMessage、updateThinking 等）
- [ ] 1.2: 分析 ChatPanel 中的消息渲染逻辑
- [ ] 1.3: 确认 rawContent vs visibleContent 的使用情况
- [ ] 1.4: 确认 parser 在流式场景下的行为

## 阶段二：消息结构改造

- [ ] 2.1: 修改 Message 接口，分离 rawContent、visibleContent、thinkingContent、taskList
- [ ] 2.2: 添加解析辅助函数，基于 rawContent 生成 visibleContent

## 阶段三：流式更新方法改造

- [ ] 3.1: 改造 appendStreamingMessage，每次 append 后重新解析
- [ ] 3.2: 改造 updateThinking，每次更新后重新解析 thinkingContent
- [ ] 3.3: 改造 updateTodoItems，每次更新后重新解析 taskList

## 阶段四：ChatPanel 渲染改造

- [ ] 4.1: 修改 ChatPanel 只渲染 visibleContent
- [ ] 4.2: 移除 rawContent 的直接渲染

## 阶段五：验证测试

- [ ] 5.1: 编译验证
- [ ] 5.2: 流式更新时标签不暴露
- [ ] 5.3: 多轮思考内容正确折叠

## 任务依赖关系

```
阶段一（分析）→ 阶段二（接口改造）→ 阶段三（流式方法改造）→ 阶段四（渲染改造）→ 阶段五（验证）
```
