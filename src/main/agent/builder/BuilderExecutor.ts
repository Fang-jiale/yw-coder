/**
 * Builder 执行器
 * 实现 Plan-Build-Review 循环
 * 专注于项目构建和代码生成
 */

import { EventEmitter } from 'events';
import {
  AgentTask,
  AgentConfig,
  AgentMessage,
} from '../../../shared/agentTypes';
import { aiStreamService, StreamChunk } from '../../services/aiStreamService';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * 构建阶段
 */
export type BuildPhase = 'plan' | 'build' | 'review';

/**
 * 构建步骤
 */
export interface BuildStep {
  id: string;
  name: string;
  description: string;
  phase: BuildPhase;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startTime?: number;
  endTime?: number;
  result?: any;
  error?: string;
}

/**
 * 构建计划
 */
export interface BuildPlan {
  id: string;
  goal: string;
  description: string;
  phases: {
    plan: BuildStep[];
    build: BuildStep[];
    review: BuildStep[];
  };
  currentPhase: BuildPhase;
  currentStepIndex: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * 构建上下文
 */
interface BuildContext {
  task: AgentTask;
  config: AgentConfig;
  plan: BuildPlan | null;
  workspacePath: string;
  generatedFiles: string[];
  modifiedFiles: string[];
  conversationHistory: Array<{ role: string; content: string }>;
}

/**
 * 构建状态
 */
interface BuildState {
  isRunning: boolean;
  isPaused: boolean;
  abortController: AbortController | null;
  currentStepId: string | null;
  retryCount: number;
}

/**
 * Builder 执行器
 * 实现 Plan-Build-Review 循环
 */
export class BuilderExecutor extends EventEmitter {
  private context: BuildContext;
  private state: BuildState;
  private executionConfig: {
    maxRetries: number;
    enableConfirmation: boolean;
  };

  constructor(task: AgentTask, config: AgentConfig) {
    super();
    this.context = {
      task,
      config,
      plan: null,
      workspacePath: task.workspacePath || '',
      generatedFiles: [],
      modifiedFiles: [],
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
    };
  }

  /**
   * 开始执行
   * Plan-Build-Review 循环
   */
  async execute(): Promise<void> {
    if (this.state.isRunning) {
      throw new Error('Execution already in progress');
    }

    this.state.isRunning = true;
    this.state.abortController = new AbortController();

    console.log('[BuilderExecutor] execute() starting');
    console.log(`[BuilderExecutor] Task: ${this.context.task.id}`);
    console.log(`[BuilderExecutor] Workspace: ${this.context.workspacePath}`);

    try {
      // Phase 1: Plan - 分析需求并制定构建计划
      console.log('[BuilderExecutor] Starting Phase 1: Plan');
      this.emit('phase:start', 'plan');
      await this.executePlanPhase();
      if (this.shouldStop()) {
        console.log('[BuilderExecutor] Stopped after Plan phase');
        return;
      }
      this.emit('phase:complete', 'plan');
      console.log('[BuilderExecutor] Phase 1: Plan completed');

      // Phase 2: Build - 执行构建
      console.log('[BuilderExecutor] Starting Phase 2: Build');
      this.emit('phase:start', 'build');
      await this.executeBuildPhase();
      if (this.shouldStop()) {
        console.log('[BuilderExecutor] Stopped after Build phase');
        return;
      }
      this.emit('phase:complete', 'build');
      console.log('[BuilderExecutor] Phase 2: Build completed');

      // Phase 3: Review - 审查生成的代码
      console.log('[BuilderExecutor] Starting Phase 3: Review');
      this.emit('phase:start', 'review');
      await this.executeReviewPhase();
      if (this.shouldStop()) {
        console.log('[BuilderExecutor] Stopped after Review phase');
        return;
      }
      this.emit('phase:complete', 'review');
      console.log('[BuilderExecutor] Phase 3: Review completed');

      // 完成
      console.log('[BuilderExecutor] Execution completed successfully');
      this.emit('complete', {
        success: true,
        plan: this.context.plan,
        generatedFiles: this.context.generatedFiles,
        modifiedFiles: this.context.modifiedFiles,
      });
    } catch (error: any) {
      console.error('[BuilderExecutor] Execution error:', error);
      this.emit('error', error.message || 'Build failed');
      throw error;
    } finally {
      this.state.isRunning = false;
      this.state.abortController = null;
      console.log('[BuilderExecutor] execute() finished');
    }
  }

  /**
   * Plan 阶段：分析需求并制定构建计划
   */
  private async executePlanPhase(): Promise<void> {
    this.emit('status', '正在分析需求并制定构建计划...');

    const userInput = this.getUserInput();
    const workspaceInfo = await this.analyzeWorkspace();

    // Step 1: 需求分析
    await this.executeStep({
      id: 'plan-analysis',
      name: '需求分析',
      description: '分析用户需求，理解构建目标',
      phase: 'plan',
    }, async () => {
      const prompt = `作为资深架构师，请分析以下构建需求：

## 用户需求
${userInput}

## 项目信息
${workspaceInfo}

请提供：
1. 核心需求总结
2. 技术选型建议
3. 项目结构规划
4. 关键实现要点`;

      const result = await this.executeAIStep(prompt);
      this.context.conversationHistory.push(
        { role: 'system', content: '需求分析完成' },
        { role: 'assistant', content: result }
      );
      return result;
    });

    if (this.shouldStop()) return;

    // Step 2: 制定构建计划
    await this.executeStep({
      id: 'plan-design',
      name: '构建计划',
      description: '制定详细的构建步骤和文件结构',
      phase: 'plan',
    }, async () => {
      const prompt = `基于需求分析，请制定详细的构建计划：

## 构建目标
${userInput}

请提供：
1. 文件结构规划（需要创建的文件和目录）
2. 每个文件的功能说明
3. 构建步骤顺序
4. 依赖关系说明

请以清晰的格式输出构建计划。`;

      const result = await this.executeAIStep(prompt);
      
      // 解析构建计划
      this.context.plan = this.parseBuildPlan(result, userInput);
      
      return result;
    });
  }

  /**
   * Build 阶段：执行构建
   */
  private async executeBuildPhase(): Promise<void> {
    this.emit('status', '开始执行构建...');

    const userInput = this.getUserInput();

    // Step 1: 创建项目结构
    await this.executeStep({
      id: 'build-structure',
      name: '创建项目结构',
      description: '创建目录和基础文件结构',
      phase: 'build',
    }, async () => {
      const prompt = `请创建项目的基础文件结构：

## 构建目标
${userInput}

## 工作目录
${this.context.workspacePath}

请使用工具来：
1. 创建必要的目录结构
2. 创建基础配置文件（如 package.json、tsconfig.json 等）
3. 确保目录结构符合项目规范

请逐步创建，并确认每个操作。`;

      const result = await this.executeAIStep(prompt, true);
      
      // 记录生成的文件
      this.extractGeneratedFiles(result);
      
      return result;
    });

    if (this.shouldStop()) return;

    // Step 2: 实现核心功能
    await this.executeStep({
      id: 'build-implementation',
      name: '实现核心功能',
      description: '编写核心业务逻辑代码',
      phase: 'build',
    }, async () => {
      const prompt = `请实现项目的核心功能代码：

## 构建目标
${userInput}

## 已创建的文件
${this.context.generatedFiles.join('\n')}

请使用工具来：
1. 编写主要业务逻辑代码
2. 实现关键功能模块
3. 添加必要的类型定义
4. 确保代码质量

请分步骤实现，每个文件完成后确认。`;

      const result = await this.executeAIStep(prompt, true);
      
      // 记录新生成的文件
      this.extractGeneratedFiles(result);
      
      return result;
    });

    if (this.shouldStop()) return;

    // Step 3: 添加辅助文件
    await this.executeStep({
      id: 'build-auxiliary',
      name: '添加辅助文件',
      description: '添加样式、配置和工具函数',
      phase: 'build',
    }, async () => {
      const prompt = `请添加项目的辅助文件：

## 构建目标
${userInput}

## 已创建的文件
${this.context.generatedFiles.join('\n')}

请使用工具来：
1. 添加样式文件（如需要）
2. 添加工具函数和常量
3. 完善配置文件
4. 添加必要的资源文件

请确保项目完整可用。`;

      const result = await this.executeAIStep(prompt, true);
      
      this.extractGeneratedFiles(result);
      
      return result;
    });
  }

  /**
   * Review 阶段：审查生成的代码
   */
  private async executeReviewPhase(): Promise<void> {
    this.emit('status', '开始审查生成的代码...');

    // Step 1: 代码质量检查
    await this.executeStep({
      id: 'review-quality',
      name: '代码质量检查',
      description: '检查代码质量和最佳实践',
      phase: 'review',
    }, async () => {
      const prompt = `请审查已生成的代码质量：

## 生成的文件
${this.context.generatedFiles.join('\n')}

## 工作目录
${this.context.workspacePath}

请检查：
1. 代码风格和规范
2. 类型安全性
3. 错误处理
4. 性能考虑
5. 安全最佳实践

请提供改进建议，并使用工具修复发现的问题。`;

      const result = await this.executeAIStep(prompt, true);
      return result;
    });

    if (this.shouldStop()) return;

    // Step 2: 功能完整性检查
    await this.executeStep({
      id: 'review-completeness',
      name: '功能完整性检查',
      description: '验证功能是否完整实现',
      phase: 'review',
    }, async () => {
      const prompt = `请验证功能的完整性：

## 原始需求
${this.getUserInput()}

## 生成的文件
${this.context.generatedFiles.join('\n')}

请检查：
1. 需求是否完全实现
2. 是否有遗漏的功能点
3. 边界条件处理
4. 用户体验考虑

请确保功能完整，如有遗漏请补充实现。`;

      const result = await this.executeAIStep(prompt, true);
      return result;
    });

    if (this.shouldStop()) return;

    // Step 3: 生成总结报告
    await this.executeStep({
      id: 'review-summary',
      name: '构建总结',
      description: '生成构建总结报告',
      phase: 'review',
    }, async () => {
      const prompt = `请生成构建总结报告：

## 构建目标
${this.getUserInput()}

## 生成的文件
${this.context.generatedFiles.join('\n')}

## 修改的文件
${this.context.modifiedFiles.join('\n')}

请提供：
1. 构建完成情况总结
2. 项目结构说明
3. 主要功能介绍
4. 使用说明
5. 后续建议

请以清晰的格式输出总结报告。`;

      const result = await this.executeAIStep(prompt);
      
      // 添加最终的 AI 消息
      const aiMessage: AgentMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `## 构建完成\n\n${result}`,
        timestamp: Date.now(),
      };
      this.context.task.messages.push(aiMessage);
      this.emit('message', aiMessage);
      
      return result;
    });
  }

  /**
   * 执行单个步骤
   */
  private async executeStep(
    step: Omit<BuildStep, 'status'>,
    action: () => Promise<any>
  ): Promise<void> {
    const fullStep: BuildStep = {
      ...step,
      status: 'in_progress',
      startTime: Date.now(),
    };

    console.log(`[BuilderExecutor] executeStep starting: ${fullStep.id} - ${fullStep.name}`);

    this.state.currentStepId = fullStep.id;
    this.emit('step:start', fullStep);
    this.emit('status', `正在执行: ${fullStep.name}`);

    try {
      console.log(`[BuilderExecutor] Executing action for step: ${fullStep.id}`);
      const result = await action();
      console.log(`[BuilderExecutor] Action completed for step: ${fullStep.id}`);
      
      fullStep.status = 'completed';
      fullStep.endTime = Date.now();
      fullStep.result = result;
      
      this.emit('step:complete', fullStep);
      console.log(`[BuilderExecutor] Step completed: ${fullStep.id}`);
    } catch (error: any) {
      console.error(`[BuilderExecutor] Step failed: ${fullStep.id}`, error);
      fullStep.status = 'failed';
      fullStep.endTime = Date.now();
      fullStep.error = error.message;
      
      this.emit('step:error', fullStep, error.message);

      // 尝试重试
      if (this.state.retryCount < this.executionConfig.maxRetries) {
        this.state.retryCount++;
        this.emit('status', `步骤失败，正在重试 (${this.state.retryCount}/${this.executionConfig.maxRetries})...`);
        await this.executeStep(step, action);
      } else {
        throw error;
      }
    }
  }

  /**
   * 执行 AI 步骤
   */
  private async executeAIStep(prompt: string, enableTools: boolean = false): Promise<string> {
    let result = '';

    console.log(`[BuilderExecutor] executeAIStep starting, enableTools: ${enableTools}`);
    console.log(`[BuilderExecutor] workspacePath: ${this.context.workspacePath}`);
    console.log(`[BuilderExecutor] aiConfig: ${this.context.config.aiConfig?.model || 'undefined'}`);

    try {
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
        {
          isRunning: () => this.state.isRunning && !this.state.isPaused,
        }
      );
      console.log(`[BuilderExecutor] executeAIStep completed, result length: ${result.length}`);
    } catch (error) {
      console.error(`[BuilderExecutor] executeAIStep error:`, error);
      throw error;
    }

    return result;
  }

  /**
   * 解析构建计划
   */
  private parseBuildPlan(content: string, goal: string): BuildPlan {
    const now = Date.now();
    
    // 创建默认的三阶段计划
    return {
      id: `build-plan-${now}`,
      goal,
      description: content,
      phases: {
        plan: [
          {
            id: 'plan-analysis',
            name: '需求分析',
            description: '分析用户需求，理解构建目标',
            phase: 'plan',
            status: 'completed',
          },
          {
            id: 'plan-design',
            name: '构建计划',
            description: '制定详细的构建步骤和文件结构',
            phase: 'plan',
            status: 'completed',
          },
        ],
        build: [
          {
            id: 'build-structure',
            name: '创建项目结构',
            description: '创建目录和基础文件结构',
            phase: 'build',
            status: 'pending',
          },
          {
            id: 'build-implementation',
            name: '实现核心功能',
            description: '编写核心业务逻辑代码',
            phase: 'build',
            status: 'pending',
          },
          {
            id: 'build-auxiliary',
            name: '添加辅助文件',
            description: '添加样式、配置和工具函数',
            phase: 'build',
            status: 'pending',
          },
        ],
        review: [
          {
            id: 'review-quality',
            name: '代码质量检查',
            description: '检查代码质量和最佳实践',
            phase: 'review',
            status: 'pending',
          },
          {
            id: 'review-completeness',
            name: '功能完整性检查',
            description: '验证功能是否完整实现',
            phase: 'review',
            status: 'pending',
          },
          {
            id: 'review-summary',
            name: '构建总结',
            description: '生成构建总结报告',
            phase: 'review',
            status: 'pending',
          },
        ],
      },
      currentPhase: 'plan',
      currentStepIndex: 0,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * 提取生成的文件
   */
  private extractGeneratedFiles(content: string): void {
    // 简单的文件路径提取
    const fileRegex = /(?:created|written|modified|生成|创建|修改).*?(?:file|文件).*?[`"']([^`"'\n]+[`"'])/gi;
    const matches = content.matchAll(fileRegex);
    
    for (const match of matches) {
      const filePath = match[1];
      if (filePath && !this.context.generatedFiles.includes(filePath)) {
        this.context.generatedFiles.push(filePath);
      }
    }
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
  getPlan(): BuildPlan | null {
    return this.context.plan;
  }

  /**
   * 获取执行状态
   */
  getState(): BuildState {
    return { ...this.state };
  }
}

export default BuilderExecutor;
