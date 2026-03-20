# 修复 Terminal 创建失败问题

## 错误信息
```
Failed to create terminal session: Error: Error invoking remote method 'terminal:create': Error: posix_spawnp failed.
```

## 问题分析

### 错误原因
`posix_spawnp failed` 表示 `pty.spawn()` 调用失败，可能原因：

1. **Shell 路径不存在** - `getShell()` 返回的 shell 路径无效
2. **Shell 没有执行权限** - shell 文件缺少执行权限
3. **Trae Sandbox 限制** - 如果 yw-coder 在 Trae sandbox 下运行，可能限制了 `spawn` 操作
4. **环境变量问题** - `process.env` 中某些关键变量缺失

### 代码分析
`terminalService.ts` 第 16 行调用 `pty.spawn(shell, [], ...)`：
- `shell` 来自 `getShell()` 方法（第 87-120 行）
- macOS 下依次尝试：`$SHELL`, `/bin/zsh`, `/bin/bash`, `/usr/local/bin/zsh`, `/usr/local/bin/bash`

### 可能失败的环节
1. `getShell()` 返回了不存在的路径
2. pty.spawn 在当前环境下被禁止

## 诊断方案

### 步骤 1：添加详细日志
在 `terminalService.ts` 中添加日志，记录：
- 检测到的 shell 路径
- pty.spawn 的具体错误信息

```typescript
// terminalService.ts createSession 方法中
try {
  const ptyProcess = pty.spawn(shell, [], {...});
} catch (error) {
  console.error('[TerminalService] pty.spawn failed:', {
    shell,
    error: error.message,
    code: error.code,
    errno: error.errno,
  });
  throw error;
}
```

### 步骤 2：检查 Shell 存在性
在 `getShell()` 中添加验证，确保返回的 shell 真实存在且可执行。

### 步骤 3：环境变量检查
添加日志输出 `process.env.SHELL` 和 `os.homedir()` 的值。

## 涉及文件
- `/Users/sijia/code/git_program/yw-coder/src/main/services/terminalService.ts`
  - `createSession` 方法
  - `getShell` 方法

## 预期效果
修复后能够：
1. 在控制台看到具体的失败原因
2. 针对性地解决 shell 路径或权限问题
3. 如果是 sandbox 限制问题，明确提示用户
