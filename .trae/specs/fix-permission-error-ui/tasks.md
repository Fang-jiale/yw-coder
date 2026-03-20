# 任务列表

## 任务 1: 创建 PermissionRequestPanel 组件
- [x] 1.1 创建 `src/renderer/components/Chat/PermissionRequestPanel.tsx` 组件
  - 显示权限错误原因
  - 显示授权方案按钮，按钮上直接显示对应命令：
    - `chmod -R 755 "/path"` - 为当前用户添加读写执行权限
    - `sudo chown -R $(whoami) "/path"` - 将目录所有权改为当前用户
  - 点击按钮执行相应命令
  - 显示命令执行结果

## 任务 2: 修改 ChatPanel 集成权限面板
- [x] 2.1 在 `ChatPanel.tsx` 中添加 permissionRequest 状态管理
- [x] 2.2 监听 `agent:permissionRequest` 事件
- [x] 2.3 在对话框内渲染 PermissionRequestPanel
- [x] 2.4 授权成功后调用 `agent:task:resume` 恢复任务

## 任务 3: 修改权限错误处理流程
- [x] 3.1 修改 `DynamicSoloExecutor.ts`，确保权限错误时发送 permissionRequest 事件
- [x] 3.2 修改 `unifiedAgentIPC.ts`，确保权限错误时任务状态为 paused 而不是 failed
- [x] 3.3 确保错误信息不通过 error 弹框显示

## 任务 4: 实现授权命令执行
- [x] 4.1 在 `unifiedAgentIPC.ts` 中添加 `agent:permission:grant` IPC 处理器
- [x] 4.2 实现命令执行逻辑（使用 child_process）
- [x] 4.3 返回执行结果给前端

# 任务依赖关系
- 任务 1 和 任务 3 可并行进行
- 任务 2 依赖任务 1 和 任务 3
- 任务 4 依赖任务 2
