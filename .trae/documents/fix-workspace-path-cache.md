# 修复工作区路径缓存问题

## 问题描述
在当前窗口重新选择打开文件夹后，AI 仍然使用旧的工作区路径 `/Users/sijia/code/2026/trae/test`，而不是新打开的文件夹。

## 问题原因
`unifiedAgentStore.ts` 在创建任务时，使用 `localStorage.getItem('lastWorkspace')` 获取工作区路径，但当用户在当前窗口切换文件夹时，`localStorage` 没有被更新。

## 问题分析
1. 用户打开文件夹 A → `lastWorkspace` = A
2. 用户在当前窗口切换到文件夹 B → `workspaceStore.workspacePath` = B，但 `localStorage.lastWorkspace` 仍然是 A
3. 用户创建任务 → 使用 `localStorage.lastWorkspace`（即 A），而不是当前打开的 B

## 解决方案

### 方案：同步 localStorage 与 workspaceStore
在 `workspaceStore.ts` 的 `loadWorkspace` 方法中，更新 `localStorage.setItem('lastWorkspace', path)`

## 实施步骤

1. 修改 `src/renderer/store/workspaceStore.ts`
   - 在 `loadWorkspace` 方法中添加 `localStorage.setItem('lastWorkspace', path)`
   - 确保每次加载新工作区时，localStorage 也会被更新

这样当用户在当前窗口切换文件夹时，`lastWorkspace` 会同步更新，创建任务时就能使用正确的工作区路径。
