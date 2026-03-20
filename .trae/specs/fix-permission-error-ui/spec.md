# 权限错误提示UI优化 Spec

## Why
当前当 Agent 遇到权限错误时，错误信息（包括解决建议）直接显示在错误弹框中，用户体验不佳。用户希望在对话框内看到友好的权限申请提示，并能够直接选择授权方案进行操作。

## What Changes
- 修改权限错误处理流程，不再显示错误弹框
- 在对话框内显示权限申请面板
- 提供一键授权按钮，用户点击即可执行授权命令
- 授权成功后自动恢复任务执行

## Impact
- 受影响文件：`src/renderer/components/Chat/ChatPanel.tsx`
- 受影响文件：`src/renderer/components/Chat/PermissionRequestPanel.tsx`（新建）
- 受影响文件：`src/main/agent/unifiedAgentIPC.ts`
- 受影响文件：`src/main/agent/solo/DynamicSoloExecutor.ts`

## ADDED Requirements

### Requirement: 对话框内权限申请面板
系统 SHALL 在对话框内显示权限申请面板，而不是错误弹框

#### Scenario: 权限错误发生
- **WHEN** Agent 遇到权限错误（EACCES/EPERM）时
- **THEN** 任务状态变为 paused
- **AND** 在对话框内显示权限申请面板
- **AND** 面板显示错误原因和解决建议

#### Scenario: 用户选择授权方案
- **WHEN** 用户点击授权按钮时
- **THEN** 按钮上直接显示要执行的命令（如 `chmod -R 755 "/path"`）
- **AND** 执行相应的授权命令
- **AND** 显示命令执行进度
- **AND** 成功后自动恢复任务

#### Scenario: 授权失败
- **WHEN** 授权命令执行失败时
- **THEN** 显示错误原因
- **AND** 提供手动执行的命令供用户复制

## MODIFIED Requirements

### Requirement: 权限错误处理流程
原实现：抛出 PERMISSION_ERROR，显示错误弹框
修改后：发送 permissionRequest 事件，在对话框内显示面板

### Requirement: 任务状态管理
原实现：权限错误时任务状态为 failed
修改后：权限错误时任务状态为 paused，可恢复

## REMOVED Requirements
无
