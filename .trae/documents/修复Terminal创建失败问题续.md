# 修复 Terminal 创建失败问题（续）

## 错误信息
```
Failed to create terminal session: Error: Failed to create terminal: posix_spawnp failed.
```

## 前提排除
- ✅ 用户确认**不在 Trae sandbox** 中运行

## 问题分析

### `posix_spawnp` 失败的可能原因（排除 sandbox 后）

1. **node-pty 二进制文件与 Electron 不兼容**
   - node-pty 需要针对 Electron 版本重新编译
   - macOS 上可能需要重新 `npm rebuild`

2. **shell 路径问题**
   - shell 不存在或没有执行权限
   - `process.env.SHELL` 可能为空或无效

3. **Electron App 路径问题**
   - app.getAppPath() 返回的路径可能导致问题

## 诊断步骤

### 步骤 1：在 index.ts 中添加诊断日志
在 terminal:create handler 中添加日志：

```typescript
ipcMain.handle(IPC_CHANNELS.TERMINAL_CREATE, async (_, cwd?: string) => {
  console.log('[Main] terminal:create called, cwd:', cwd);
  console.log('[Main] process.execPath:', process.execPath);
  console.log('[Main] app.getAppPath():', app.getAppPath());
  console.log('[Main] process.env.SHELL:', process.env.SHELL);
  // ...
});
```

### 步骤 2：检查 node-pty 二进制文件
在终端中运行：
```bash
cd /Users/sijia/code/git_program/yw-coder
ls -la node_modules/node-pty/
file node_modules/node-pty/build/Release/pty.node
```

### 步骤 3：重新编译 node-pty
```bash
npm rebuild node-pty
```

## 解决方案

### 方案 A：重新编译 node-pty（推荐）
```bash
cd /Users/sijia/code/git_program/yw-coder
npm rebuild node-pty
```

### 方案 B：如果方案 A 无效，尝试完全重新安装
```bash
rm -rf node_modules/node-pty
npm install
npm rebuild
```

### 方案 C：检查 shell 路径
在代码中添加验证，确保 shell 存在且可执行

## 涉及文件
- `/Users/sijia/code/git_program/yw-coder/src/main/index.ts`
- `/Users/sijia/code/git_program/yw-coder/src/main/services/terminalService.ts`

## 预期效果
通过诊断日志确定具体原因，然后针对性解决
