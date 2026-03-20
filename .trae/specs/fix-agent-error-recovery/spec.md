# Agent错误恢复能力优化 Spec

## Why
当前 Agent 在遇到错误（如权限问题）时会陷入无限循环，反复尝试同样的无效操作，没有自我修复能力。这导致用户体验极差，任务无法完成。

## What Changes
- 在文件操作服务中添加错误检测和分类
- 实现错误恢复策略（权限问题、资源不存在等）
- 添加重试逻辑和降级处理
- 在 Agent 层面添加错误处理和用户提示

## Impact
- 受影响服务：`src/main/services/fileService.ts`
- 受影响 Agent：`src/main/agent/` 目录
- 渲染层：需要增强错误提示 UI

## ADDED Requirements
### Requirement: 文件操作错误分类与恢复
系统 SHALL 能够识别不同类型的文件操作错误并采取相应措施

#### Scenario: 权限错误
- **WHEN** Agent 尝试创建文件/目录但遇到权限错误时
- **THEN** 尝试检查目录权限，向用户提示需要权限
- **AND** 如果是临时目录问题，尝试使用备用目录
- **AND** 提供具体的解决建议

#### Scenario: 路径不存在
- **WHEN** 尝试访问不存在的路径时
- **THEN** 尝试自动创建父目录
- **AND** 如果无法创建，明确告知用户

#### Scenario: 磁盘空间不足
- **WHEN** 遇到磁盘空间错误时
- **THEN** 清理临时文件并重试
- **AND** 向用户提示磁盘空间情况

### Requirement: Agent 错误处理增强
Agent SHALL 能够在遇到错误时采取智能行动而不是无限重试

#### Scenario: 错误重试限制
- **WHEN** 同一操作连续失败超过 3 次时
- **THEN** 停止重试，向用户报告错误
- **AND** 提供具体的错误原因和解决建议

#### Scenario: 错误后换策略
- **WHEN** 当前策略失败时
- **THEN** 分析错误类型，尝试替代方案
- **AND** 如果所有方案都失败，优雅地向用户说明情况

## MODIFIED Requirements
### Requirement: 文件操作服务
原实现：直接返回错误，不做处理
修改后：添加错误检测、重试逻辑和用户友好提示

## REMOVED Requirements
无