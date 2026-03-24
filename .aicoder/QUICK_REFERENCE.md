# 快速参考指南

## 智能体系统重构 - 第一阶段完成

本文档提供新实现的智能体系统模块的快速参考和使用示例。

---

## 1. 状态机 (AgentStateMachine)

### 基本使用

```typescript
import { AgentStateMachine } from '@/main/agent/core';

// 创建状态机
const stateMachine = new AgentStateMachine({ taskId: 'task-123' });

// 获取当前状态
console.log(stateMachine.getState()); // 'idle'

// 执行状态转换
stateMachine.transition({ type: 'START' });
console.log(stateMachine.getState()); // 'initializing'

// 检查是否正在运行
console.log(stateMachine.isRunning()); // true

// 获取可用的转换
console.log(stateMachine.getAvailableEvents()); // ['DONE', 'ERROR']

// 获取状态元数据
const metadata = stateMachine.getStateMetadata();
console.log(metadata);
// {
//   state: 'initializing',
//   isRunning: true,
//   isFinal: false,
//   availableEvents: ['DONE', 'ERROR'],
//   historyLength: 2
// }
```

### 事件订阅

```typescript
const unsubscribe = stateMachine.subscribe((state, event) => {
  console.log(`State changed: ${state} (${event})`);
});

// 取消订阅
unsubscribe();
```

### 状态历史

```typescript
const history = stateMachine.getHistory();
console.log(history);
// [
//   { state: 'idle', event: 'INIT', timestamp: 16795..., context: {} },
//   { state: 'initializing', event: 'START', timestamp: 16795..., context: {} }
// ]
```

---

## 2. 上下文管理器 (AgentContextManager)

### 基本使用

```typescript
import { AgentContextManager } from '@/main/agent/core';

// 创建上下文管理器
const contextManager = new AgentContextManager({
  taskId: 'task-123',
  workspacePath: '/workspace/project',
  taskTitle: 'Build React App',
  taskDescription: 'Create a new React application'
});

// 获取上下文
const context = contextManager.getContext();

// 设置项目信息
contextManager.setProjectInfo('React', ['React', 'TypeScript'], ['react', 'react-dom']);

// 添加分析文件
contextManager.addAnalyzedFile({
  path: 'src/App.tsx',
  purpose: 'Main application component',
  dependencies: ['react'],
  exports: ['default App']
});

// 添加需求
contextManager.addRequirement({
  id: 'req-1',
  description: 'User authentication',
  priority: 'high',
  status: 'pending'
});

// 验证上下文
const validation = contextManager.validate();
console.log(validation);
// { isValid: true, errors: [], warnings: [...] }
```

### 元数据管理

```typescript
contextManager.setMetadata('customKey', { value: 'data' });
const value = contextManager.getMetadata('customKey');
```

### 克隆

```typescript
const cloned = contextManager.clone();
```

---

## 3. 策略模式 (Strategies)

### 获取可用策略

```typescript
import { getAvailableStrategies, createStrategy } from '@/main/agent/strategies';

// 获取所有可用策略
const strategies = getAvailableStrategies();
console.log(strategies);
// [
//   { type: 'chat', name: 'Chat', description: '...' },
//   { type: 'builder', name: 'Builder', description: '...' },
//   { type: 'solo', name: 'SOLO', description: '...' }
// ]

// 创建策略实例
const strategy = createStrategy('solo');
```

### 使用策略

```typescript
const context = {
  task: {
    id: 'task-123',
    messages: [{ id: '1', role: 'user', content: 'Build a todo app', timestamp: Date.now() }]
  },
  context: contextManager.getContext(),
  callbacks: {
    onProgress: (message) => console.log(message),
    onStepStart: (step) => console.log('Step started:', step.description),
    onStepComplete: (step) => console.log('Step completed:', step.description),
    onError: (error) => console.error('Error:', error)
  },
  isPaused: false,
  isStopped: false
};

// 验证策略
const validation = strategy.validate(context);
if (!validation.valid) {
  console.error('Validation failed:', validation.errors);
  return;
}

// 执行策略
const result = await strategy.execute(context);
console.log(result);
// { success: true, messages: [...], steps: [...] }
```

---

## 4. 工具注册表 (ToolRegistry)

### 基本使用

```typescript
import { ToolRegistry } from '@/main/agent/tools';

// 创建注册表
const registry = new ToolRegistry();

// 注册工具
registry.register({
  name: 'my_tool',
  execute: async (params) => {
    console.log('Executing with params:', params);
    return { success: true, data: 'result' };
  },
  metadata: {
    name: 'my_tool',
    description: 'My custom tool',
    category: 'code',
    parameters: [
      { name: 'param1', type: 'string', required: true }
    ]
  }
});

// 获取工具
const tool = registry.get('my_tool');

// 列出所有工具
console.log(registry.listTools());

// 按类别列出
console.log(registry.listToolsByCategory('file'));

// 搜索工具
const results = registry.searchTools('file');
```

---

## 5. 工具权限管理 (ToolPermissionManager)

### 基本使用

```typescript
import { ToolPermissionManager } from '@/main/agent/tools';

// 创建权限管理器
const permissionManager = new ToolPermissionManager();

// 检查权限
const result = permissionManager.checkPermission({
  toolName: 'write_file',
  params: { file_path: '/workspace/test.txt' },
  workspacePath: '/workspace'
});

console.log(result);
// { allowed: true, reason: '...' }

// 请求确认
const approved = await permissionManager.requestConfirmation('delete_file', {
  file_path: '/workspace/test.txt'
});
```

### 设置自定义权限

```typescript
permissionManager.setPermission({
  toolName: 'custom_tool',
  allowed: true,
  requiresConfirmation: true,
  maxCallsPerTask: 10,
  allowedFilePatterns: ['/workspace/src/**', '/workspace/test/**'],
  deniedFilePatterns: ['/workspace/secrets/**']
});
```

---

## 6. 检查点管理器 (CheckpointManager)

### 基本使用

```typescript
import { CheckpointManager } from '@/main/agent/checkpoint';

// 创建检查点管理器
const checkpointManager = new CheckpointManager('/workspace/project', {
  maxCheckpoints: 10,
  maxVersionsPerCheckpoint: 5
});

// 保存检查点
const checkpoint = await checkpointManager.saveCheckpoint('task-123', {
  taskData: '...',
  progress: 50
});

console.log(checkpoint);
// {
//   id: 'checkpoint-16795...',
//   taskId: 'task-123',
//   data: {...},
//   timestamp: 16795...,
//   version: 1
// }

// 加载最新检查点
const latest = await checkpointManager.loadCheckpoint('task-123');

// 加载特定版本
const v2 = await checkpointManager.loadCheckpoint('task-123', 2);

// 列出所有检查点
const checkpoints = await checkpointManager.listCheckpoints('task-123');

// 获取版本历史
const versions = await checkpointManager.getCheckpointVersions('task-123');

// 获取统计信息
const stats = await checkpointManager.getStats('task-123');
```

---

## 7. 错误恢复管理器 (ErrorRecoveryManager)

### 基本使用

```typescript
import { ErrorRecoveryManager } from '@/main/agent/error';

// 创建错误恢复管理器
const errorManager = new ErrorRecoveryManager();

// 分类错误
const classified = errorManager.classifyError(new Error('Network error: timeout'));
console.log(classified);
// {
//   category: 'network',
//   severity: 'medium',
//   message: 'Network error: timeout',
//   recoverable: true,
//   suggestedAction: 'Retry with exponential backoff'
// }

// 执行恢复
const recoveryContext = {
  taskId: 'task-123',
  workspacePath: '/workspace',
  retryCount: 0,
  maxRetries: 3,
  errorHistory: []
};

const result = await errorManager.recover(new Error('Network timeout'), recoveryContext);
console.log(result);
// {
//   success: true,
//   action: 'retry',
//   message: 'Retrying after 1000ms',
//   shouldRetry: true
// }

// 获取错误统计
const stats = errorManager.getErrorStatistics();
```

### 注册自定义恢复策略

```typescript
errorManager.registerStrategy({
  name: 'custom_recovery',
  description: 'Custom recovery strategy',
  canHandle: (error) => error.category === 'execution',
  execute: async (error, context) => {
    // 自定义恢复逻辑
    return { success: true, action: 'retry', shouldRetry: true };
  }
});
```

---

## 8. 统一导出

所有模块都通过统一入口导出：

```typescript
import {
  // Core
  AgentStateMachine,
  createStateMachine,
  AgentContextManager,
  createAgentContext,

  // Strategies
  createStrategy,
  getAvailableStrategies,

  // Tools
  ToolRegistry,
  ToolPermissionManager,

  // Checkpoint
  CheckpointManager,

  // Error
  ErrorRecoveryManager,
} from '@/main/agent';
```

---

## 9. 最佳实践

### 状态机使用

1. **始终验证状态转换**
   ```typescript
   if (stateMachine.canTransition('PAUSE')) {
     stateMachine.transition({ type: 'PAUSE' });
   }
   ```

2. **使用状态元数据进行调试**
   ```typescript
   const metadata = stateMachine.getStateMetadata();
   console.log('Current state:', metadata);
   ```

### 策略选择

1. **简单问答**: 使用 `ChatStrategy`
2. **需要代码生成**: 使用 `BuilderStrategy`
3. **全自动化**: 使用 `SoloStrategy`

### 工具权限

1. **危险操作默认禁止**
   ```typescript
   {
     toolName: 'delete_file',
     allowed: false,
     requiresConfirmation: true
   }
   ```

2. **使用文件模式限制**
   ```typescript
   {
     allowedFilePatterns: ['/workspace/src/**'],
     deniedFilePatterns: ['/workspace/secrets/**']
   }
   ```

### 检查点保存

1. **在关键步骤保存**
   ```typescript
   // 在每个步骤完成后保存检查点
   await checkpointManager.saveCheckpoint(taskId, {
     currentStep: step.id,
     progress: calculateProgress(step),
     data: taskData
   });
   ```

2. **设置合理的清理策略**
   ```typescript
   const manager = new CheckpointManager(workspace, {
     maxCheckpoints: 10,
     maxVersionsPerCheckpoint: 5
   });
   ```

---

## 10. 文档

- [规范文档](./spec.md)
- [任务清单](./tasks.md)
- [验收清单](./checklist.md)
- [完成总结](./OPTIMIZATION_COMPLETED.md)

---

**最后更新**: 2026-03-22
**版本**: 1.0
