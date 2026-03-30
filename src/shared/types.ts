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

// ==================== Stream Event Types ====================
// 流式事件驱动渲染架构 - 统一事件类型定义

/** 流式事件项基础接口 */
export interface StreamEventItemBase {
  id: string;
  seq: number;
  timestamp: number;
}

/** 内容事件 */
export interface ContentStreamEvent extends StreamEventItemBase {
  type: 'content';
  text: string;
}

/** 思考事件 */
export interface ThinkingStreamEvent extends StreamEventItemBase {
  type: 'thinking';
  text: string;
  done?: boolean;
}

/** 工具调用事件 */
export interface ToolStreamEvent extends StreamEventItemBase {
  type: 'tool';
  toolCallId: string;
  toolName: string;
  params: any;
  status: 'running' | 'completed' | 'error';
  result?: any;
  error?: string;
}

/** Todo 更新事件 */
export interface TodoStreamEvent extends StreamEventItemBase {
  type: 'todo';
  items: TodoItem[];
}

/** 智能体提问事件 */
export interface QuestionStreamEvent extends StreamEventItemBase {
  type: 'question';
  questionId: string;
  question: string;
  options?: Array<{
    id: string;
    label: string;
    value: string;
  }>;
  context?: string;
}

/** 统一的流式事件项类型 */
export type StreamEventItem =
  | ContentStreamEvent
  | ThinkingStreamEvent
  | ToolStreamEvent
  | TodoStreamEvent
  | QuestionStreamEvent;

export interface SearchResult {
  path: string;
  matches: Array<{
    line: number;
    content: string;
  }>;
}

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

export type ResultCardType = 'file_create' | 'file_edit' | 'file_delete' | 'command_execute' | 'env_check';

export interface ResultCard {
  id: string;
  type: ResultCardType;
  title: string;
  status: 'success' | 'error' | 'pending';
  description: string;
  timestamp: number;
}

export interface FileResultCard extends ResultCard {
  type: 'file_create' | 'file_edit' | 'file_delete';
  filePath: string;
  operation: 'create' | 'edit' | 'delete';
  newContent?: string;
  oldContent?: string;
}

export interface CommandResultCard extends ResultCard {
  type: 'command_execute';
  command: string;
  exitCode?: number;
  output?: string;
  outputSummary?: string;
}

export interface EnvCheckResultCard extends ResultCard {
  type: 'env_check';
  checkItem: string;
  detectedValue?: string;
  expectedValue?: string;
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

  // Stream Event for event-driven rendering
  AGENT_EVENT_STREAM_ITEM: 'agent:event:stream-item',
} as const;

// 消息解析辅助函数
export interface ParsedMessage {
  rawContent: string;
  visibleContent: string;
  thinkingContent: string;
  todoItems: string[];
  taskItems: string[];
}

const TAIL_TAG_PATTERNS = [
  /<thi$/i, /<thin$/i, /<think$/i,
  /<todo$/i, /<tod$/i, /<to$/i, /<t$/i,
  /<tas$/i, /<task$/i, /<tas$/i,
  /<\/thi$/i, /<\/think$/i,
  /<thi[^>]*$/i, /<todo[^>]*$/i, /<task[^>]*$/i,
];

function protectTailTags(content: string): string {
  for (const pattern of TAIL_TAG_PATTERNS) {
    if (pattern.test(content)) {
      const lastIndex = content.search(pattern);
      return content.slice(0, lastIndex);
    }
  }
  return content;
}

export function parseMessageContent(rawContent: string): ParsedMessage {
  let content = rawContent;
  let thinkingContent = '';
  let todoItems: string[] = [];
  let taskItems: string[] = [];

  // 检查是否存在未闭合的标签
  const hasUnclosedThink = /<think>[^<]*$/.test(content) && !content.includes('</think>');
  const hasUnclosedTodo = /<todo>[^<]*$/.test(content) && !content.includes('</todo>');
  const hasUnclosedTask = /<task[^>]*>[^<]*$/.test(content) && !content.includes('</task>');

  // 如果有未闭合标签，从该标签位置截断
  if (hasUnclosedThink || hasUnclosedTodo || hasUnclosedTask) {
    const thinkStart = content.lastIndexOf('<think>');
    const todoStart = content.lastIndexOf('<todo>');
    const taskStart = content.lastIndexOf('<task');

    let truncatePos = content.length;
    if (hasUnclosedThink && thinkStart > -1) {
      truncatePos = Math.min(truncatePos, thinkStart);
    }
    if (hasUnclosedTodo && todoStart > -1) {
      truncatePos = Math.min(truncatePos, todoStart);
    }
    if (hasUnclosedTask && taskStart > -1) {
      truncatePos = Math.min(truncatePos, taskStart);
    }
    content = content.slice(0, truncatePos);
  }

  // 提取思考内容（完整闭合标签）
  const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/);
  if (thinkMatch) {
    thinkingContent = thinkMatch[1].trim();
    content = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  }

  // 提取 todo 标签
  const todoRegex = /<todo>([\s\S]*?)<\/todo>/g;
  let todoMatch;
  while ((todoMatch = todoRegex.exec(content)) !== null) {
    todoItems.push(todoMatch[1].trim());
  }
  content = content.replace(/<todo>[\s\S]*?<\/todo>/g, '').trim();

  // 提取 task 标签
  const taskRegex = /<task[^>]*>([\s\S]*?)<\/task>/g;
  let taskMatch;
  while ((taskMatch = taskRegex.exec(content)) !== null) {
    taskItems.push(taskMatch[1].trim());
  }
  content = content.replace(/<task[^>]*>[\s\S]*?<\/task>/g, '').trim();

  // 尾部半截标签保护
  content = protectTailTags(content);

  return {
    rawContent,
    visibleContent: content.trim(),
    thinkingContent,
    todoItems,
    taskItems,
  };
}

export function removeSpecialTags(content: string): string {
  return content
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/<todo>[\s\S]*?<\/todo>/g, '')
    .replace(/<task[^>]*>[\s\S]*?<\/task>/g, '')
    .trim();
}

export type ContextMode = 'conservative';

export interface ModelCapability {
  modelId: string;
  maxContextWindow: number;
}

export interface ContextPolicy {
  defaultBudget: number;
  maxAllowedBudget: number;
  mode: ContextMode;
}

export interface UserContextPreference {
  preferredBudget?: number;
  mode?: ContextMode;
}

export function getEffectiveContextBudget(
  userPreference: UserContextPreference,
  contextPolicy: ContextPolicy,
  modelCapability: ModelCapability
): number {
  return Math.min(
    userPreference.preferredBudget ?? contextPolicy.defaultBudget,
    contextPolicy.maxAllowedBudget,
    modelCapability.maxContextWindow
  );
}
