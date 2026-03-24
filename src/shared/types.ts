export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  isOpen?: boolean;
}

export interface OpenFile {
  path: string;
  name: string;
  content: string;
  isModified: boolean;
  language: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;
  attachments?: string[];
  toolCalls?: ToolCall[];
  toolCallId?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

export interface ToolResult {
  toolCallId: string;
  role: 'tool';
  content: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  mode: 'chat' | 'builder' | 'solocoder';
  provider?: string;
  model?: string;
  agentId?: string;
  configId?: string;
}

export interface AIRequest {
  messages: ChatMessage[];
  model: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface AIResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface CodeCompletionRequest {
  code: string;
  language: string;
  position: {
    line: number;
    column: number;
  };
  filePath: string;
  context?: string;
}

export interface TerminalSession {
  id: string;
  name: string;
  cwd: string;
}

export type ApiFormat = 'openai' | 'anthropic';

export interface AIProviderConfig {
  id: string;
  name: string;
  provider: string;
  apiKey: string;
  baseUrl?: string;
  model: string;
  groupId?: string;
  isDefault?: boolean;
  contextLength?: number;
  supportsFunctionCall?: boolean;
  maxTokens?: number;
  apiFormat?: ApiFormat;
}

export interface Settings {
  theme: 'light' | 'dark' | 'system';
  fontSize: number;
  fontFamily: string;
  tabSize: number;
  wordWrap: boolean;
  minimap: boolean;
  aiProvider?: string;
  aiModel?: string;
  aiApiKey?: string;
  aiBaseUrl?: string;
  aiGroupId?: string;
  aiConfigs?: AIProviderConfig[];
  activeConfigId?: string;
  language: string;
}

export interface GeneratedFile {
  path: string;
  content: string;
  language: string;
  status?: 'pending' | 'completed' | 'failed';
}

export interface BuilderStep {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  type: 'analysis' | 'planning' | 'coding' | 'testing' | 'deployment';
  result?: string;
}

export interface BuilderTask {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  steps: BuilderStep[];
  currentStep: number;
  generatedFiles?: GeneratedFile[];
}

export interface TodoItem {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  priority?: 'high' | 'medium' | 'low';
  createdAt: number;
  updatedAt: number;
}

export interface AgentQuestion {
  id: string;
  question: string;
  context?: string;
  status: 'pending' | 'answered';
  answer?: string;
  createdAt: number;
  answeredAt?: number;
  options?: Array<{
    id: string;
    label: string;
    value: string;
  }>;
}

export interface SearchResult {
  path: string;
  matches: Array<{
    line: number;
    content: string;
  }>;
}

export const IPC_CHANNELS = {
  FILE_READ: 'file:read',
  FILE_WRITE: 'file:write',
  FILE_DELETE: 'file:delete',
  FILE_RENAME: 'file:rename',
  FILE_CREATE: 'file:create',
  FILE_WATCH: 'file:watch',
  FILE_GET_TREE: 'file:get-tree',
  
  AI_CHAT: 'ai:chat',
  AI_STREAM: 'ai:stream',
  AI_COMPLETE: 'ai:complete',
  AI_CANCEL: 'ai:cancel',
  AI_TEST_CONNECTION: 'ai:test-connection',
  AI_GET_PROVIDERS: 'ai:get-providers',
  AI_GET_CONFIGS: 'ai:get-configs',
  AI_SAVE_CONFIG: 'ai:save-config',
  AI_DELETE_CONFIG: 'ai:delete-config',
  AI_SET_ACTIVE_CONFIG: 'ai:set-active-config',
  
  TERMINAL_CREATE: 'terminal:create',
  TERMINAL_WRITE: 'terminal:write',
  TERMINAL_RESIZE: 'terminal:resize',
  TERMINAL_DATA: 'terminal:data',
  TERMINAL_EXIT: 'terminal:exit',
  TERMINAL_KILL: 'terminal:kill',
  
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  
  APP_GET_VERSION: 'app:get-version',
  APP_SHOW_OPEN_DIALOG: 'app:show-open-dialog',
  APP_SHOW_SAVE_DIALOG: 'app:show-save-dialog',
  APP_OPEN_EXTERNAL: 'app:open-external',
  
  BUILDER_START: 'builder:start',
  BUILDER_CANCEL: 'builder:cancel',
  BUILDER_STATUS: 'builder:status',
  
  AGENT_CREATE: 'agent:create',
  AGENT_START: 'agent:start',
  AGENT_PAUSE: 'agent:pause',
  AGENT_RESUME: 'agent:resume',
  AGENT_STOP: 'agent:stop',
  AGENT_GET_STATUS: 'agent:get-status',
  AGENT_GET_ALL: 'agent:get-all',
  AGENT_DELETE: 'agent:delete',

  AGENT_EVENT_MODE_CHANGE: 'agent:event:mode-change',
  AGENT_EVENT_STEP_START: 'agent:event:step-start',
  AGENT_EVENT_STEP_COMPLETE: 'agent:event:step-complete',
  AGENT_EVENT_STEP_FAIL: 'agent:event:step-fail',
  AGENT_EVENT_MESSAGE: 'agent:event:message',
  AGENT_EVENT_THINKING: 'agent:event:thinking',
  AGENT_EVENT_TOOL_CALL: 'agent:event:tool-call',
  AGENT_EVENT_TOOL_RESULT: 'agent:event:tool-result',
  AGENT_EVENT_STATUS_CHANGE: 'agent:event:status-change',
  AGENT_EVENT_ERROR: 'agent:event:error',
  AGENT_EVENT_COMPLETE: 'agent:event:complete',

  SOLO_CREATE: 'solo:create',
  SOLO_START: 'solo:start',
  SOLO_PAUSE: 'solo:pause',
  SOLO_RESUME: 'solo:resume',
  SOLO_STOP: 'solo:stop',
  SOLO_DELETE: 'solo:delete',
  SOLO_GET_ALL: 'solo:get-all',
  SOLO_GET: 'solo:get',
  SOLO_ANSWER: 'solo:answer',

  SOLO_STEP_START: 'solo:event:step-start',
  SOLO_STEP_COMPLETE: 'solo:event:step-complete',
  SOLO_STEP_FAIL: 'solo:event:step-fail',
  SOLO_THINKING: 'solo:event:thinking',
  SOLO_TOOL_CALL: 'solo:event:tool-call',
  SOLO_TOOL_RESULT: 'solo:event:tool-result',
  SOLO_TODO_UPDATE: 'solo:event:todo-update',
  SOLO_PROGRESS: 'solo:event:progress',
  SOLO_ERROR: 'solo:event:error',
  SOLO_COMPLETE: 'solo:event:complete',
  SOLO_QUESTION: 'solo:event:question',

  CODE_REWRITE: 'code:rewrite',
  CODE_REFACTOR: 'code:refactor',

  UNIFIED_EVENT_PLAN_GENERATED: 'agent:event:plan-generated',
  UNIFIED_EVENT_PROGRESS_UPDATE: 'agent:event:progress-update',
} as const;

export type AgentType = 'chat' | 'builder' | 'solocoder';

export interface AgentBehaviorConfig {
  autoExecuteTools: boolean;
  askBeforeExecute: boolean;
  autoFixErrors: boolean;
  maxAutoRetries: number;
  showThinking: boolean;
  enableTodoList: boolean;
  enableDiffPreview: boolean;
  commandWhitelist: string[];
}

export interface AgentCapabilityConfig {
  enabledTools: string[];
  maxContextMessages: number;
  canEditFiles: boolean;
  canExecuteCommands: boolean;
  canRefactorCode: boolean;
}

export interface AgentConfig {
  id: string;
  name: string;
  type: AgentType;
  description: string;
  aiConfig: AIProviderConfig;
  behavior: AgentBehaviorConfig;
  capabilities: AgentCapabilityConfig;
  systemPrompt: string;
  isBuiltIn: boolean;
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface AgentStep {
  id: string;
  type: 'analysis' | 'planning' | 'coding' | 'testing' | 'review' | 'verification' | 'deployment';
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: string;
  details?: string;
  startTime?: number;
  endTime?: number;
}

export interface AgentToolCall {
  id: string;
  toolName: string;
  params: Record<string, any>;
  status: 'running' | 'completed' | 'error';
  result?: any;
  error?: string;
  timestamp?: number;
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  thinking?: string;
  toolCalls?: AgentToolCall[];
  agentQuestions?: AgentQuestion[];
  contentBlocks?: Array<{ type: 'text' | 'thinking' | 'question' | 'todo'; content?: string; thinking?: string; question?: AgentQuestion; todoItems?: TodoItem[]; timestamp: number }>;
  // 执行计划（用于 SoloCoder 模式，在消息中展示）
  executionPlan?: ExecutionPlan;
  // 上下文压缩相关
  isCompacted?: boolean;
  compactedSummary?: string;
  originalContent?: string; // 压缩前的原始内容
  compactedAt?: number; // 压缩时间戳
}

export interface AgentTask {
  id: string;
  title: string;
  description: string;
  agentId: string;
  configId: string;
  agentType: AgentType;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  workspacePath: string;
  steps: AgentStep[];
  currentStepIndex: number;
  messages: AgentMessage[];
  todoItems: TodoItem[];
  generatedFiles: GeneratedFile[];
  errors: Array<{
    stepId: string;
    message: string;
    fixAttempted: boolean;
    fixed: boolean;
    timestamp: number;
    severity: 'error' | 'warning' | 'info';
  }>;
  context: {
    projectType?: string;
    techStack?: string[];
    dependencies?: string[];
    files?: string[];
  };
  createdAt: number;
  updatedAt: number;
  metadata: {
    totalFilesGenerated: number;
    totalCommandsExecuted: number;
    estimatedTokensUsed: number;
    startTime?: number;
    endTime?: number;
    duration?: number;
  };
  executionPlan?: ExecutionPlan;
  executionProgress?: number;
}

export interface ExecutionPlanStep {
  id: string;
  name: string;
  description: string;
  type: 'analysis' | 'planning' | 'coding' | 'testing' | 'review' | 'documentation' | 'custom';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  reasoning?: string;
  estimatedTime?: number;
  dependencies?: string[];
  tools?: string[];
  startTime?: number;
  endTime?: number;
  result?: any;
  error?: string;
}

export interface ExecutionPlan {
  id: string;
  goal: string;
  steps: ExecutionPlanStep[];
  currentStepIndex: number;
  totalEstimatedTime?: number;
  reasoning?: string;
  createdAt: number;
  updatedAt: number;
}

export interface AgentContext {
  projectType?: string;
  techStack?: string[];
  dependencies?: string[];
  files?: string[];
  analyzedFiles?: Array<{
    path: string;
    purpose: string;
    dependencies: string[];
    exports: string[];
  }>;
  requirements?: Array<{
    id: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    status: 'pending' | 'completed';
  }>;
}

export interface AnalyzedFile {
  path: string;
  purpose: string;
  dependencies: string[];
  exports: string[];
  content?: string;
}

export interface Requirement {
  id: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'completed';
}

export interface AgentCallbacks {
  onMessage?: (message: string | AgentMessage) => void;
  onThinking?: (thinking: string) => void;
  onToolCall?: (toolCall: AgentToolCall) => void;
  onToolResult?: (toolCallId: string, result?: any) => void;
  onStepStart?: (step: AgentStep) => void;
  onStepComplete?: (step: AgentStep) => void;
  onStepFail?: (step: AgentStep, error: string) => void;
  onStatusChange?: (status: AgentTask['status']) => void;
  onError?: (error: string) => void;
  onComplete?: () => void;
  onTodoUpdate?: (items: TodoItem[]) => void;
  onPlanGenerated?: (plan: ExecutionPlan) => void;
  onProgress?: (message: string) => void;
  onStreamContent?: (content: string) => void;
  onQuestion?: (question: AgentQuestion) => void;
  onContextUpdate?: (context: AgentContext) => void;
}

export interface AgentError {
  stepId: string;
  message: string;
  fixAttempted: boolean;
  fixed: boolean;
  timestamp: number;
  severity: 'error' | 'warning' | 'info';
}

export const DEFAULT_BEHAVIOR_CONFIG: AgentBehaviorConfig = {
  autoExecuteTools: false,
  askBeforeExecute: true,
  autoFixErrors: false,
  maxAutoRetries: 3,
  showThinking: true,
  enableTodoList: true,
  enableDiffPreview: true,
  commandWhitelist: ['npm install', 'npm run build', 'npm test', 'pip install'],
};

export const DEFAULT_CAPABILITY_CONFIG: AgentCapabilityConfig = {
  enabledTools: ['read_file', 'write_file', 'edit_file', 'list_files', 'search', 'terminal'],
  maxContextMessages: 20,
  canEditFiles: true,
  canExecuteCommands: true,
  canRefactorCode: true,
};

export const BUILT_IN_AGENTS = {
  chat: {
    type: 'chat' as AgentType,
    name: '对话助手',
    description: '智能对话助手，回答问题、解释代码、辅助编程',
    behavior: {
      autoExecuteTools: false,
      askBeforeExecute: true,
      autoFixErrors: false,
      maxAutoRetries: 0,
      showThinking: true,
      enableTodoList: false,
      enableDiffPreview: true,
      commandWhitelist: [],
    },
    capabilities: {
      enabledTools: ['read_file', 'search', 'list_files'],
      maxContextMessages: 15,
      canEditFiles: false,
      canExecuteCommands: false,
      canRefactorCode: false,
    },
    systemPrompt: `你是专业的智能编程助手，专注于代码分析和问答。

核心能力：
1. 代码分析与解释
2. 编程问题解答
3. 技术方案建议
4. 调试问题定位

工作原则：
- 回答要精准、专业、简洁
- 代码示例要完整、可运行
- 适当使用 Markdown 格式化
- 复杂问题分步骤解释
- 主动追问以获得更多信息

限制：
- 不直接修改文件
- 不执行命令
- 只提供建议和方案

输出格式：
- 代码块使用适当的语言标注
- 复杂概念配合图示说明
- 重要结论用表格或列表总结`,
  },
  builder: {
    type: 'builder' as AgentType,
    name: '代码构建器',
    description: '计划-执行-审查循环，帮你构建和重构项目',
    behavior: {
      autoExecuteTools: false,
      askBeforeExecute: true,
      autoFixErrors: true,
      maxAutoRetries: 3,
      showThinking: true,
      enableTodoList: true,
      enableDiffPreview: true,
      commandWhitelist: ['npm install', 'npm run build', 'npm test', 'pip install', 'npm run dev', 'pnpm install', 'yarn install'],
    },
    capabilities: {
      enabledTools: ['read_file', 'write_file', 'edit_file', 'list_files', 'search', 'terminal', 'glob'],
      maxContextMessages: 25,
      canEditFiles: true,
      canExecuteCommands: true,
      canRefactorCode: true,
    },
    systemPrompt: `你是一个结构化的代码构建智能体，采用计划-执行-审查的工作模式。

工作流程：
1. 需求分析 (Analysis)
   - 理解用户需求
   - 分析项目现有结构
   - 确定技术栈和依赖

2. 计划制定 (Planning)
   - 拆解任务为具体步骤
   - 确定文件变更清单
   - 评估风险和依赖

3. 代码执行 (Implementation)
   - 按照计划逐步实现
   - 使用工具完成文件操作
   - 保持代码风格一致

4. 审查验证 (Review)
   - 检查代码质量
   - 验证功能完整性
   - 确保无语法错误

执行原则：
- 每次重大修改前先展示变更计划
- 优先修改关键文件
- 保持向后兼容
- 及时报告进度

错误处理：
- 遇到错误先分析原因
- 尝试自动修复
- 必要时回滚操作
- 向用户报告问题`,
  },
  solocoder: {
    type: 'solocoder' as AgentType,
    name: 'Solo Coder',
    description: '自主开发智能体，从需求到部署独立完成任务',
    behavior: {
      autoExecuteTools: true,
      askBeforeExecute: false,
      autoFixErrors: true,
      maxAutoRetries: 5,
      showThinking: true,
      enableTodoList: true,
      enableDiffPreview: true,
      commandWhitelist: ['npm install', 'npm run build', 'npm test', 'npm run dev', 'pip install', 'python', 'git', 'pnpm', 'yarn', 'make', 'docker'],
    },
    capabilities: {
      enabledTools: ['read_file', 'write_file', 'edit_file', 'list_files', 'search', 'terminal', 'execute', 'glob'],
      maxContextMessages: 40,
      canEditFiles: true,
      canExecuteCommands: true,
      canRefactorCode: true,
    },
    systemPrompt: `你是 Solo Coder，一个高度自主的 AI 开发者智能体，能够端到端完成软件开发任务。

自主能力：
- 独立分析和理解需求
- 自主制定和执行开发计划
- 自动处理代码编写和调试
- 主动识别和解决问题

工作模式：
1. 深度分析
   - 理解项目背景和技术栈
   - 分析需求的技术可行性
   - 确定最佳实现方案

2. 智能规划
   - 创建清晰的任务列表
   - 规划文件结构和变更
   - 预估时间和风险

3. 高效执行
   - 批量生成相关文件
   - 自动安装依赖和配置
   - 持续验证和测试

4. 质量保证
   - 遵循代码规范
   - 自动化测试覆盖
   - 性能优化检查

执行风格：
- 主动出击，不需要等待指令
- 定期更新进度（每完成一个重要步骤）
- 遇到问题先尝试解决，无法解决时及时上报
- 重要决策需要用户确认

错误恢复：
- 自动重试失败的步骤
- 记录错误日志便于分析
- 提供清晰的错误报告
- 必要时寻求用户帮助`,
  },
};

export type BuiltInAgentType = keyof typeof BUILT_IN_AGENTS;

export function createAgentConfig(
  type: AgentType,
  aiConfig: AIProviderConfig,
  customName?: string,
  isBuiltIn: boolean = false
): AgentConfig {
  const now = Date.now();
  const template = BUILT_IN_AGENTS[type as BuiltInAgentType] || BUILT_IN_AGENTS.chat;

  return {
    id: `agent-${now}-${Math.random().toString(36).substr(2, 9)}`,
    name: customName || template.name,
    type,
    description: template.description,
    aiConfig,
    behavior: { ...DEFAULT_BEHAVIOR_CONFIG, ...template.behavior },
    capabilities: { ...DEFAULT_CAPABILITY_CONFIG, ...template.capabilities },
    systemPrompt: template.systemPrompt,
    isBuiltIn,
    isDefault: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function getBuiltInAgents(aiConfig: AIProviderConfig): AgentConfig[] {
  return Object.entries(BUILT_IN_AGENTS).map(([type, template]) => {
    return createAgentConfig(type as AgentType, aiConfig, template.name, true);
  });
}

export type { AgentConfig as UnifiedAgentConfig };
export type { AgentTask as UnifiedAgentTask };
export type { AgentMessage as UnifiedAgentMessage };
