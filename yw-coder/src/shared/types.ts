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
  mode: 'chat' | 'builder' | 'agent';
  provider?: string;
  model?: string;
  agentMode?: 'plan' | 'build' | 'review' | 'explain' | null;
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

// API 格式类型
export type ApiFormat = 'openai' | 'anthropic';

// AI Provider Configuration - 新的多配置系统
export interface AIProviderConfig {
  id: string;
  name: string;
  provider: string;
  apiKey: string;
  baseUrl?: string;
  model: string;
  groupId?: string;
  isDefault?: boolean;
  // 模型能力配置
  contextLength?: number; // 上下文长度，默认 4000
  supportsFunctionCall?: boolean; // 是否支持 Function Call，自动检测
  maxTokens?: number; // 最大生成 token 数
  // API 格式配置
  apiFormat?: ApiFormat; // API 格式：openai 或 anthropic，默认 openai
}

export interface Settings {
  theme: 'light' | 'dark' | 'system';
  fontSize: number;
  fontFamily: string;
  tabSize: number;
  wordWrap: boolean;
  minimap: boolean;
  // 旧的单配置字段（向后兼容）
  aiProvider?: string;
  aiModel?: string;
  aiApiKey?: string;
  aiBaseUrl?: string;
  aiGroupId?: string;
  // 新的多配置系统
  aiConfigs?: AIProviderConfig[];
  activeConfigId?: string;
  language: string;
}

export interface GeneratedFile {
  path: string;
  content: string;
  language: string;
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

// 待办清单项
export interface TodoItem {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  createdAt: number;
  updatedAt: number;
}

// 智能体主动提问
export interface AgentQuestion {
  id: string;
  question: string;
  context?: string;
  status: 'pending' | 'answered';
  answer?: string;
  createdAt: number;
  answeredAt?: number;
  // 选择题选项
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
  // File operations
  FILE_READ: 'file:read',
  FILE_WRITE: 'file:write',
  FILE_DELETE: 'file:delete',
  FILE_RENAME: 'file:rename',
  FILE_CREATE: 'file:create',
  FILE_WATCH: 'file:watch',
  FILE_GET_TREE: 'file:get-tree',
  
  // AI operations
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
  
  // Terminal operations
  TERMINAL_CREATE: 'terminal:create',
  TERMINAL_WRITE: 'terminal:write',
  TERMINAL_RESIZE: 'terminal:resize',
  TERMINAL_DATA: 'terminal:data',
  TERMINAL_EXIT: 'terminal:exit',
  TERMINAL_KILL: 'terminal:kill',
  
  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  
  // App
  APP_GET_VERSION: 'app:get-version',
  APP_SHOW_OPEN_DIALOG: 'app:show-open-dialog',
  APP_SHOW_SAVE_DIALOG: 'app:show-save-dialog',
  APP_OPEN_EXTERNAL: 'app:open-external',
  
  // Builder
  BUILDER_START: 'builder:start',
  BUILDER_CANCEL: 'builder:cancel',
  BUILDER_STATUS: 'builder:status',
  
  // Agent
  AGENT_CREATE: 'agent:create',
  AGENT_START: 'agent:start',
  AGENT_PAUSE: 'agent:pause',
  AGENT_RESUME: 'agent:resume',
  AGENT_STOP: 'agent:stop',
  AGENT_GET_STATUS: 'agent:get-status',
  AGENT_GET_ALL: 'agent:get-all',
  AGENT_DELETE: 'agent:delete',

  // Agent Events
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

  // SOLO Agent Events
  SOLO_CREATE: 'solo:create',
  SOLO_START: 'solo:start',
  SOLO_PAUSE: 'solo:pause',
  SOLO_RESUME: 'solo:resume',
  SOLO_STOP: 'solo:stop',
  SOLO_DELETE: 'solo:delete',
  SOLO_GET_ALL: 'solo:get-all',
  SOLO_GET: 'solo:get',
  SOLO_ANSWER: 'solo:answer',

  // SOLO Event Channels
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

  // Code Rewrite
  CODE_REWRITE: 'code:rewrite',
  CODE_REFACTOR: 'code:refactor',

  // Dynamic Execution Plan Events
  UNIFIED_EVENT_PLAN_GENERATED: 'agent:event:plan-generated',
  UNIFIED_EVENT_PROGRESS_UPDATE: 'agent:event:progress-update',
} as const;
