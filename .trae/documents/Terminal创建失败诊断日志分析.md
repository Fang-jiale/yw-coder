# 修复 Terminal 创建失败问题 - 诊断日志分析

## 错误日志分析

```
[TerminalService] Creating terminal session: {
  shell: '/bin/zsh',
  cwd: '/Users/sijia',
  processEnvShell: '/bin/zsh',
  homedir: '/Users/sijia'
}

[TerminalService] pty.spawn failed: {
  shell: '/bin/zsh',
  error: 'posix_spawnp failed.',
  code: undefined,      ← 关键：无错误码
  errno: undefined,     ← 关键：无 errno
  syscall: undefined    ← 关键：无 syscall
}
```

## 关键发现

1. **Shell 路径正确**：`/bin/zsh` 存在且有效
2. **环境变量正确**：`processEnvShell` 和 `homedir` 都正确
3. **错误码为空**：`code`、`errno`、`syscall` 都是 `undefined`

这说明错误发生在 **node-pty 底层 Native 代码** 层面，而不是 Node.js 层。

## 问题定位

### 可能原因（按可能性排序）：

| 可能性 | 原因 | 排除方法 |
|-------|------|---------|
| 高 | spawn-helper 没有执行权限 | `ls -la` 检查权限 |
| 高 | macOS 安全限制阻止 | 检查是否有 quarantine 属性 |
| 中 | Electron + M1 兼容性问题 | 检查 Electron 版本 |
| 中 | node-pty 二进制与 Electron 不兼容 | `npm rebuild` |
| 低 | asar 打包问题 | 检查是否以 asar 运行 |

## 诊断步骤（排除法）

### 步骤 1：检查 spawn-helper 文件权限
```bash
ls -la node_modules/node-pty/prebuilds/darwin-arm64/spawn-helper
ls -la node_modules/node-pty/prebuilds/darwin-arm64/pty.node
```
**期望**：如果有执行权限，会有 `x` 标志

### 步骤 2：检查是否有 quarantine 属性（macOS 安全）
```bash
xattr -l node_modules/node-pty/prebuilds/darwin-arm64/spawn-helper
xattr -l node_modules/node-pty/prebuilds/darwin-arm64/pty.node
```
**期望**：如果显示 `com.apple.quarantine`，说明被 Gatekeeper 阻止

### 步骤 3：检查文件类型
```bash
file node_modules/node-pty/prebuilds/darwin-arm64/spawn-helper
file node_modules/node-pty/prebuilds/darwin-arm64/pty.node
```
**期望**：显示为 Mach-O executable

### 步骤 4：检查 node-pty 版本和 Electron 版本匹配
```bash
cat node_modules/node-pty/package.json | grep version
cat node_modules/electron/package.json | grep version
```
**检查**：node-pty 的 prebuilds 是否支持当前 Electron 版本

### 步骤 5：尝试直接运行 spawn-helper
```bash
./node_modules/node-pty/prebuilds/darwin-arm64/spawn-helper
```
**期望**：如果权限问题，会显示具体错误

## 解决方案（根据诊断结果）

| 诊断结果 | 解决方案 |
|---------|---------|
| 无执行权限 | `chmod +x` 添加执行权限 |
| 有 quarantine 属性 | `xattr -d com.apple.quarantine` 移除 |
| 版本不兼容 | `npm rebuild node-pty` 或升级 node-pty |
| M1 + Electron 问题 | 使用 --legacy-peer-deps 或降级 Electron |
