# Think 状态机生命周期详解

## 1. 状态变量是否跨 chunk 持久保存

**是的**，状态变量 `inThinkBlock`、`thinkContent`、`roundThinking`、`buffer` 都定义在 `for await` 循环外部，属于流式处理函数的局部变量，但每次 `for await` 的迭代中都会保留上一次的值。

```typescript
let inThinkBlock = false;     // 状态：是否在 think 块中
let thinkContent = '';        // 当前 think 块的内容
let roundThinking = '';       // 累积的完整思考内容
let buffer = '';              // 未处理的字符缓冲

for await (const chunk of stream) {
  // ... buffer += content
  // ... 状态机处理
}
```

## 2. 首次消息创建和后续流式 update 是否走同一套状态机逻辑

**是的**，整个流式响应共用同一套状态机。流程如下：

```
用户发送消息
    ↓
触发 sendMessage
    ↓
调用 AI Stream Service
    ↓
for await (chunk of stream) {  ← 共用状态机
    buffer += chunk
    → 状态机处理
}
```

## 3. 被拆开的标签（如 `<thi + nk>`）是否能正确识别

**不能正确识别**。状态机使用 `indexOf` 精确匹配完整字符串：

```typescript
// 检测开始标签
const thinkStartIndex = buffer.indexOf('<think>');  // 需要完整匹配

// 检测结束标签
const thinkEndIndex = buffer.indexOf('</think>');    // 需要完整匹配
```

### 被拆分场景分析

**场景 1：`<thi` + `nk>` 拆分**
```
Chunk 1: "<thi"
Chunk 2: "nk>思考内容</th"
Chunk 3: "ink>正文"
```
- Chunk 1: `buffer = "<thi"`, `indexOf('<think>')` 返回 `-1`，无法识别
- Chunk 2: `buffer = "<think>思考内容</th"`, `indexOf('<think>')` 返回 `0`，识别成功 ✅
- **问题**：Chunk 1 的 `<thi` 会进入普通文本，被发送出去 ❌

**场景 2：`</thi` + `nk>` 拆分**
```
Chunk 1: "<think>思考内容</thi"
Chunk 2: "nk>正文"
```
- Chunk 1: `inThinkBlock = true`, `indexOf('</think>')` 返回 `-1`，无法结束
- Chunk 2: `buffer = "<think>思考内容</think>正文"`, 找到 `</think>`，结束 ✅
- **问题**：无，标签被正确找到并结束

## 4. 主状态机识别失败时，fallback 为什么没有过滤 `<think>`

**原因**：`filterToolCalls` 方法没有过滤 `<think>` 标签的逻辑。

```typescript
// filterToolCalls 现有过滤：
.replace(/<todo>[\s\S]*?<\/todo>/g, '')   // ✅ 有
.replace(/<task\s+[^>]*>[\s\S]*?<\/task>/g, '')  // ✅ 有
// .replace(/<think>[\s\S]*?<\/think>/g, '')     // ❌ 缺失
```

---

## Chunk-by-Chunk 示例

### 正常场景

**输入**：完整标签在一个 chunk 内

```
AI 输出: "一些文本<think>思考内容</think>更多内容"
```

```
Chunk 1: "一些文本<think>思考内容</think>更多内容"
buffer = "一些文本<think>思考内容</think>更多内容"

状态机处理：
1. indexOf('<think>') → 4
2. beforeThink = "一些文本" → filterToolCalls → callback(content)
3. inThinkBlock = true
4. buffer = "思考内容</think>更多内容"
5. indexOf('</think>') → 5
6. afterThink = "更多内容" → callback(content)
7. inThinkBlock = false

最终输出：
- content: "一些文本更多内容" ✅
- thinking: "思考内容" ✅
```

### 异常场景（标签拆分）

**输入**：标签被拆到不同 chunk

```
Chunk 1: "一些文本<thi"
Chunk 2: "nk>思考内容</th"
Chunk 3: "ink>更多内容"
```

```
Chunk 1: "一些文本<thi"
buffer = "一些文本<thi"
indexOf('<think>') → -1 ❌
indexOf('</think>') → -1

buffer 不为空 → 进入 fallback:
callback({ type: 'content', content: "一些文本<thi" }) ❌
buffer = ""

---
Chunk 2: "nk>思考内容</th"
buffer = "nk>思考内容</th"
indexOf('<think>') → 0 ✅
beforeThink = "" → 不发送
inThinkBlock = true
buffer = "思考内容</th"
indexOf('</think>') → -1 ❌

think 块继续，发送思考内容:
callback({ type: 'thinking', content: "思考内容</th" }) ⚠️
buffer = ""

---
Chunk 3: "ink>更多内容"
buffer = "ink>更多内容"
indexOf('</think>') → 0 ✅
finalThinkChunk = "" (0-0)
afterThink = "ink>更多内容"
callback({ type: 'content', content: "ink>更多内容" }) ❌
inThinkBlock = false

最终输出：
- content: "一些文本<thi" + "ink>更多内容" ❌
- thinking: "思考内容</th" ⚠️
```

**问题总结**：
1. `<thi` 被当作普通文本发送
2. `ink>` 被当作正文发送
3. 思考内容中包含 `</th`（不完整）

---

## 修复后的效果

### 修复 1：`parseMessageContent` 正则修复

```diff
- const thinkMatch = content.match(/<think>([\\s\\S]*?)<\\/think>/);
+ const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/);
```

让前端解析时能正确匹配标签。

### 修复 2：`filterToolCalls` 添加 `<think>` 过滤

```diff
+ // 过滤思考标签（兜底过滤，防止状态机处理失败时暴露）
+ .replace(/<think>[\s\S]*?<\/think>/g, '')
+ .replace(/<\/?think[^>]*$/g, '')
```

让 fallback 兜底时也能正确过滤 `<think>` 标签。

### 修复后，即使状态机失败

```
Chunk 1: "一些文本<thi"
→ filterToolCalls("一些文本<thi")
→ "一些文本" ✅ (移除了 <thi)
```

---

## 状态机代码位置

`src/main/services/aiStreamService.ts`

| 行号 | 功能 |
|------|------|
| 848-856 | 状态变量定义 |
| 1038-1056 | 检测 think 开始标签 |
| 1058-1096 | 处理 think 块内容 |
| 1097-1099 | 检测 todo 开始标签 |
| 238-274 | `filterToolCalls` 兜底过滤 |
