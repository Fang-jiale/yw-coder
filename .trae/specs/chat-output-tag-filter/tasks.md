# Chat 输出标签渲染优化任务清单

## 任务 1：创建标签解析工具函数

- [x] 1.1: 创建 `src/renderer/utils/contentParser.ts` 文件
  - 实现 `parseContentTags` 函数
  - 解析 `<think〉...〈/think〉` 标签
  - 解析 `<todo〉...〈/todo〉` 标签
  - 解析 `<question〉...〈/question〉` 标签（包含 option 子标签）
  - 处理未闭合标签的情况
  - 返回结构化的渲染片段列表

- [x] 1.2: 定义类型接口
  - `ContentSegment` 类型：表示解析后的片段
  - `ThinkSegment`、`TodoSegment`、`QuestionSegment` 类型

## 任务 2：修改 StreamingMessage 组件

- [x] 2.1: 导入标签解析函数
  - 在 StreamingMessage.tsx 中导入 parseContentTags

- [x] 2.2: 修改 content 类型渲染逻辑
  - 调用 parseContentTags 解析 item.text
  - 根据解析结果渲染对应的 UI 组件
  - 未识别内容使用 ReactMarkdown 渲染

- [x] 2.3: 确保组件可用
  - 确认 ThinkingBlock、TodoList、QuestionBlock 组件已存在
  - 确认 ReactMarkdown 已安装

## 任务 3：验证和测试

- [x] 3.1: 编译验证
  - 确保 TypeScript 编译通过
  - 确保无类型错误

- [ ] 3.2: 功能验证
  - 发送包含 `<think〉` 标签的消息，确认 ThinkingBlock 正确渲染
  - 发送包含 `<todo〉` 标签的消息，确认 TodoList 正确渲染
  - 发送包含 `<question〉` 标签的消息，确认 QuestionBlock 正确渲染
  - 确认选项可点击交互

- [ ] 3.3: 兼容性验证
  - 确认历史消息正常显示
  - 确认流式消息正常显示
  - 确认普通 Markdown 内容正常渲染

# 任务依赖关系

```
任务 1（创建解析函数）→ 任务 2（修改组件）→ 任务 3（验证）
```

任务必须按顺序执行。
