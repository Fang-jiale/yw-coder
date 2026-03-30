/**
 * 统一 Agent 类型定义
 * 整合普通对话、SOLO模式和Agent模式
 */

import { AIProviderConfig, StreamEventItem } from './types';

/**
 * Agent 运行模式
 */
export type AgentRuntimeMode =
  | 'chat'      // 普通对话模式 - 简单的问答和代码生成
  | 'agent'     // Agent模式 - Plan-Build-Review循环
  | 'solo';     // SOLO模式 - 全流程自动化开发

/**
 * Agent 行为配置
 */
export interface AgentBehaviorConfig {
  // 是否自动执行工具调用
  autoExecuteTools: boolean;
  // 是否在执行前询问用户确认
  askBeforeExecute: boolean;
  // 是否自动修复错误
  autoFixErrors: boolean;
  // 最大自动重试次数
  maxAutoRetries: number;
  // 是否启用思考过程显示
  showThinking: boolean;
  // 是否启用待办清单
  enableTodoList: boolean;
  // 是否启用文件变更预览
  enableDiffPreview: boolean;
  // 命令白名单（自动执行允许的命令）
  commandWhitelist: string[];
}

/**
 * Agent 能力配置
 */
export interface AgentCapabilityConfig {
  // 支持的工具列表
  enabledTools: string[];
  // 最大上下文消息数
  maxContextMessages: number;
  // 是否支持文件编辑
  canEditFiles: boolean;
  // 是否支持终端命令
  canExecuteCommands: boolean;
  // 是否支持代码重构
  canRefactorCode: boolean;
}

/**
 * Agent 完整配置
 */
export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  // 运行时模式
  runtimeMode: AgentRuntimeMode;
  // AI 模型配置
  aiConfig: AIProviderConfig;
  // 行为配置
  behavior: AgentBehaviorConfig;
  // 能力配置
  capabilities: AgentCapabilityConfig;
  // 系统提示词
  systemPrompt: string;
  // 是否默认配置
  isDefault: boolean;
  // 创建时间
  createdAt: number;
  // 更新时间
  updatedAt: number;
}

/**
 * Agent 任务状态
 */
export interface AgentTask {
  id: string;
  title: string;
  description: string;
  // 使用的Agent配置ID
  configId: string;
  // 运行时模式
  runtimeMode: AgentRuntimeMode;
  // 任务状态
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  // 工作空间路径
  workspacePath: string;
  // 步骤列表
  steps: AgentStep[];
  // 当前步骤索引
  currentStepIndex: number;
  // 消息列表
  messages: AgentMessage[];
  // 待办清单
  todoItems: TodoItem[];
  // 生成的文件
  generatedFiles: GeneratedFile[];
  // 错误记录
  errors: AgentError[];
  // 上下文信息
  context: AgentContext;
  // 创建时间
  createdAt: number;
  // 更新时间
  updatedAt: number;
  // 元数据
  metadata: AgentTaskMetadata;
  // 执行计划（SOLO模式）
  executionPlan?: ExecutionPlan;
  // 执行进度（SOLO模式）
  executionProgress?: number;
}

/**
 * Agent 步骤
 */
export interface AgentStep {
  id: string;
  type: 'analysis' | 'planning' | 'coding' | 'testing' | 'review' | 'verification' | 'deployment';
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: string;
  details?: string;
  startTime?: number;
  endTime?: number;
  artifacts?: StepArtifact[];
}

/**
 * 步骤产物
 */
export interface StepArtifact {
  type: 'file' | 'command' | 'test' | 'log';
  name: string;
  content?: string;
  path?: string;
  status: 'success' | 'error' | 'warning';
}

/**
 * Agent 消息
 */
export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  thinking?: string;
  toolCalls?: AgentToolCall[];
  streamingItems?: StreamEventItem[];
  agentQuestions?: AgentQuestion[];
}

/**
 * Agent 工具调用
 */
export interface AgentToolCall {
  id: string;
  toolName: string;
  params: Record<string, any>;
  status: 'running' | 'completed' | 'error';
  result?: any;
  error?: string;
}

/**
 * Agent 提问
 */
export interface AgentQuestion {
  id: string;
  question: string;
  context?: string;
  status: 'pending' | 'answered';
  answer?: string;
  options?: Array<{id: string; label: string; value: string}>;
}

/**
 * 待办项
 */
export interface TodoItem {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  priority?: 'high' | 'medium' | 'low';
  dependsOn?: string[];
}

/**
 * 生成的文件
 */
export interface GeneratedFile {
  path: string;
  content: string;
  language: string;
  status: 'pending' | 'written' | 'modified' | 'error';
  checksum?: string;
}

/**
 * Agent 错误
 */
export interface AgentError {
  stepId: string;
  message: string;
  fixAttempted: boolean;
  fixed: boolean;
  timestamp: number;
  severity: 'error' | 'warning' | 'info';
}

/**
 * Agent 上下文
 */
export interface AgentContext {
  projectType?: string;
  techStack?: string[];
  dependencies?: string[];
  files?: string[];
  analyzedFiles?: AnalyzedFile[];
  requirements?: Requirement[];
}

/**
 * 分析的文件
 */
export interface AnalyzedFile {
  path: string;
  purpose: string;
  dependencies: string[];
  exports: string[];
}

/**
 * 需求
 */
export interface Requirement {
  id: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed';
}

/**
 * Agent 任务元数据
 */
export interface AgentTaskMetadata {
  totalFilesGenerated: number;
  totalCommandsExecuted: number;
  estimatedTokensUsed: number;
  startTime?: number;
  endTime?: number;
  duration?: number;
}

/**
 * 执行计划步骤（SOLO模式动态计划）
 */
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

/**
 * 执行计划（SOLO模式动态计划）
 */
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

/**
 * Agent 回调函数
 */
export interface AgentCallbacks {
  onStepStart?: (step: AgentStep) => void;
  onStepComplete?: (step: AgentStep) => void;
  onStepFail?: (step: AgentStep, error: string) => void;
  onMessage?: (message: AgentMessage) => void;
  onThinking?: (thinking: string) => void;
  onStreamContent?: (content: string) => void;
  onStreamThinking?: (thinking: string) => void;
  onToolCall?: (toolCall: AgentToolCall) => void;
  onToolResult?: (toolCall: AgentToolCall) => void;
  onTodoUpdate?: (items: TodoItem[]) => void;
  onProgress?: (message: string) => void;
  onStatusChange?: (status: AgentTask['status']) => void;
  onError?: (error: string) => void;
  onComplete?: () => void;
  onQuestion?: (question: AgentQuestion) => void;
  onFileGenerated?: (file: GeneratedFile) => void;
  onContextUpdate?: (context: AgentContext) => void;
}

/**
 * 默认行为配置
 */
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

/**
 * 按模式的行为配置
 */
export const MODE_BEHAVIOR_CONFIGS: Record<AgentRuntimeMode, Partial<AgentBehaviorConfig>> = {
  chat: {
    autoExecuteTools: false,
    askBeforeExecute: true,
    autoFixErrors: false,
    maxAutoRetries: 0,
    showThinking: false,
    enableTodoList: false,
    enableDiffPreview: true,
  },
  agent: {
    autoExecuteTools: false,
    askBeforeExecute: true,
    autoFixErrors: true,
    maxAutoRetries: 3,
    showThinking: true,
    enableTodoList: true,
    enableDiffPreview: true,
  },
  solo: {
    autoExecuteTools: true,
    askBeforeExecute: false,
    autoFixErrors: true,
    maxAutoRetries: 5,
    showThinking: true,
    enableTodoList: true,
    enableDiffPreview: true,
  },
};

/**
 * 默认能力配置
 */
export const DEFAULT_CAPABILITY_CONFIG: AgentCapabilityConfig = {
  enabledTools: ['read_file', 'write_file', 'edit_file', 'list_files', 'search', 'terminal'],
  maxContextMessages: 20,
  canEditFiles: true,
  canExecuteCommands: true,
  canRefactorCode: true,
};

/**
 * 按模式的能力配置
 */
export const MODE_CAPABILITY_CONFIGS: Record<AgentRuntimeMode, Partial<AgentCapabilityConfig>> = {
  chat: {
    enabledTools: ['read_file', 'search'],
    maxContextMessages: 10,
    canEditFiles: false,
    canExecuteCommands: false,
    canRefactorCode: false,
  },
  agent: {
    enabledTools: ['read_file', 'write_file', 'edit_file', 'list_files', 'search', 'terminal'],
    maxContextMessages: 20,
    canEditFiles: true,
    canExecuteCommands: true,
    canRefactorCode: true,
  },
  solo: {
    enabledTools: ['read_file', 'write_file', 'edit_file', 'list_files', 'search', 'terminal'],
    maxContextMessages: 30,
    canEditFiles: true,
    canExecuteCommands: true,
    canRefactorCode: true,
  },
};

/**
 * 系统提示词模板
 */
export const SYSTEM_PROMPT_TEMPLATES: Record<AgentRuntimeMode, string> = {
  chat: `You are an AI coding assistant. Help users with their coding questions and tasks.

Guidelines:
1. Provide clear, concise answers
2. Use code blocks with appropriate language tags
3. Explain your reasoning when helpful
4. Ask clarifying questions when needed`,

  agent: `You are an AI Agent that helps users plan, build, and review code.

You operate in a Plan-Build-Review cycle:
1. Plan: Analyze requirements and create implementation plans
2. Build: Write code following best practices
3. Review: Check code quality and suggest improvements

Guidelines:
1. Always think step by step
2. Use tools to interact with the file system
3. Provide clear explanations of your actions
4. Ask for user confirmation before major changes`,

  solo: `You are SOLO Agent, an autonomous AI developer that can independently complete development tasks from requirements to deployment.

Your capabilities:
1. Analyze project structure and requirements
2. Create detailed development plans
3. Write complete, production-ready code
4. Execute tests and verify functionality
5. Handle errors and retry automatically

Guidelines:
1. Be proactive and autonomous
2. Use tools efficiently
3. Follow existing code conventions
4. Provide progress updates
5. Handle errors gracefully`,
};

/**
 * 创建默认 Agent 配置
 */
export function createDefaultAgentConfig(
  runtimeMode: AgentRuntimeMode = 'chat',
  aiConfig: AIProviderConfig,
  name?: string
): AgentConfig {
  const now = Date.now();
  const behaviorConfig = { ...DEFAULT_BEHAVIOR_CONFIG, ...MODE_BEHAVIOR_CONFIGS[runtimeMode] };
  const capabilityConfig = { ...DEFAULT_CAPABILITY_CONFIG, ...MODE_CAPABILITY_CONFIGS[runtimeMode] };

  return {
    id: `agent-${now}-${Math.random().toString(36).substr(2, 9)}`,
    name: name || `${runtimeMode.charAt(0).toUpperCase() + runtimeMode.slice(1)} Agent`,
    description: `Default ${runtimeMode} mode configuration`,
    runtimeMode,
    aiConfig,
    behavior: behaviorConfig as AgentBehaviorConfig,
    capabilities: capabilityConfig as AgentCapabilityConfig,
    systemPrompt: SYSTEM_PROMPT_TEMPLATES[runtimeMode],
    isDefault: false,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * IPC 频道定义
 */
export const AGENT_IPC_CHANNELS = {
  // Agent 配置管理
  CONFIG_GET_ALL: 'agent:config:get-all',
  CONFIG_GET: 'agent:config:get',
  CONFIG_SAVE: 'agent:config:save',
  CONFIG_DELETE: 'agent:config:delete',
  CONFIG_SET_DEFAULT: 'agent:config:set-default',

  // Agent 任务管理
  TASK_CREATE: 'agent:task:create',
  TASK_START: 'agent:task:start',
  TASK_PAUSE: 'agent:task:pause',
  TASK_RESUME: 'agent:task:resume',
  TASK_STOP: 'agent:task:stop',
  TASK_DELETE: 'agent:task:delete',
  TASK_GET: 'agent:task:get',
  TASK_GET_ALL: 'agent:task:get-all',
  TASK_ANSWER: 'agent:task:answer',
  TASK_SAVE: 'agent:task:save',

  // Agent 事件
  EVENT_STEP_START: 'agent:event:step-start',
  EVENT_STEP_COMPLETE: 'agent:event:step-complete',
  EVENT_STEP_FAIL: 'agent:event:step-fail',
  EVENT_MESSAGE: 'agent:event:message',
  EVENT_THINKING: 'agent:event:thinking',
  EVENT_TOOL_CALL: 'agent:event:tool-call',
  EVENT_TOOL_RESULT: 'agent:event:tool-result',
  EVENT_TODO_UPDATE: 'agent:event:todo-update',
  EVENT_PROGRESS: 'agent:event:progress',
  EVENT_STATUS_CHANGE: 'agent:event:status-change',
  EVENT_ERROR: 'agent:event:error',
  EVENT_COMPLETE: 'agent:event:complete',
  EVENT_QUESTION: 'agent:event:question',
  EVENT_CONTEXT_UPDATE: 'agent:event:context-update',
  EVENT_FILE_GENERATED: 'agent:event:file-generated',
} as const;
