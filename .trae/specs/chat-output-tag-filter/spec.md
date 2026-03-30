# Chat 输出标签渲染优化规格说明

## Why

当前 Chat 输出存在以下问题：

1. **标签暴露**：AI 返回的特殊标签（如 `<think〉`、`<todo〉`、`<question〉`）直接显示给用户
2. **结构化不足**：即使有 ThinkingBlock、TodoList、QuestionBlock 等组件，但没有被正确使用
3. **交互缺失**：question 标签的选项无法交互
4. **阅读体验差**：用户看到的是原始标签，而不是结构化的 UI

根本原因分析：
- 主进程状态机可能漏检部分标签（流式输出时标签被分割）
- 渲染层没有对 content 进行二次解析
- 已有的 UI 组件没有被充分利用

## What Changes

### 方案：渲染层添加标签解析和渲染

在渲染层对 content 类型的文本进行标签解析，转换为对应的 UI 组件：

1. **创建标签解析工具函数**
   - 解析 content 中的特殊标签
   - 提取标签内容和属性
   - 返回结构化数据

2. **修改 StreamingMessage 渲染逻辑**
   - 对 content 类型文本进行标签解析
   - 根据解析结果渲染对应的 UI 组件
   - 未识别的内容使用 Markdown 渲染

3. **支持交互**
   - question 标签的选项可点击
   - 点击后触发 onAnswerQuestion 回调

## Impact

- 受影响组件：
  - `src/renderer/components/Chat/StreamingMessage.tsx`
  - 新增 `src/renderer/utils/contentParser.ts`

- 不影响：
  - 主进程标签解析逻辑（保持兼容）
  - 历史消息存储格式

## ADDED Requirements

### Requirement: 渲染层标签解析

#### Scenario: content 文本解析
- **WHEN** 渲染 content 类型的 streamingItem
- **THEN** 调用标签解析函数
- **AND** 提取所有特殊标签及其内容
- **AND** 返回结构化的渲染片段列表

#### Scenario: 解析的标签类型
- **GIVEN** 需要解析的标签：
  - `<think〉...〈/think〉` → ThinkingBlock
  - `<todo〉...〈/todo〉` → TodoList
  - `<question〉...〈/question〉` → QuestionBlock（带交互）
  - `<option〉...〈/option〉` → 作为 question 的选项
- **WHEN** 文本中包含这些标签
- **THEN** 正确提取标签内容和属性
- **AND** 转换为对应的 UI 组件

#### Scenario: 未闭合标签处理
- **WHEN** 文本中包含未闭合的标签
- **THEN** 作为普通文本处理
- **AND** 不影响其他标签的解析

### Requirement: 标签 UI 渲染

#### Scenario: think 标签渲染
- **WHEN** 解析到 `<think〉...〈/think〉` 标签
- **THEN** 使用 ThinkingBlock 组件渲染
- **AND** 显示思考图标和内容
- **AND** 支持折叠/展开

#### Scenario: question 标签渲染
- **WHEN** 解析到 `<question〉...〈/question〉` 标签
- **THEN** 使用 QuestionBlock 组件渲染
- **AND** 显示问题和选项
- **AND** 选项可点击交互

#### Scenario: todo 标签渲染
- **WHEN** 解析到 `<todo〉...〈/todo〉` 标签
- **THEN** 使用 TodoList 组件渲染
- **AND** 显示任务列表和状态

#### Scenario: 普通文本渲染
- **WHEN** 内容不包含特殊标签
- **THEN** 使用 ReactMarkdown 渲染
- **AND** 支持 Markdown 格式化

### Requirement: 交互支持

#### Scenario: question 选项点击
- **WHEN** 用户点击 question 的选项
- **THEN** 触发 onAnswerQuestion 回调
- **AND** 传递 questionId 和选中的值

## MODIFIED Requirements

### Requirement: StreamingMessage content 渲染
**原实现**：
```typescript
case 'content':
  return (
    <div>{item.text}</div>
  );
```

**修改后**：
```typescript
case 'content':
  const segments = parseContentTags(item.text);
  return (
    <div>
      {segments.map((segment, index) => {
        switch (segment.type) {
          case 'think':
            return <ThinkingBlock key={index} thinking={segment.content} />;
          case 'question':
            return <QuestionBlock key={index} {...segment} onAnswer={onAnswerQuestion} />;
          case 'todo':
            return <TodoList key={index} items={segment.items} />;
          default:
            return <ReactMarkdown key={index}>{segment.content}</ReactMarkdown>;
        }
      })}
    </div>
  );
```

## REMOVED Requirements

无
