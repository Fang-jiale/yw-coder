# 最小渲染日志方案 Spec

## Why
Win10 内网打包环境下代码编辑器界面无法打开，需要通过最小必要日志判断问题发生在哪一层：是编辑器区域根本没渲染、Monaco 挂载失败、前端异常，还是 Renderer 进程本身异常。

## What Changes
- 在 preload 暴露 `window.electronAPI.logRenderEvent(event, data)` 方法
- renderer 关键位置调用该方法上报日志到主进程
- 主进程复用现有日志体系统一写入日志文件
- 添加 4 类日志点：编辑器区域渲染、Monaco 挂载、前端全局异常、webContents 事件

## Impact
- Affected specs: windows-tool-call-debug-logging（复用其日志体系）
- Affected code: src/main/preload.ts, src/main/index.ts, src/renderer/App.tsx, src/renderer/components/Editor/Editor.tsx

## ADDED Requirements

### Requirement: Preload 暴露渲染日志方法
The system SHALL expose `window.electronAPI.logRenderEvent(event, data)` in preload.

#### Scenario: Renderer 上报日志
- **WHEN** renderer 进程调用 `window.electronAPI.logRenderEvent('editor_component_render', {...})`
- **THEN** 主进程接收并通过 logger 写入日志文件

### Requirement: 编辑器区域渲染日志
The system SHALL log `editor_area_render_check` in App.tsx or editor entry.

#### Scenario: 判断编辑器区域是否显示
- **WHEN** 编辑器区域渲染逻辑执行
- **THEN** 记录 showEditor, openFilesCount, activeFilePath, hasActiveFile

### Requirement: Monaco 挂载日志
The system SHALL log Monaco mount lifecycle in Editor.tsx.

#### Scenario: 判断 Monaco 是否成功挂载
- **WHEN** Editor 组件渲染时，记录 `editor_component_render`
- **WHEN** Monaco 开始挂载时，记录 `editor_monaco_mount_start`
- **WHEN** Monaco onMount 成功时，记录 `editor_monaco_mount_success`
- **WHEN** 3 秒内未 mount 成功，记录 `editor_monaco_mount_timeout`

### Requirement: 前端全局异常日志
The system SHALL capture and log global errors and unhandled rejections.

#### Scenario: 捕获前端异常
- **WHEN** window 发生 error 事件，记录 `renderer_window_error`
- **WHEN** 发生 unhandledrejection 事件，记录 `renderer_unhandled_rejection`

### Requirement: WebContents 事件日志
The system SHALL log webContents lifecycle and error events.

#### Scenario: 判断页面加载和进程问题
- **WHEN** did-finish-load 事件触发，记录 `webcontents_did_finish_load`
- **WHEN** did-fail-load 事件触发，记录 `webcontents_did_fail_load`
- **WHEN** render-process-gone 事件触发，记录 `webcontents_render_process_gone`
- **WHEN** unresponsive 事件触发，记录 `webcontents_unresponsive`
- **WHEN** console-message 事件触发（error 级别），记录 `webcontents_console_message`

## 示例日志输出

### 正常场景（编辑器正常打开）
```json
{"ts":"2026-03-24T08:30:00.123Z","level":"INFO","event":"webcontents_did_finish_load","url":"http://localhost:5173/"}
{"ts":"2026-03-24T08:30:05.456Z","level":"INFO","event":"editor_area_render_check","showEditor":true,"openFilesCount":2,"activeFilePath":"/src/main.ts","hasActiveFile":true}
{"ts":"2026-03-24T08:30:05.789Z","level":"INFO","event":"editor_component_render","activeFilePath":"/src/main.ts","language":"typescript","openFilesCount":2}
{"ts":"2026-03-24T08:30:05.890Z","level":"INFO","event":"editor_monaco_mount_start","activeFilePath":"/src/main.ts"}
{"ts":"2026-03-24T08:30:06.234Z","level":"INFO","event":"editor_monaco_mount_success","activeFilePath":"/src/main.ts","durationMs":344}
```

### Monaco 挂载失败场景
```json
{"ts":"2026-03-24T08:30:00.123Z","level":"INFO","event":"webcontents_did_finish_load","url":"http://localhost:5173/"}
{"ts":"2026-03-24T08:30:05.456Z","level":"INFO","event":"editor_area_render_check","showEditor":true,"openFilesCount":1,"activeFilePath":"/test.ts","hasActiveFile":true}
{"ts":"2026-03-24T08:30:05.789Z","level":"INFO","event":"editor_component_render","activeFilePath":"/test.ts","language":"typescript","openFilesCount":1}
{"ts":"2026-03-24T08:30:05.890Z","level":"INFO","event":"editor_monaco_mount_start","activeFilePath":"/test.ts"}
{"ts":"2026-03-24T08:30:08.890Z","level":"WARN","event":"editor_monaco_mount_timeout","activeFilePath":"/test.ts","timeoutMs":3000}
{"ts":"2026-03-24T08:30:09.100Z","level":"ERROR","event":"renderer_window_error","message":"Monaco loader failed","stack":"Error: Monaco loader failed...","source":"webpack:///node_modules/monaco-editor"}
```

### Renderer 进程崩溃场景
```json
{"ts":"2026-03-24T08:30:00.123Z","level":"INFO","event":"webcontents_did_finish_load","url":"http://localhost:5173/"}
{"ts":"2026-03-24T08:30:02.456Z","level":"INFO","event":"editor_area_render_check","showEditor":true,"openFilesCount":0,"hasActiveFile":false}
{"ts":"2026-03-24T08:30:03.000Z","level":"ERROR","event":"webcontents_render_process_gone","reason":"crashed","exitCode":-1}
```

### 页面加载失败场景
```json
{"ts":"2026-03-24T08:30:00.123Z","level":"ERROR","event":"webcontents_did_fail_load","errorCode":"-2","errorDescription":"ERR_FAILED","url":"http://localhost:5173/"}
```

## 排查指南

| 日志现象 | 问题层级 | 可能原因 |
|---------|---------|---------|
| 没有 `webcontents_did_finish_load` | 页面加载层 | 网络问题、Vite 未启动、防火墙 |
| 有 `webcontents_did_finish_load` 但没有 `editor_area_render_check` | React 渲染层 | 组件未渲染、条件渲染阻断、状态问题 |
| 有 `editor_area_render_check` 但没有 `editor_component_render` | Editor 组件层 | 组件未导入、路由问题、条件渲染 |
| 有 `editor_component_render` 但没有 `editor_monaco_mount_start` | Monaco 初始化层 | Monaco 导入失败、loader 问题 |
| 有 `editor_monaco_mount_start` 但没有 `editor_monaco_mount_success` | Monaco 挂载层 | worker 加载失败、路径问题、内存不足 |
| 出现 `editor_monaco_mount_timeout` | Monaco 挂载超时 | 资源加载慢、worker 初始化失败 |
| 出现 `renderer_window_error` | 前端运行时异常 | 代码错误、依赖问题、兼容性问题 |
| 出现 `webcontents_render_process_gone` | Renderer 进程层 | 内存溢出、GPU 问题、Electron 崩溃 |
