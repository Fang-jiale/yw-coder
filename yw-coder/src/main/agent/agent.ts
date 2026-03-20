/**
 * Agent 系统 - 智能体核心架构
 * 实现 Plan-Build-Review 循环
 */

import { AIProviderConfig } from '../../shared/types';
import { aiStreamService } from '../services/aiStreamService';

export type AgentMode = 'plan' | 'build' | 'review' | 'idle';

export interface AgentStep {
  id: string;
  type: 'analysis' | 'planning' | 'coding' | 'testing' | 'review';
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: string;
  startTime?: number;
  endTime?: number;
}

export interface AgentTask {
  id: string;
  title: string;
  description: string;
  mode: AgentMode;
  steps: AgentStep[];
  currentStepIndex: number;
  workspacePath: string;
  config: AIProviderConfig;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  createdAt: number;
  updatedAt: number;
  messages: AgentMessage[];
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  thinking?: string;
  toolCalls?: AgentToolCall[];
}

export interface AgentToolCall {
  id: string;
  toolName: string;
  params: Record<string, any>;
  status: 'running' | 'completed' | 'error';
  result?: any;
  error?: string;
}

export interface AgentCallbacks {
  onModeChange?: (mode: AgentMode) => void;
  onStepStart?: (step: AgentStep) => void;
  onStepComplete?: (step: AgentStep) => void;
  onStepFail?: (step: AgentStep, error: string) => void;
  onMessage?: (message: AgentMessage) => void;
  onThinking?: (thinking: string) => void;
  onToolCall?: (toolCall: AgentToolCall) => void;
  onToolResult?: (toolCall: AgentToolCall) => void;
  onStatusChange?: (status: AgentTask['status']) => void;
  onError?: (error: string) => void;
  onComplete?: () => void;
}

/**
 * Agent 核心类
 */
export class Agent {
  private task: AgentTask;
  private callbacks: AgentCallbacks;
  private isRunning: boolean = false;
  private isPaused: boolean = false;

  constructor(task: AgentTask, callbacks: AgentCallbacks = {}) {
    this.task = task;
    this.callbacks = callbacks;
  }

  /**
   * 开始执行任务
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Agent is already running');
    }

    this.isRunning = true;
    this.isPaused = false;
    this.task.status = 'running';
    this.task.updatedAt = Date.now();
    this.callbacks.onStatusChange?.('running');

    try {
      while (this.isRunning && !this.isPaused && this.task.currentStepIndex < this.task.steps.length) {
        const step = this.task.steps[this.task.currentStepIndex];
        await this.executeStep(step);
        
        if (step.status === 'failed') {
          this.task.status = 'failed';
          this.callbacks.onStatusChange?.('failed');
          return;
        }

        this.task.currentStepIndex++;
      }

      if (!this.isPaused) {
        this.task.status = 'completed';
        this.callbacks.onStatusChange?.('completed');
        this.callbacks.onComplete?.();
      }
    } catch (error) {
      this.task.status = 'failed';
      this.callbacks.onStatusChange?.('failed');
      this.callbacks.onError?.(String(error));
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 暂停任务
   */
  pause(): void {
    this.isPaused = true;
    this.task.status = 'paused';
    this.task.updatedAt = Date.now();
    this.callbacks.onStatusChange?.('paused');
  }

  /**
   * 恢复任务
   */
  async resume(): Promise<void> {
    if (this.task.status !== 'paused') {
      throw new Error('Task is not paused');
    }
    
    this.isPaused = false;
    await this.start();
  }

  /**
   * 停止任务
   */
  stop(): void {
    this.isRunning = false;
    this.isPaused = false;
    this.task.status = 'failed';
    this.task.updatedAt = Date.now();
    this.callbacks.onStatusChange?.('failed');
  }

  /**
   * 执行单个步骤
   */
  private async executeStep(step: AgentStep): Promise<void> {
    step.status = 'in_progress';
    step.startTime = Date.now();
    this.callbacks.onStepStart?.(step);

    try {
      switch (step.type) {
        case 'analysis':
          await this.executeAnalysisStep(step);
          break;
        case 'planning':
          await this.executePlanningStep(step);
          break;
        case 'coding':
          await this.executeCodingStep(step);
          break;
        case 'testing':
          await this.executeTestingStep(step);
          break;
        case 'review':
          await this.executeReviewStep(step);
          break;
        default:
          throw new Error(`Unknown step type: ${step.type}`);
      }

      step.status = 'completed';
      step.endTime = Date.now();
      this.callbacks.onStepComplete?.(step);
    } catch (error) {
      step.status = 'failed';
      step.endTime = Date.now();
      this.callbacks.onStepFail?.(step, String(error));
      throw error;
    }
  }

  /**
   * 执行分析步骤
   */
  private async executeAnalysisStep(step: AgentStep): Promise<void> {
    const prompt = this.buildAnalysisPrompt(step);
    await this.streamAIResponse(prompt, step);
  }

  /**
   * 执行规划步骤
   */
  private async executePlanningStep(step: AgentStep): Promise<void> {
    const prompt = this.buildPlanningPrompt(step);
    await this.streamAIResponse(prompt, step);
  }

  /**
   * 执行编码步骤
   */
  private async executeCodingStep(step: AgentStep): Promise<void> {
    const prompt = this.buildCodingPrompt(step);
    await this.streamAIResponse(prompt, step);
  }

  /**
   * 执行测试步骤
   */
  private async executeTestingStep(step: AgentStep): Promise<void> {
    const prompt = this.buildTestingPrompt(step);
    await this.streamAIResponse(prompt, step);
  }

  /**
   * 执行审查步骤
   */
  private async executeReviewStep(step: AgentStep): Promise<void> {
    const prompt = this.buildReviewPrompt(step);
    await this.streamAIResponse(prompt, step);
  }

  /**
   * 流式 AI 响应
   */
  private async streamAIResponse(prompt: string, step: AgentStep): Promise<void> {
    return new Promise((resolve, reject) => {
      let fullContent = '';
      let thinking = '';

      aiStreamService.streamExecute(
        prompt,
        this.task.workspacePath,
        this.task.config,
        (chunk) => {
          switch (chunk.type) {
            case 'thinking':
              thinking += chunk.content || '';
              this.callbacks.onThinking?.(chunk.content || '');
              break;
            case 'content':
              fullContent += chunk.content;
              break;
            case 'tool_start':
              this.callbacks.onToolCall?.({
                id: chunk.toolCallId || Date.now().toString(),
                toolName: chunk.toolName || '',
                params: chunk.toolParams || {},
                status: 'running',
              });
              break;
            case 'tool_end':
              this.callbacks.onToolResult?.({
                id: chunk.toolCallId || Date.now().toString(),
                toolName: chunk.toolName || '',
                params: {},
                status: chunk.toolResult?.success ? 'completed' : 'error',
                result: chunk.toolResult?.data,
                error: chunk.toolResult?.error,
              });
              break;
            case 'done':
              const message: AgentMessage = {
                id: Date.now().toString(),
                role: 'assistant',
                content: fullContent,
                timestamp: Date.now(),
                thinking,
              };
              this.task.messages.push(message);
              this.callbacks.onMessage?.(message);
              step.result = fullContent;
              resolve();
              break;
            case 'error':
              reject(new Error(chunk.error));
              break;
          }
        },
        {
          history: this.task.messages
            .filter(m => m.role === 'user' || m.role === 'assistant')
            .map(m => ({
              role: m.role as 'user' | 'assistant',
              content: m.content,
            })),
        }
      );
    });
  }

  /**
   * 构建分析提示词
   */
  private buildAnalysisPrompt(step: AgentStep): string {
    return `请分析以下任务需求：

任务：${this.task.title}
描述：${this.task.description}

当前步骤：${step.description}

请分析：
1. 任务的核心目标
2. 需要涉及的技术栈
3. 可能遇到的挑战
4. 建议的实现方案

请详细分析并给出你的思考过程。`;
  }

  /**
   * 构建规划提示词
   */
  private buildPlanningPrompt(step: AgentStep): string {
    const previousAnalysis = this.task.steps
      .filter(s => s.type === 'analysis' && s.result)
      .map(s => s.result)
      .join('\n\n');

    return `基于之前的分析，请制定详细的实施计划：

任务：${this.task.title}

分析结果：
${previousAnalysis}

当前步骤：${step.description}

请制定：
1. 详细的实施步骤
2. 每个步骤的具体操作
3. 需要创建或修改的文件
4. 依赖关系和执行顺序

请以结构化的方式输出你的计划。`;
  }

  /**
   * 构建编码提示词
   */
  private buildCodingPrompt(step: AgentStep): string {
    const previousSteps = this.task.steps
      .filter(s => s.result && s.status === 'completed')
      .map(s => `[${s.type}] ${s.description}\n${s.result}`)
      .join('\n\n');

    return `请根据之前的分析和规划，执行具体的编码任务：

任务：${this.task.title}

之前的步骤：
${previousSteps}

当前步骤：${step.description}

请：
1. 创建或修改必要的文件
2. 编写清晰、可维护的代码
3. 添加必要的注释
4. 确保代码符合最佳实践

请使用工具来完成文件操作。`;
  }

  /**
   * 构建测试提示词
   */
  private buildTestingPrompt(step: AgentStep): string {
    return `请为已完成的代码编写测试：

任务：${this.task.title}

当前步骤：${step.description}

请：
1. 检查代码的正确性
2. 编写单元测试（如适用）
3. 验证功能是否符合需求
4. 发现并修复潜在问题

请详细说明测试结果。`;
  }

  /**
   * 构建审查提示词
   */
  private buildReviewPrompt(step: AgentStep): string {
    const allChanges = this.task.steps
      .filter(s => s.type === 'coding' && s.result)
      .map(s => s.result)
      .join('\n\n');

    return `请审查已完成的代码变更：

任务：${this.task.title}

代码变更：
${allChanges}

当前步骤：${step.description}

请审查：
1. 代码质量和可读性
2. 是否符合需求
3. 潜在的性能问题
4. 安全性和错误处理
5. 改进建议

请给出详细的审查意见。`;
  }

  /**
   * 获取当前任务状态
   */
  getTask(): AgentTask {
    return { ...this.task };
  }

  /**
   * 序列化任务（用于持久化）
   */
  serialize(): string {
    return JSON.stringify(this.task);
  }

  /**
   * 反序列化任务
   */
  static deserialize(data: string): AgentTask {
    return JSON.parse(data);
  }
}

/**
 * Agent 工厂函数
 */
export function createAgent(
  title: string,
  description: string,
  workspacePath: string,
  config: AIProviderConfig,
  mode: AgentMode = 'plan',
  callbacks: AgentCallbacks = {}
): Agent {
  const task: AgentTask = {
    id: Date.now().toString(),
    title,
    description,
    mode,
    steps: generateSteps(mode, description),
    currentStepIndex: 0,
    workspacePath,
    config,
    status: 'pending',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
  };

  return new Agent(task, callbacks);
}

/**
 * 根据模式生成步骤
 */
function generateSteps(mode: AgentMode, description: string): AgentStep[] {
  switch (mode) {
    case 'plan':
      return [
        {
          id: '1',
          type: 'analysis',
          description: '分析任务需求和目标',
          status: 'pending',
        },
        {
          id: '2',
          type: 'planning',
          description: '制定详细的实施计划',
          status: 'pending',
        },
      ];
    case 'build':
      return [
        {
          id: '1',
          type: 'analysis',
          description: '分析需求和现有代码',
          status: 'pending',
        },
        {
          id: '2',
          type: 'coding',
          description: '实现功能代码',
          status: 'pending',
        },
        {
          id: '3',
          type: 'testing',
          description: '测试和验证',
          status: 'pending',
        },
      ];
    case 'review':
      return [
        {
          id: '1',
          type: 'review',
          description: '审查代码质量和规范',
          status: 'pending',
        },
      ];
    default:
      return [];
  }
}

/**
 * Agent 管理器
 */
export class AgentManager {
  private agents: Map<string, Agent> = new Map();

  createAgent(
    title: string,
    description: string,
    workspacePath: string,
    config: AIProviderConfig,
    mode: AgentMode = 'plan',
    callbacks: AgentCallbacks = {}
  ): Agent {
    const agent = createAgent(title, description, workspacePath, config, mode, callbacks);
    this.agents.set(agent.getTask().id, agent);
    return agent;
  }

  getAgent(taskId: string): Agent | undefined {
    return this.agents.get(taskId);
  }

  removeAgent(taskId: string): void {
    this.agents.delete(taskId);
  }

  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }
}

export const agentManager = new AgentManager();
