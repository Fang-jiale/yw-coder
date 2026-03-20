# MiniMax 多轮 Function Call 修复记录

## 问题描述

MiniMax 模型在多轮 Function Call 对话中报错：
```
400 invalid params, invalid chat setting (2013)
```

单轮 Function Call 正常，多轮报错。

## 问题原因

MiniMax 模型在启用 Function Call 时，会在 `content` 字段中包含 `<think>` 标签的推理内容。例如：

```json
{
  "role": "assistant",
  "content": "<think>\n用户想了解整个项目...\n</think>\n\n好的，让我读取几个关键文档...",
  "tool_calls": [...]
}
```

这种格式会导致 MiniMax API 返回 400 错误。

## 解决方案

为 MiniMax 模型启用 `reasoning_split: true` 参数，将思考内容分离到 `reasoning_details` 字段，而不是放在 `content` 中的 `<think>` 标签。

### 代码修改

**文件**: `src/main/services/aiStreamService.ts`

```typescript
// MiniMax 模型启用 reasoning_split，将思考内容分离到 reasoning_details 字段
if (model.toLowerCase().includes('minimax')) {
  requestParams.extra_body = { reasoning_split: true };
}
```

## 关键要点

1. **MiniMax 支持原生 OpenAI Function Call 格式**
   - 需要保留完整的 `tool_calls` 字段
   - 需要保留 `tool` 角色的消息

2. **MiniMax 的特殊参数**
   - `reasoning_split: true` - 将思考内容分离到单独的字段
   - 这样 `content` 字段就不会包含 `<think>` 标签

3. **消息格式要求**
   - Assistant 消息必须包含完整的 `tool_calls` 数组
   - Tool 结果必须使用 `tool` 角色，并包含 `tool_call_id`

## 相关代码位置

- `src/main/services/aiStreamService.ts` - AI 流式服务，包含 Function Call 处理逻辑
- `src/main/agent/agent.ts` - Agent 任务执行

## 注意事项

**不要**移除以下代码：
1. `reasoning_split` 参数设置
2. `tool_calls` 字段的保留
3. `tool` 角色消息的处理

**不要**修改：
1. Base URL 的处理（保持 `/v1` 后缀）
2. Message 类型的定义（需要支持 `tool` 角色）

## 参考文档

- MiniMax OpenAI API 兼容文档: https://platform.minimaxi.com/docs/api-reference/text-openai-api

---
*问题修复时间: 2026-03-14*
*修复人: AI Assistant*
