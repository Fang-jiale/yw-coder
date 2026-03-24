# ywcoder 智能体系统 - 完整使用指南

## 📖 目录

1. [快速开始](#快速开始)
2. [智能体系统](#智能体系统)
3. [对话界面](#对话界面)
4. [API 参考](#api-参考)
5. [最佳实践](#最佳实践)
6. [性能优化](#性能优化)
7. [测试指南](#测试指南)

---

## 1. 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

### 运行测试

```bash
# 运行所有测试
npm test

# 运行特定测试文件
npm test -- AgentIntegration.test.ts

# 运行性能测试
npm run test:performance
```

### 构建项目

```bash
npm run build
```

---

## 2. 智能体系统

### 2.1 状态机

状态机管理 Agent 的生命周期。

```typescript
import { AgentStateMachine } from '@/main/agent/core';

// 创建状态机
const stateMachine = new AgentStateMachine({
  taskId: 'task-123',
});

// 执行状态转换
stateMachine.transition({ type: 'START' });
console.log(stateMachine.getState()); // 'initializing'

// 订阅状态变化
const unsubscribe = stateMachine.subscribe((state, event) => {
  console.log(`State: ${state}, Event: ${event}`);
});

// 获取状态历史
const history = stateMachine.getHistory();
```

### 2.2 上下文管理

管理 Agent 执行过程中的上下文信息。

```typescript
import { AgentContextManager } from '@/main/agent/core';

// 创建上下文管理器
const contextManager = new AgentContextManager({
  taskId: 'task-123',
  workspacePath: '/workspace/project',
  taskTitle: 'Build React App',
  taskDescription: 'Create a new React application'
});

// 设置项目信息
contextManager.setProjectInfo('React', ['React', 'TypeScript'], ['react', 'react-dom']);

// 添加分析文件
contextManager.addAnalyzedFile({
  path: 'src/App.tsx',
  purpose: 'Main application component',
  dependencies: ['react'],
  exports: ['default App']
});

// 验证上下文
const validation = contextManager.validate();
if (!validation.isValid) {
  console.error('Validation errors:', validation.errors);
}
```

### 2.3 策略模式

三种 Agent 模式：Chat、Builder、Solo。

```typescript
import { createStrategy, getAvailableStrategies } from '@/main/agent/strategies';

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

// 准备上下文
const context = {
  task: {
    id: 'task-123',
    messages: [{ id: '1', role: 'user', content: 'Build a todo app', timestamp: Date.now() }]
  },
  context: contextManager.getContext(),
  callbacks: {
    onProgress: (message) => console.log(message),
    onStepStart: (step) => console.log('Step:', step.description),
    onStepComplete: (step) => console.log('Completed:', step.description),
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
console.log(result.success ? 'Success!' : 'Failed:', result.error);
```

### 2.4 工具注册表

管理 Agent 可用的工具。

```typescript
import { ToolRegistry } from '@/main/agent/tools';

// 创建注册表
const registry = new ToolRegistry();

// 注册工具
registry.register({
  name: 'read_file',
  execute: async (params) => {
    const content = await fs.readFile(params.path);
    return { success: true, data: content };
  },
  metadata: {
    name: 'read_file',
    description: 'Read file contents',
    category: 'file',
    parameters: [
      { name: 'path', type: 'string', required: true }
    ]
  }
});

// 执行工具
const result = await registry.execute('read_file', { path: '/workspace/test.txt' });
console.log(result.success ? result.data : result.error);

// 搜索工具
const results = registry.searchTools('read');
console.log(results.map(r => r.name)); // ['read_file', ...]
```

### 2.5 权限管理

控制工具调用的权限。

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

if (!result.allowed) {
  console.error('Permission denied:', result.reason);
  return;
}

if (result.requiresConfirmation) {
  const approved = await permissionManager.requestConfirmation('write_file', params);
  if (!approved) {
    console.error('User denied permission');
    return;
  }
}

// 设置自定义权限
permissionManager.setPermission({
  toolName: 'custom_tool',
  allowed: true,
  maxCallsPerTask: 10,
  allowedFilePatterns: ['/workspace/src/**']
});
```

### 2.6 检查点管理

保存和恢复任务状态。

```typescript
import { CheckpointManager } from '@/main/agent/checkpoint';

// 创建检查点管理器
const checkpointManager = new CheckpointManager('/workspace/project', {
  maxCheckpoints: 10,
  maxVersionsPerCheckpoint: 5
});

// 保存检查点
const checkpoint = await checkpointManager.saveCheckpoint('task-123', {
  taskData: { /* ... */ },
  progress: 50
});

// 加载检查点
const latest = await checkpointManager.loadCheckpoint('task-123');
const v2 = await checkpointManager.loadCheckpoint('task-123', 2);

// 列出所有检查点
const checkpoints = await checkpointManager.listCheckpoints('task-123');
console.log(checkpoints.map(c => `v${c.version}`)); // ['v1', 'v2', 'v3']
```

### 2.7 错误恢复

自动处理和恢复错误。

```typescript
import { ErrorRecoveryManager } from '@/main/agent/error';

// 创建错误恢复管理器
const errorManager = new ErrorRecoveryManager();

// 分类错误
const classified = errorManager.classifyError(new Error('Network timeout'));
console.log(classified);
// {
//   category: 'network',
//   severity: 'medium',
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
if (result.shouldRetry) {
  console.log('Retrying...');
}
```

---

## 3. 对话界面

### 3.1 组件使用

```typescript
import {
  ChatHeader,
  MessageList,
  MessageItem,
  MessageInput,
  SlashCommandMenu,
  ProcessingIndicator,
  ErrorBanner,
} from '@/components/Chat/components';

// 使用组件
function ChatPage() {
  return (
    <div className="h-full flex flex-col">
      <ChatHeader
        title="AI 助手"
        subtitle="基于 AI 的智能编程助手"
      />

      <ProcessingIndicator
        isProcessing={isProcessing}
        elapsedTime={elapsedTime}
      />

      <MessageList items={messages} renderItem={renderMessage} />

      <ErrorBanner error={error} onClose={() => setError(null)} />

      <MessageInput
        value={input}
        onChange={setInput}
        onSend={handleSend}
        isProcessing={isProcessing}
      />
    </div>
  );
}
```

### 3.2 Hooks 使用

#### useStreaming

处理流式消息。

```typescript
import { useStreaming } from '@/components/Chat/hooks';

function StreamingComponent() {
  const {
    content,
    thinking,
    isStreaming,
    toolCalls,
    appendContent,
    appendThinking,
    startToolCall,
    completeToolCall,
    reset,
    complete,
  } = useStreaming({
    onComplete: () => console.log('Streaming completed'),
    throttleMs: 60,
  });

  return (
    <div>
      {thinking && <ThinkingBlock thinking={thinking} />}
      <MarkdownRenderer content={content} />
      {toolCalls.map(tc => <ToolCallCard toolCall={tc} />)}
    </div>
  );
}
```

#### useMessageActions

管理消息操作。

```typescript
import { useMessageActions } from '@/components/Chat/hooks';

function MessageActions() {
  const {
    copiedMessageId,
    editingMessageId,
    editContent,
    copyMessage,
    startEditing,
    confirmEdit,
    cancelEdit,
    deleteMessage,
    retryMessage,
    quoteMessage,
  } = useMessageActions({
    onEdit: (id, content) => console.log('Edit:', id, content),
    onDelete: (id) => console.log('Delete:', id),
  });

  return (
    <div>
      <button onClick={() => copyMessage('msg-1', 'Content')}>Copy</button>
      <button onClick={() => startEditing('msg-1', 'Content')}>Edit</button>
      <button onClick={() => deleteMessage('msg-1')}>Delete</button>
    </div>
  );
}
```

### 3.3 消息解析

```typescript
import { parseMessage, formatTimestamp } from '@/components/Chat/utils/messageParser';

// 解析消息
const parsed = parseMessage(`
  <think>Analyzing...</think>

  <todo>
    <task status="pending">Task 1</task>
    <task status="in_progress">Task 2</task>
  </todo>

  Here is the solution:

  \`\`\`javascript
  const x = 1;
  \`\`\`
`);

console.log(parsed.thinking); // 'Analyzing...'
console.log(parsed.todoItems); // [{ id: ..., content: 'Task 1', status: 'pending' }, ...]
console.log(parsed.codeBlocks); // [{ language: 'javascript', code: 'const x = 1;', ... }]

// 格式化时间戳
const formatted = formatTimestamp(Date.now());
console.log(formatted); // '14:30'
```

---

## 4. API 参考

### 4.1 Agent 核心 API

#### AgentStateMachine

```typescript
class AgentStateMachine {
  constructor(initialContext?: Partial<AgentContext>);

  getState(): AgentState;
  getContext(): AgentContext;
  getHistory(): StateHistoryEntry[];

  canTransition(event: string): boolean;
  transition(event: AgentEvent): AgentState;

  subscribe(listener: (state: AgentState, event: string) => void): () => void;

  reset(): void;
  isFinalState(): boolean;
  isRunning(): boolean;

  getAvailableEvents(): string[];
  getStateMetadata(): StateMetadata;

  serialize(): string;
  static deserialize(data: string): AgentStateMachine;
}
```

#### AgentContextManager

```typescript
class AgentContextManager {
  constructor(initialContext: Partial<AgentContextData>);

  getContext(): AgentContextData;
  updateContext(updates: Partial<AgentContextData>): void;

  setProjectInfo(projectType: string, techStack: string[], dependencies: string[]): void;
  setFiles(files: string[]): void;
  addAnalyzedFile(file: AnalyzedFile): void;
  addRequirement(requirement: Requirement): void;
  setMetadata(key: string, value: unknown): void;

  validate(): ContextValidationResult;
  toTaskContext(): TaskContext;
}
```

### 4.2 策略 API

```typescript
interface AgentStrategy {
  readonly type: StrategyType;
  readonly name: string;
  readonly description: string;

  validate(context: StrategyContext): { valid: boolean; errors: string[] };
  execute(context: StrategyContext): Promise<StrategyResult>;

  canPause(): boolean;
  canResume(): boolean;
  canStop(): boolean;

  getEstimatedSteps(): number;
  getPrompt(context: StrategyContext): string;
}
```

### 4.3 工具 API

```typescript
class ToolRegistry {
  register(tool: Tool): void;
  unregister(toolName: string): boolean;
  get(toolName: string): Tool | undefined;
  has(toolName: string): boolean;

  listTools(): string[];
  listToolsByCategory(category: string): string[];
  searchTools(query: string): ToolMetadata[];

  execute(toolName: string, params: Record<string, any>): Promise<ToolResult>;
  getStats(): RegistryStats;
}

class ToolPermissionManager {
  checkPermission(context: ToolCallContext): PermissionCheckResult;
  requestConfirmation(toolName: string, params: any): Promise<boolean>;
  setPermission(permission: ToolPermission): void;
  getPermission(toolName: string): ToolPermission | undefined;
}
```

---

## 5. 最佳实践

### 5.1 状态机使用

```typescript
// ✅ 好的做法：始终验证状态转换
if (stateMachine.canTransition('PAUSE')) {
  stateMachine.transition({ type: 'PAUSE' });
}

// ✅ 订阅状态变化
const unsubscribe = stateMachine.subscribe((state, event) => {
  analytics.track('state_change', { state, event });
});

// ❌ 避免：跳过状态验证
stateMachine.transition({ type: 'PAUSE' }); // 可能失败
```

### 5.2 策略选择

```typescript
// ✅ 根据任务选择策略
const strategy = isSimpleTask ? 'chat' : 'builder';

// ✅ 验证后再执行
const validation = strategy.validate(context);
if (!validation.valid) {
  showValidationErrors(validation.errors);
  return;
}
```

### 5.3 工具权限

```typescript
// ✅ 好的做法：设置合理的权限
permissionManager.setPermission({
  toolName: 'execute_command',
  allowed: false,
  requiresConfirmation: true,
  allowedCommands: ['npm install', 'npm run'],
  deniedCommands: ['rm -rf', 'sudo']
});

// ✅ 好的做法：限制调用次数
permissionManager.setPermission({
  toolName: 'web_search',
  allowed: true,
  maxCallsPerTask: 20
});
```

### 5.4 检查点保存

```typescript
// ✅ 在关键步骤保存检查点
await checkpointManager.saveCheckpoint(taskId, {
  currentStep: step.id,
  progress: calculateProgress(),
  data: taskData
});

// ✅ 自动清理旧检查点
await checkpointManager.cleanupOldCheckpoints(taskId);
```

---

## 6. 性能优化

### 6.1 渲染优化

```typescript
// ✅ 使用 React.memo
const MessageItem = React.memo(({ message }) => (
  <div>{message.content}</div>
));

// ✅ 使用 useMemo
const parsed = useMemo(() => parseMessage(content), [content]);

// ✅ 使用 useCallback
const handleClick = useCallback(() => {
  doSomething();
}, []);
```

### 6.2 流式内容优化

```typescript
// ✅ 使用节流
const { appendContent } = useStreaming({
  throttleMs: 60 // 60ms 节流
});

// ✅ 增量更新
contentRef.current += newContent;
appendContent(contentRef.current);
```

### 6.3 列表优化

```typescript
// ✅ 使用虚拟滚动
<FixedSizeList
  height={400}
  itemCount={messages.length}
  itemSize={80}
>
  {({ index, style }) => (
    <div style={style}>
      <MessageItem message={messages[index]} />
    </div>
  )}
</FixedSizeList>
```

---

## 7. 测试指南

### 7.1 运行测试

```bash
# 运行所有测试
npm test

# 运行特定测试
npm test -- AgentIntegration.test.ts

# 运行带覆盖率
npm test -- --coverage

# 运行性能测试
npm run test:performance
```

### 7.2 编写测试

```typescript
// 测试状态机
describe('AgentStateMachine', () => {
  it('应该正确转换状态', () => {
    const machine = new AgentStateMachine();
    machine.transition({ type: 'START' });
    expect(machine.getState()).toBe('initializing');
  });
});

// 测试 Hooks
describe('useStreaming', () => {
  it('应该追加内容', () => {
    const { result } = renderHook(() => useStreaming());
    act(() => {
      result.current.appendContent('Hello');
    });
    expect(result.current.content).toBe('Hello');
  });
});
```

### 7.3 性能基准

```typescript
// 渲染性能
it('应该在16ms内渲染', () => {
  const start = performance.now();
  render(<Component />);
  const duration = performance.now() - start;
  expect(duration).toBeLessThan(16);
});
```

---

## 📚 相关文档

- [规范文档](./spec.md)
- [任务清单](./tasks.md)
- [验收清单](./checklist.md)
- [快速参考](./QUICK_REFERENCE.md)
- [性能指南](./PERFORMANCE_GUIDE.md)
- [项目总结](./PROJECT_COMPLETE_SUMMARY.md)

---

**最后更新**: 2026-03-22
**版本**: 2.0
