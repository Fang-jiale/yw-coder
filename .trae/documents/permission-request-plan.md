# 计划：Agent 权限申请交互优化

## 目标
当 Agent 遇到需要申请权限的情况时，输出方案供用户选择，而不是直接卡住或无限重试。

## 实现步骤

### 步骤 1: 修改 FileService 错误处理
- 在 `src/main/services/fileService.ts` 中
- 检测到权限错误时，不抛出异常，而是返回特殊错误类型
- 添加 `needsUserPermission` 标志和建议命令

### 步骤 2: 修改 UnifiedAgent 错误处理
- 在 `src/main/agent/unifiedAgent.ts` 中
- 捕获权限错误后，生成可选方案列表
- 通过 `onProgress` 或新回调 `onPermissionRequest` 发送给前端

### 步骤 3: 添加前端权限申请组件
- 在 ChatPanel 中添加权限申请消息类型
- 渲染可点击的方案选项
- 用户点击后执行相应命令

### 步骤 4: 实现命令执行能力
- 添加执行终端命令的能力（通过 IPC）
- 用户选择方案后，在主进程中执行 chmod/chown 等命令

## 技术方案

### 错误分类
```typescript
interface PermissionError {
  type: 'permission';
  needed: 'write' | 'execute' | 'admin';
  path: string;
  suggestions: Array<{
    label: string;
    command: string;
    description: string;
  }>;
}
```

### 前端交互
- 显示黄色提示框："需要权限"
- 列出 2-3 个可选方案
- 用户点击方案后执行命令

## 预期效果
用户看到类似 Trae 的权限申请界面，可以一键授权