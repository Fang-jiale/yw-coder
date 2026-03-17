/**
 * 动态 SOLO 执行器
 * 参考 Trae、Cursor 等工具的设计
 * AI 根据任务动态生成执行计划，而非固定流程
 */

import { EventEmitter } from 'events';
import {
  AgentTask,
  AgentConfig,
  AgentStep,
  AgentMessage,
  AgentToolCall,
  TodoItem,
} from '../../../shared/agentTypes';
import { aiStreamService, StreamChunk } from '../../services/aiStreamService';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * 执行计划步骤
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
 * 执行计划
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
 * 执行上下文
 */
interface ExecutionContext {
  task: AgentTask;
  config: AgentConfig;
  plan: ExecutionPlan | null;
  workspacePath: string;
  analyzedFiles: Map<string, string>;
  generatedFiles: string[];
  toolResults: Map<string, any>;
  conversationHistory: Array<{ role: string; content: string }>;
}

/**
 * 执行状态
 */
interface ExecutionState {
  isRunning: boolean;
  isPaused: boolean;
  abortController: AbortController | null;
  currentStepId: string | null;
  retryCount: number;
}

/**
 * 动态 Solo 执行器
 */
export class DynamicSoloExecutor extends EventEmitter {
  private context: ExecutionContext;
  private state: ExecutionState;
  private executionConfig: {
    maxRetries: number;
    enableConfirmation: boolean;
    maxSteps: number;
  };

  constructor(task: AgentTask, config: AgentConfig) {
    super();
    this.context = {
      task,
      config,
      plan: null,
      workspacePath: task.workspacePath || '',
      analyzedFiles: new Map(),
      generatedFiles: [],
      toolResults: new Map(),
      conversationHistory: [],
    };
    this.state = {
      isRunning: false,
      isPaused: false,
      abortController: null,
      currentStepId: null,
      retryCount: 0,
    };
    this.executionConfig = {
      maxRetries: config.behavior?.maxAutoRetries || 3,
      enableConfirmation: config.behavior?.askBeforeExecute || false,
      maxSteps: 50,
    };
  }

  /**
   * 开始执行
   */
  async execute(): Promise<void> {
    if (this.state.isRunning) {
      throw new Error('Execution already in progress');
    }

    this.state.isRunning = true;
    this.state.abortController = new AbortController();

    try {
      // 步骤 1: 分析需求并生成执行计划
      await this.generateExecutionPlan();
      if (this.shouldStop()) return;

      // 步骤 2: 执行计划中的各个步骤
      await this.executePlan();
      if (this.shouldStop()) return;

      // 步骤 3: 总结执行结果
      await this.summarizeExecution();

      this.emit('complete', {
        success: true,
        plan: this.context.plan,
        generatedFiles: this.context.generatedFiles,
      });
    } catch (error: any) {
      this.emit('error', error.message || 'Execution failed');
      throw error;
    } finally {
      this.state.isRunning = false;
      this.state.abortController = null;
    }
  }

  /**
   * 生成执行计划
   * 使用 AI 分析需求并生成动态执行计划
   */
  private async generateExecutionPlan(): Promise<void> {
    this.emit('status', '正在分析需求并生成执行计划...');

    const userInput = this.getUserInput();
    const workspaceInfo = await this.analyzeWorkspace();

    const prompt = `你是一位资深的软件架构师和项目经理。请根据以下信息，制定一个详细的执行计划。

## 用户需求
${userInput}

## 项目信息
${workspaceInfo}

## 你的任务
1. 分析用户需求，理解核心目标
2. 根据项目类型和复杂度，制定合适的执行步骤
3. 每个步骤应该具体、可执行
4. 考虑步骤之间的依赖关系
5. 为每个步骤提供执行理由

## 输出格式
请以 JSON 格式输出执行计划：
{
  "goal": "任务目标概述",
  "reasoning": "制定此计划的理由",
  "steps": [
    {
      "id": "step-1",
      "name": "步骤名称",
      "description": "详细描述",
      "type": "analysis|planning|coding|testing|review|documentation|custom",
      "reasoning": "为什么需要这个步骤",
      "estimatedTime": 300,
      "dependencies": [],
      "tools": ["read_file", "write_file", "terminal"]
    }
  ],
  "totalEstimatedTime": 1800
}

注意：
- 步骤数量应该根据任务复杂度决定，简单任务 3-5 步，复杂任务 7-10 步
- 类型选择最符合的：analysis(分析)、planning(规划)、coding(编码)、testing(测试)、review(审查)、documentation(文档)、custom(自定义)
- estimatedTime 以秒为单位估算`;

    let planContent = '';
    
    await aiStreamService.streamExecute(
      prompt,
      this.context.workspacePath,
      this.context.config.aiConfig,
      (chunk: StreamChunk) => {
        if (chunk.type === 'content') {
          planContent += chunk.content || '';
        } else if (chunk.type === 'thinking') {
          this.emit('thinking', chunk.content);
        }
      },
      {}
    );

    // 解析生成的计划
    const plan = this.parseExecutionPlan(planContent);
    this.context.plan = plan;

    this.emit('plan:generated', plan);
    this.emit('status', `已生成执行计划，共 ${plan.steps.length} 个步骤`);
  }

  /**
   * 执行计划
   */
  private async executePlan(): Promise<void> {
    if (!this.context.plan) {
      throw new Error('No execution plan available');
    }

    const { steps } = this.context.plan;

    for (let i = 0; i < steps.length; i++) {
      if (this.shouldStop()) break;

      const step = steps[i];
      this.context.plan.currentStepIndex = i;
      this.state.currentStepId = step.id;

      // 检查依赖是否完成
      if (step.dependencies && step.dependencies.length > 0) {
        const depsCompleted = step.dependencies.every(depId => {
          const depStep = steps.find(s => s.id === depId);
          return depStep?.status === 'completed';
        });
        if (!depsCompleted) {
          step.status = 'pending';
          continue;
        }
      }

      // 执行步骤
      await this.executeStep(step);

      // 更新进度
      const progress = Math.round(((i + 1) / steps.length) * 100);
      this.emit('progress', progress);
    }
  }

  /**
   * 执行单个步骤
   */
  private async executeStep(step: ExecutionPlanStep): Promise<void> {
    step.status = 'in_progress';
    step.startTime = Date.now();

    this.emit('step:start', step);
    this.emit('status', `正在执行: ${step.name}`);

    try {
      // 根据步骤类型执行不同的逻辑
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
        case 'documentation':
          await this.executeDocumentationStep(step);
          break;
        default:
          await this.executeCustomStep(step);
      }

      step.status = 'completed';
      step.endTime = Date.now();
      this.emit('step:complete', step);
    } catch (error: any) {
      step.status = 'failed';
      step.error = error.message;
      step.endTime = Date.now();
      this.emit('step:error', step, error.message);

      // 尝试自动重试
      if (this.state.retryCount < this.executionConfig.maxRetries) {
        this.state.retryCount++;
        this.emit('status', `步骤失败，正在重试 (${this.state.retryCount}/${this.executionConfig.maxRetries})...`);
        await this.executeStep(step);
      } else {
        throw error;
      }
    }
  }

  /**
   * 执行分析步骤
   */
  private async executeAnalysisStep(step: ExecutionPlanStep): Promise<void> {
    const prompt = `执行分析步骤: ${step.description}\n\n请分析项目结构和需求，提供详细的分析结果。`;
    
    const result = await this.executeAIStep(prompt);
    step.result = result;
    
    // 分析结果可以更新上下文
    this.context.analyzedFiles.set('analysis', result);
  }

  /**
   * 执行规划步骤
   */
  private async executePlanningStep(step: ExecutionPlanStep): Promise<void> {
    const prompt = `执行规划步骤: ${step.description}\n\n请制定详细的实现方案。`;
    
    const result = await this.executeAIStep(prompt);
    step.result = result;
  }

  /**
   * 执行编码步骤
   */
  private async executeCodingStep(step: ExecutionPlanStep): Promise<void> {
    const prompt = `执行编码步骤: ${step.description}\n\n请编写代码实现。使用工具来完成文件操作。`;
    
    const result = await this.executeAIStep(prompt, true);
    step.result = result;
  }

  /**
   * 执行测试步骤
   */
  private async executeTestingStep(step: ExecutionPlanStep): Promise<void> {
    const prompt = `执行测试步骤: ${step.description}\n\n请运行测试并验证实现。`;
    
    const result = await this.executeAIStep(prompt, true);
    step.result = result;
  }

  /**
   * 执行审查步骤
   */
  private async executeReviewStep(step: ExecutionPlanStep): Promise<void> {
    const prompt = `执行审查步骤: ${step.description}\n\n请审查代码质量并提供改进建议。`;
    
    const result = await this.executeAIStep(prompt);
    step.result = result;
  }

  /**
   * 执行文档步骤
   */
  private async executeDocumentationStep(step: ExecutionPlanStep): Promise<void> {
    const prompt = `执行文档步骤: ${step.description}\n\n请生成相关文档。`;
    
    const result = await this.executeAIStep(prompt, true);
    step.result = result;
  }

  /**
   * 执行自定义步骤
   */
  private async executeCustomStep(step: ExecutionPlanStep): Promise<void> {
    const prompt = `执行步骤: ${step.name}\n描述: ${step.description}\n\n请完成此步骤。`;
    
    const result = await this.executeAIStep(prompt, true);
    step.result = result;
  }

  /**
   * 执行 AI 步骤
   */
  private async executeAIStep(prompt: string, enableTools: boolean = false): Promise<string> {
    let result = '';
    
    await aiStreamService.streamExecute(
      prompt,
      this.context.workspacePath,
      this.context.config.aiConfig,
      (chunk: StreamChunk) => {
        this.handleStreamChunk(chunk);
        if (chunk.type === 'content') {
          result += chunk.content || '';
        }
      },
      enableTools ? {} : undefined
    );

    // 添加到对话历史
    this.context.conversationHistory.push(
      { role: 'user', content: prompt },
      { role: 'assistant', content: result }
    );

    return result;
  }

  /**
   * 总结执行结果
   */
  private async summarizeExecution(): Promise<void> {
    const completedSteps = this.context.plan?.steps.filter(s => s.status === 'completed') || [];
    const failedSteps = this.context.plan?.steps.filter(s => s.status === 'failed') || [];

    const summary = {
      totalSteps: this.context.plan?.steps.length || 0,
      completedSteps: completedSteps.length,
      failedSteps: failedSteps.length,
      generatedFiles: this.context.generatedFiles,
      duration: Date.now() - (this.context.plan?.createdAt || Date.now()),
    };

    this.emit('summary', summary);
  }

  /**
   * 解析执行计划
   */
  private parseExecutionPlan(content: string): ExecutionPlan {
    try {
      // 尝试提取 JSON
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || 
                       content.match(/```\n([\s\S]*?)\n```/) ||
                       content.match(/\{[\s\S]*\}/);
      
      const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : content;
      const parsed = JSON.parse(jsonStr);

      const steps: ExecutionPlanStep[] = parsed.steps.map((s: any, index: number) => ({
        id: s.id || `step-${index + 1}`,
        name: s.name || s.title || `步骤 ${index + 1}`,
        description: s.description || '',
        type: s.type || 'custom',
        status: 'pending',
        reasoning: s.reasoning || '',
        estimatedTime: s.estimatedTime || 0,
        dependencies: s.dependencies || [],
        tools: s.tools || [],
      }));

      return {
        id: `plan-${Date.now()}`,
        goal: parsed.goal || this.getUserInput(),
        steps,
        currentStepIndex: 0,
        totalEstimatedTime: parsed.totalEstimatedTime || steps.reduce((sum: number, s: ExecutionPlanStep) => sum + (s.estimatedTime || 0), 0),
        reasoning: parsed.reasoning || '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    } catch (error) {
      // 解析失败，创建默认计划
      return this.createDefaultPlan();
    }
  }

  /**
   * 创建默认执行计划
   */
  private createDefaultPlan(): ExecutionPlan {
    return {
      id: `plan-${Date.now()}`,
      goal: this.getUserInput(),
      steps: [
        {
          id: 'step-1',
          name: '需求分析',
          description: '分析用户需求和项目环境',
          type: 'analysis',
          status: 'pending',
        },
        {
          id: 'step-2',
          name: '制定方案',
          description: '制定实现方案',
          type: 'planning',
          status: 'pending',
        },
        {
          id: 'step-3',
          name: '代码实现',
          description: '编写代码实现功能',
          type: 'coding',
          status: 'pending',
        },
        {
          id: 'step-4',
          name: '测试验证',
          description: '测试和验证实现',
          type: 'testing',
          status: 'pending',
        },
      ],
      currentStepIndex: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  /**
   * 分析工作目录
   */
  private async analyzeWorkspace(): Promise<string> {
    try {
      const files = await fs.readdir(this.context.workspacePath);
      
      let projectType = '未知';
      if (files.includes('package.json')) projectType = 'Node.js';
      else if (files.includes('requirements.txt')) projectType = 'Python';
      else if (files.includes('Cargo.toml')) projectType = 'Rust';
      else if (files.includes('go.mod')) projectType = 'Go';

      return `项目类型: ${projectType}\n文件数量: ${files.length}\n主要文件: ${files.slice(0, 10).join(', ')}${files.length > 10 ? '...' : ''}`;
    } catch (error) {
      return '无法分析工作目录';
    }
  }

  /**
   * 处理流式响应块
   */
  private handleStreamChunk(chunk: StreamChunk): void {
    switch (chunk.type) {
      case 'thinking':
        this.emit('thinking', chunk.content);
        break;
      case 'content':
        this.emit('content', chunk.content);
        break;
      case 'tool_start':
        this.emit('tool:start', {
          id: chunk.toolCallId,
          name: chunk.toolName,
          params: chunk.toolParams,
        });
        break;
      case 'tool_end':
        this.emit('tool:end', {
          id: chunk.toolCallId,
          result: chunk.toolResult,
        });
        break;
    }
  }

  /**
   * 检查是否应该停止
   */
  private shouldStop(): boolean {
    return !this.state.isRunning || 
           this.state.isPaused || 
           (this.state.abortController?.signal.aborted ?? false);
  }

  /**
   * 获取用户输入
   */
  private getUserInput(): string {
    const lastUserMessage = this.context.task.messages
      .filter(m => m.role === 'user')
      .pop();
    return lastUserMessage?.content || this.context.task.description || '';
  }

  /**
   * 暂停执行
   */
  pause(): void {
    this.state.isPaused = true;
    this.emit('paused');
  }

  /**
   * 恢复执行
   */
  resume(): void {
    this.state.isPaused = false;
    this.emit('resumed');
  }

  /**
   * 停止执行
   */
  stop(): void {
    this.state.isRunning = false;
    this.state.abortController?.abort();
    this.emit('stopped');
  }

  /**
   * 获取当前计划
   */
  getPlan(): ExecutionPlan | null {
    return this.context.plan;
  }

  /**
   * 获取执行状态
   */
  getState(): ExecutionState {
    return { ...this.state };
  }
}

export default DynamicSoloExecutor;
