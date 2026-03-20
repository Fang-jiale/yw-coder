# 修复 SOLO 模式权限错误处理

## 问题描述
SOLO 任务执行时遇到权限错误，但：
1. 直接显示任务执行完成
2. 实际上文件没有创建成功
3. 控制台没有报错信息
4. 权限申请面板没有显示

## 问题分析
需要调查以下可能的原因：

1. **权限错误没有被正确检测**
   - `aiToolService.ts` 中的错误分类是否正确
   - 错误是否被正确抛出

2. **权限错误没有被正确传递**
   - `aiStreamService.ts` 是否正确抛出 PERMISSION_ERROR
   - `DynamicSoloExecutor.ts` 是否正确捕获并处理

3. **事件没有正确发送到前端**
   - `unifiedAgentIPC.ts` 是否正确广播事件
   - 前端是否正确监听

4. **任务状态被错误标记为完成**
   - 权限错误发生后任务状态是否被正确设置
   - 是否发送了错误的完成事件

## 修复步骤

### 步骤 1: 检查权限错误检测
- 文件: `/Users/sijia/code/git_program/yw-coder/src/main/services/aiToolService.ts`
- 检查 `classifyError` 方法是否正确识别权限错误
- 检查 `writeFile` 方法是否正确返回错误信息

### 步骤 2: 检查权限错误传递
- 文件: `/Users/sijia/code/git_program/yw-coder/src/main/services/aiStreamService.ts`
- 确认权限错误时是否正确抛出异常
- 确认异常是否包含 PERMISSION_ERROR 标记

### 步骤 3: 检查 DynamicSoloExecutor 错误处理
- 文件: `/Users/sijia/code/git_program/yw-coder/src/main/agent/solo/DynamicSoloExecutor.ts`
- 检查 `execute` 方法的错误捕获
- 确认权限错误时是否正确发送 `permissionRequest` 事件
- 确认权限错误时是否正确设置任务状态

### 步骤 4: 检查任务完成事件发送
- 确认是否在权限错误发生后错误地发送了 `complete` 事件
- 检查 `execute` 方法的所有返回路径

### 步骤 5: 添加详细日志
- 在关键位置添加日志输出
- 追踪权限错误的完整流程

### 步骤 6: 验证修复
- 测试权限错误场景
- 确认权限面板正确显示
- 确认任务状态正确
