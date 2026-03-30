# Tasks

- [ ] Task 1: Preload 暴露渲染日志方法
  - [ ] 在 preload.ts 添加 `logRenderEvent` 方法
  - [ ] 通过 IPC 将日志发送到主进程
  - [ ] 主进程接收并调用 logger 写入日志

- [ ] Task 2: 编辑器区域渲染日志
  - [ ] 在 App.tsx 编辑器区域渲染逻辑处添加 `editor_area_render_check` 日志
  - [ ] 记录 showEditor, openFilesCount, activeFilePath, hasActiveFile

- [ ] Task 3: Monaco 挂载日志
  - [ ] 在 Editor.tsx 组件渲染时添加 `editor_component_render` 日志
  - [ ] 在 Monaco 开始挂载前添加 `editor_monaco_mount_start` 日志
  - [ ] 在 Monaco onMount 成功时添加 `editor_monaco_mount_success` 日志
  - [ ] 添加 3 秒超时检测，超时记录 `editor_monaco_mount_timeout`

- [ ] Task 4: 前端全局异常日志
  - [ ] 在 renderer 入口（main.tsx 或 App.tsx）添加 window.onerror 监听
  - [ ] 添加 unhandledrejection 事件监听
  - [ ] 通过 logRenderEvent 上报异常到主进程

- [ ] Task 5: WebContents 事件日志
  - [ ] 在 index.ts BrowserWindow 创建后添加 did-finish-load 监听
  - [ ] 添加 did-fail-load 监听
  - [ ] 添加 render-process-gone 监听
  - [ ] 添加 unresponsive 监听
  - [ ] 添加 console-message 监听（仅 error 级别）

- [ ] Task 6: 验证日志输出
  - [ ] 本地运行验证所有日志事件正确输出
  - [ ] 验证日志格式符合结构化 JSON 格式
  - [ ] 验证日志能正确落入文件

# Task Dependencies
- Task 1 必须在 Task 2, 3, 4 之前完成（需要先暴露 logRenderEvent 方法）
- Task 5 可以独立进行（在主进程中完成）
- Task 6 依赖所有其他任务完成
