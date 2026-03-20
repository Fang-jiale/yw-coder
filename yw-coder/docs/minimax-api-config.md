# MiniMax API 配置说明

## 问题记录

**问题现象**: API 请求返回 404 错误
```
404 Not Found
<html>
<head><title>404 Not Found</title></head>
<body>
<center><h1>404 Not Found</h1></center>
<hr><center>nginx</center>
</body>
</html>
```

**问题原因**: 
在 `aiStreamService.ts` 的 `getClient` 方法中添加了错误的代码，移除了 `/v1` 后缀：
```typescript
// 错误的代码
baseURL = baseURL.replace(/\/v1$/, '');
```

这导致 Base URL 从 `https://api.minimaxi.com/v1` 变成 `https://api.minimaxi.com`，
然后 OpenAI SDK 添加 `/v1/chat/completions`，请求变成 `https://api.minimaxi.com/v1/chat/completions`，
但这个端点不存在，导致 404 错误。

## 正确配置

**MiniMax Base URL**: `https://api.minimaxi.com/v1`

**配置要求**:
- 所有 provider 的 `defaultBaseUrl` 都应该包含 `/v1` 后缀
- 不要手动移除 `/v1` 后缀
- OpenAI SDK 会自动处理 baseURL

## 代码位置

**文件**: `src/main/services/aiStreamService.ts`

**正确代码**:
```typescript
private getClient(config: AIProviderConfig): OpenAI {
  const providerInfo = PREDEFINED_PROVIDERS[config.provider];
  const baseURL = config.baseUrl || providerInfo?.defaultBaseUrl || 'https://api.openai.com/v1';

  // 创建客户端缓存 key，包含关键配置信息
  const cacheKey = `${config.id}-${baseURL}-${config.apiKey.substring(0, 10)}`;

  if (this.clients.has(cacheKey)) {
    return this.clients.get(cacheKey)!;
  }

  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL,
    timeout: 120000,
  });

  this.clients.set(cacheKey, client);
  return client;
}
```

## Provider 默认配置

所有 provider 的 `defaultBaseUrl` 都包含 `/v1`：

```typescript
export const PREDEFINED_PROVIDERS = {
  openai: {
    defaultBaseUrl: 'https://api.openai.com/v1',
  },
  minimax: {
    defaultBaseUrl: 'https://api.minimaxi.com/v1',
  },
  moonshot: {
    defaultBaseUrl: 'https://api.moonshot.cn/v1',
  },
  qwen: {
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  },
  // ... 其他 provider
};
```

## 注意事项

1. **不要移除 `/v1` 后缀** - OpenAI SDK 会自动处理
2. **保持配置一致性** - 所有 provider 的 baseUrl 格式保持一致
3. **测试验证** - 修改后需要测试所有 provider 的 API 连接

## 相关文件

- `src/main/services/aiStreamService.ts` - AI 流式服务
- `src/main/services/aiService.ts` - Provider 配置
- `src/shared/types.ts` - AIProviderConfig 类型定义

---
*文档创建时间: 2026-03-14*
*问题修复时间: 2026-03-14*
