# 编辑器渲染问题排查指南

## 概述

本文档用于排查 Win10 内网打包环境下代码编辑器界面无法打开的问题。

## 日志事件说明

### 1. WebContents 事件（主进程）

| 事件 | 级别 | 触发时机 | 用途 |
|------|------|----------|------|
| `webcontents_did_finish_load` | INFO | 页面加载完成 | 确认页面是否成功加载 |
| `webcontents_did_fail_load` | ERROR | 页面加载失败 | 排查网络/资源加载问题 |
| `webcontents_render_process_gone` | ERROR | Renderer 进程崩溃 | 排查进程级问题 |
| `webcontents_unresponsive` | WARN | 页面无响应 | 排查卡顿/死循环问题 |
| `webcontents_console_message` | ERROR | Console 报错 | 捕获前端错误信息 |

### 2. 编辑器区域渲染事件（Renderer 进程）

| 事件 | 级别 | 触发时机 | 用途 |
|------|------|----------|------|
| `editor_area_render_check` | INFO | 编辑器区域渲染逻辑执行 | 确认编辑器区域是否显示 |
| `editor_component_render` | INFO | Editor 组件渲染 | 确认 Editor 组件是否渲染 |
| `editor_monaco_mount_start` | INFO | Monaco 开始挂载 | 确认 Monaco 初始化开始 |
| `editor_monaco_mount_success` | INFO | Monaco 挂载成功 | 确认 Monaco 正常初始化 |
| `editor_monaco_mount_timeout` | WARN | Monaco 挂载超时（3秒） | 排查 Monaco 加载问题 |

### 3. 前端异常事件（Renderer 进程）

| 事件 | 级别 | 触发时机 | 用途 |
|------|------|----------|------|
| `renderer_window_error` | ERROR | window.onerror 触发 | 捕获 JS 运行时错误 |
| `renderer_unhandled_rejection` | ERROR | unhandledrejection 触发 | 捕获未处理的 Promise 错误 |

## 排查场景

### 场景 1：正常打开（参考日志）

```json
{"ts":"2026-03-24T08:30:00.123Z","level":"INFO","event":"webcontents_did_finish_load","url":"http://localhost:5173/"}
{"ts":"2026-03-24T08:30:05.456Z","level":"INFO","event":"editor_area_render_check","showEditor":true,"openFilesCount":2,"activeFilePath":"/src/main.ts","hasActiveFile":true}
{"ts":"2026-03-24T08:30:05.789Z","level":"INFO","event":"editor_component_render","activeFilePath":"/src/main.ts","language":"typescript","openFilesCount":2}
{"ts":"2026-03-24T08:30:05.890Z","level":"INFO","event":"editor_monaco_mount_start","activeFilePath":"/src/main.ts"}
{"ts":"2026-03-24T08:30:06.234Z","level":"INFO","event":"editor_monaco_mount_success","activeFilePath":"/src/main.ts","durationMs":344}
```

**特征**：所有事件按顺序出现，最后出现 `editor_monaco_mount_success`

---

### 场景 2：Monaco 挂载失败

```json
{"ts":"2026-03-24T08:30:00.123Z","level":"INFO","event":"webcontents_did_finish_load","url":"http://localhost:5173/"}
{"ts":"2026-03-24T08:30:05.456Z","level":"INFO","event":"editor_area_render_check","showEditor":true,"openFilesCount":1,"activeFilePath":"/test.ts","hasActiveFile":true}
{"ts":"2026-03-24T08:30:05.789Z","level":"INFO","event":"editor_component_render","activeFilePath":"/test.ts","language":"typescript","openFilesCount":1}
{"ts":"2026-03-24T08:30:05.890Z","level":"INFO","event":"editor_monaco_mount_start","activeFilePath":"/test.ts"}
{"ts":"2026-03-24T08:30:08.890Z","level":"WARN","event":"editor_monaco_mount_timeout","activeFilePath":"/test.ts","timeoutMs":3000}
{"ts":"2026-03-24T08:30:09.100Z","level":"ERROR","event":"renderer_window_error","message":"Monaco loader failed","stack":"Error: Monaco loader failed...","source":"webpack:///node_modules/monaco-editor"}
```

**特征**：
- 有 `editor_monaco_mount_start`
- 没有 `editor_monaco_mount_success`
- 出现 `editor_monaco_mount_timeout`
- 可能伴随 `renderer_window_error`

**可能原因**：
- Monaco worker 加载失败
- 路径问题（打包后路径变化）
- 内存不足
- CSP 策略阻止加载

**排查方向**：
1. 检查 `webcontents_console_message` 是否有 worker 加载错误
2. 检查打包后的 monaco-editor 文件是否存在
3. 检查是否有 CSP 相关错误

---

### 场景 3：Renderer 进程崩溃

```json
{"ts":"2026-03-24T08:30:00.123Z","level":"INFO","event":"webcontents_did_finish_load","url":"http://localhost:5173/"}
{"ts":"2026-03-24T08:30:02.456Z","level":"INFO","event":"editor_area_render_check","showEditor":true,"openFilesCount":0,"hasActiveFile":false}
{"ts":"2026-03-24T08:30:03.000Z","level":"ERROR","event":"webcontents_render_process_gone","reason":"crashed","exitCode":-1}
```

**特征**：
- 页面加载完成
- 编辑器区域渲染检查通过
- 突然出现 `webcontents_render_process_gone`

**可能原因**：
- 内存溢出（OOM）
- GPU 渲染问题
- Electron 内部错误
- 原生模块崩溃

**排查方向**：
1. 检查是否有 `disable-gpu` 配置
2. 检查系统内存使用情况
3. 检查是否有原生模块错误
4. 尝试添加 `--no-sandbox` 启动参数

---

### 场景 4：页面加载失败

```json
{"ts":"2026-03-24T08:30:00.123Z","level":"ERROR","event":"webcontents_did_fail_load","errorCode":"-2","errorDescription":"ERR_FAILED","url":"http://localhost:5173/"}
```

**特征**：
- 只有 `webcontents_did_fail_load`
- 没有后续任何事件

**可能原因**：
- 网络问题
- Vite 服务未启动
- 防火墙阻止
- 资源文件缺失

**排查方向**：
1. 检查网络连接
2. 检查 Vite 服务是否正常
3. 检查防火墙设置
4. 检查打包后的资源文件是否完整

---

### 场景 5：编辑器区域未渲染

```json
{"ts":"2026-03-24T08:30:00.123Z","level":"INFO","event":"webcontents_did_finish_load","url":"http://localhost:5173/"}
```

**特征**：
- 页面加载完成
- 没有 `editor_area_render_check`

**可能原因**：
- React 组件未渲染
- 条件渲染阻断（如 showEditor=false）
- 路由问题
- 状态管理问题

**排查方向**：
1. 检查 `showEditor` 状态
2. 检查路由配置
3. 检查 React 组件树
4. 检查是否有 JS 错误阻止渲染

---

### 场景 6：Editor 组件未渲染

```json
{"ts":"2026-03-24T08:30:00.123Z","level":"INFO","event":"webcontents_did_finish_load","url":"http://localhost:5173/"}
{"ts":"2026-03-24T08:30:05.456Z","level":"INFO","event":"editor_area_render_check","showEditor":true,"openFilesCount":0,"hasActiveFile":false}
```

**特征**：
- 有 `editor_area_render_check`
- 没有 `editor_component_render`

**可能原因**：
- Editor 组件未导入
- 条件渲染阻断（如没有打开的文件）
- 组件懒加载失败

**排查方向**：
1. 检查 `openFilesCount` 和 `hasActiveFile`
2. 检查 Editor 组件导入
3. 检查条件渲染逻辑

---

### 场景 7：前端运行时异常

```json
{"ts":"2026-03-24T08:30:00.123Z","level":"INFO","event":"webcontents_did_finish_load","url":"http://localhost:5173/"}
{"ts":"2026-03-24T08:30:05.456Z","level":"INFO","event":"editor_area_render_check","showEditor":true,"openFilesCount":2,"activeFilePath":"/src/main.ts","hasActiveFile":true}
{"ts":"2026-03-24T08:30:05.789Z","level":"ERROR","event":"renderer_window_error","message":"Cannot read property 'xxx' of undefined","stack":"TypeError: Cannot read property...","source":"webpack:///src/renderer/components/Editor/Editor.tsx"}
```

**特征**：
- 页面加载完成
- 编辑器区域渲染检查通过
- 出现 `renderer_window_error` 或 `renderer_unhandled_rejection`

**可能原因**：
- 代码逻辑错误
- 依赖版本不兼容
- 数据格式问题

**排查方向**：
1. 查看错误信息和堆栈
2. 检查相关组件代码
3. 检查依赖版本

---

## 快速排查流程

```
1. 检查是否有 webcontents_did_finish_load
   └─ 没有 → 页面加载问题 → 检查网络/Vite/防火墙
   └─ 有 → 继续

2. 检查是否有 editor_area_render_check
   └─ 没有 → React 渲染层问题 → 检查组件树/状态
   └─ 有 → 继续

3. 检查是否有 editor_component_render
   └─ 没有 → Editor 组件层问题 → 检查条件渲染/导入
   └─ 有 → 继续

4. 检查是否有 editor_monaco_mount_start
   └─ 没有 → Monaco 初始化层问题 → 检查导入/loader
   └─ 有 → 继续

5. 检查是否有 editor_monaco_mount_success
   └─ 没有 → Monaco 挂载层问题
      ├─ 有 editor_monaco_mount_timeout → 加载超时 → 检查 worker/路径
      ├─ 有 renderer_window_error → 运行时错误 → 查看错误详情
      └─ 有 webcontents_render_process_gone → 进程崩溃 → 检查 GPU/内存
   └─ 有 → 编辑器正常加载，问题在其他地方
```

## 日志文件位置

- **Windows**: `%APPDATA%/YWCodeR/logs/ywcoder-YYYY-MM-DD.log`
- **macOS**: `~/Library/Application Support/YWCodeR/logs/ywcoder-YYYY-MM-DD.log`
- **Linux**: `~/.config/YWCodeR/logs/ywcoder-YYYY-MM-DD.log`

## 相关配置

### GPU 相关

```javascript
// src/main/index.ts
app.commandLine.appendSwitch('disable-gpu');
// 注意：不要同时添加 disable-software-rasterizer
// 保留软件栅格化作为渲染回退路径
```

### 窗口配置

```javascript
// Windows 建议配置
titleBarStyle: 'default',  // 或 'hidden'，不要使用 'hiddenInset'
frame: true,  // Windows 下建议保留 frame
```

## 常见问题

### Q: 为什么打包后看不到控制台错误？
A: 打包后的应用默认不显示 DevTools，需要通过日志系统捕获错误。本方案通过 `logRenderEvent` 将前端错误上报到主进程，写入日志文件。

### Q: 日志文件没有写入怎么办？
A: 
1. 检查 `%APPDATA%/YWCodeR/logs/` 目录是否存在
2. 检查应用是否有写入权限
3. 检查 logger 是否初始化成功（查看 `logger_initialized` 事件）

### Q: Monaco worker 加载失败怎么排查？
A:
1. 查看 `webcontents_console_message` 是否有 worker 加载错误
2. 检查打包后的 `monaco-editor` 目录是否存在
3. 检查 worker 路径配置是否正确（打包后路径可能变化）

### Q: 如何区分是 GPU 问题还是 Monaco 问题？
A:
- **GPU 问题**：通常会出现 `webcontents_render_process_gone`，且整个窗口白屏/崩溃
- **Monaco 问题**：页面其他部分正常，只有编辑器区域空白，有 `editor_monaco_mount_timeout`
