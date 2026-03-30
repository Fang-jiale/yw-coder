# Checklist

- [ ] Preload 暴露渲染日志方法
  - [ ] `logRenderEvent` 方法已暴露到 `window.electronAPI`
  - [ ] IPC 通道 `renderer:log-render-event` 已注册
  - [ ] 主进程正确接收并写入日志

- [ ] 编辑器区域渲染日志
  - [ ] `editor_area_render_check` 事件在 App.tsx 中正确记录
  - [ ] 包含 showEditor, openFilesCount, activeFilePath, hasActiveFile 字段

- [ ] Monaco 挂载日志
  - [ ] `editor_component_render` 事件在 Editor.tsx 渲染时记录
  - [ ] `editor_monaco_mount_start` 事件在 Monaco 挂载前记录
  - [ ] `editor_monaco_mount_success` 事件在 onMount 成功时记录
  - [ ] `editor_monaco_mount_timeout` 事件在 3 秒超时后记录

- [ ] 前端全局异常日志
  - [ ] `renderer_window_error` 事件在 window.onerror 触发时记录
  - [ ] `renderer_unhandled_rejection` 事件在 unhandledrejection 触发时记录
  - [ ] 包含 message, stack, source 字段

- [ ] WebContents 事件日志
  - [ ] `webcontents_did_finish_load` 事件在页面加载完成时记录
  - [ ] `webcontents_did_fail_load` 事件在页面加载失败时记录
  - [ ] `webcontents_render_process_gone` 事件在 renderer 崩溃时记录
  - [ ] `webcontents_unresponsive` 事件在页面无响应时记录
  - [ ] `webcontents_console_message` 事件在 console error 时记录

- [ ] 日志验证
  - [ ] 所有日志事件使用结构化 JSON 格式
  - [ ] 日志正确落入 userData/logs 目录
  - [ ] 日志可以通过 traceId 或时间串联分析
