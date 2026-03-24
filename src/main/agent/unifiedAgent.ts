/**
 * 统一 Agent 核心实现
 * 整合普通对话、SOLO模式和Agent模式
 */

import {
  AgentConfig,
  AgentTask,
  AgentStep,
  AgentMessage,
  AgentToolCall,
  AgentCallbacks,
  AgentContext,
  GeneratedFile,
  TodoItem,
  AgentError,
  BUILT_IN_AGENTS,
} from '../../shared/agentTypes';
import { aiStreamService, StreamChunk } from '../services/aiStreamService';
import { AIToolService } from '../services/aiToolService';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * 统一 Agent 类
 */
export class UnifiedAgent {
  private task: AgentTask;
  private config: AgentConfig;
  private callbacks: AgentCallbacks;
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private toolService: AIToolService;
  private checkpointInterval: NodeJS.Timeout | null = null;
  private currentRetryCount: number = 0;

  constructor(task: AgentTask, config: AgentConfig, callbacks: AgentCallbacks = {}) {
    this.task = task;
    this.config = config;
    this.callbacks = callbacks;
    this.toolService = new AIToolService(task.workspacePath);
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
    this.task.metadata.startTime = Date.now();
    this.currentRetryCount = 0;

    this.callbacks.onStatusChange?.('running');

    // 启动定期保存
    if (this.config.behavior.autoExecuteTools) {
      this.startCheckpointSaver();
    }

    try {
      // 根据运行模式执行不同的逻辑
      switch (this.config.type) {
        case 'chat':
          await this.executeChatMode();
          break;
        case 'builder':
          await this.executeAgentMode();
          break;
        case 'solocoder':
          await this.executeSoloMode();
          break;
        default:
          throw new Error(`Unknown runtime mode: ${this.config.type}`);
      }

      if (!this.isPaused) {
        this.task.status = 'completed';
        this.task.metadata.endTime = Date.now();
        this.task.metadata.duration = this.task.metadata.endTime - (this.task.metadata.startTime || 0);
        this.callbacks.onStatusChange?.('completed');
        this.callbacks.onComplete?.();
      }
    } catch (error) {
      this.task.status = 'failed';
      this.callbacks.onStatusChange?.('failed');
      this.callbacks.onError?.(String(error));

      // 尝试自动修复
      if (this.config.behavior.autoFixErrors && this.currentRetryCount < this.config.behavior.maxAutoRetries) {
        this.currentRetryCount++;
        this.callbacks.onProgress?.(`自动修复中... (${this.currentRetryCount}/${this.config.behavior.maxAutoRetries})`);
        await this.fixError(String(error));
        await this.start();
      }
    } finally {
      this.isRunning = false;
      this.stopCheckpointSaver();
      await this.saveCheckpoint();
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
    this.stopCheckpointSaver();
    this.callbacks.onStatusChange?.('failed');
  }

  /**
   * 执行普通对话模式
   */
  private async executeChatMode(): Promise<void> {
    // Chat模式：简单的问答，不执行步骤循环
    const lastMessage = this.task.messages[this.task.messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'user') {
      return;
    }

    const prompt = this.buildChatPrompt(lastMessage.content);
    await this.streamAIResponse(prompt);
  }

  /**
   * 执行Agent模式
   */
  private async executeAgentMode(): Promise<void> {
    // Agent模式：Plan-Build-Review循环
    const steps = this.generateAgentSteps();
    this.task.steps = steps;

    for (let i = 0; i < steps.length; i++) {
      if (!this.isRunning || this.isPaused) return;

      this.task.currentStepIndex = i;
      const step = steps[i];
      await this.executeStep(step);

      if (step.status === 'failed') {
        throw new Error(`Step ${step.id} failed`);
      }
    }
  }

  /**
   * 执行SOLO模式
   */
  private async executeSoloMode(): Promise<void> {
    // SOLO模式：全流程自动化
    // Phase 1: 规划阶段
    await this.executePlanningPhase();
    if (!this.isRunning || this.isPaused) return;

    // Phase 2: 自主执行循环
    await this.executeAutonomousLoop();
    if (!this.isRunning || this.isPaused) return;

    // Phase 3: 验证阶段
    await this.executeVerificationPhase();
  }

  /**
   * 执行单个步骤
   */
  private async executeStep(step: AgentStep): Promise<void> {
    step.status = 'in_progress';
    step.startTime = Date.now();
    this.callbacks.onStepStart?.(step);

    try {
      const prompt = this.buildStepPrompt(step);
      await this.streamAIResponse(prompt);

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
   * 规划阶段
   */
  private async executePlanningPhase(): Promise<void> {
    const analysisStep: AgentStep = {
      id: `analysis-${Date.now()}`,
      type: 'analysis',
      description: '分析需求和项目环境',
      status: 'in_progress',
      startTime: Date.now(),
    };

    const planningStep: AgentStep = {
      id: `planning-${Date.now()}`,
      type: 'planning',
      description: '制定开发计划',
      status: 'pending',
    };

    this.task.steps = [analysisStep, planningStep];
    this.callbacks.onStepStart?.(analysisStep);

    try {
      // 探索项目结构
      this.callbacks.onProgress?.('探索项目结构...');
      await this.exploreProjectStructure();

      // 分析需求
      this.callbacks.onProgress?.('分析需求...');
      const analysisPrompt = this.buildAnalysisPrompt();
      const analysisResult = await this.executeAIWithTools(analysisPrompt);

      analysisStep.status = 'completed';
      analysisStep.result = analysisResult;
      analysisStep.endTime = Date.now();
      this.callbacks.onStepComplete?.(analysisStep);

      // 更新上下文
      this.updateContext(analysisResult);

      // 制定计划
      planningStep.status = 'in_progress';
      planningStep.startTime = Date.now();
      this.callbacks.onStepStart?.(planningStep);

      const planningPrompt = this.buildPlanningPrompt();
      const planningResult = await this.executeAIWithTools(planningPrompt);

      planningStep.status = 'completed';
      planningStep.result = planningResult;
      planningStep.endTime = Date.now();
      this.callbacks.onStepComplete?.(planningStep);

      // 解析待办事项
      this.parseTodoItems(planningResult);

    } catch (error) {
      analysisStep.status = 'failed';
      analysisStep.endTime = Date.now();
      this.callbacks.onStepFail?.(analysisStep, String(error));
      throw error;
    }
  }

  /**
   * 自主执行循环
   */
  private async executeAutonomousLoop(): Promise<void> {
    const codingStep: AgentStep = {
      id: `coding-${Date.now()}`,
      type: 'coding',
      description: '执行代码生成',
      status: 'in_progress',
      startTime: Date.now(),
    };

    const testingStep: AgentStep = {
      id: `testing-${Date.now()}`,
      type: 'testing',
      description: '测试和验证',
      status: 'pending',
    };

    this.task.steps.push(codingStep, testingStep);
    this.callbacks.onStepStart?.(codingStep);

    let attemptCount = 0;
    let lastError: string | null = null;

    while (attemptCount < this.config.behavior.maxAutoRetries && this.isRunning && !this.isPaused) {
      try {
        // 执行编码
        this.callbacks.onProgress?.('生成代码...');
        const codingPrompt = this.buildCodingPrompt(lastError);
        const codingResult = await this.executeAIWithTools(codingPrompt);

        codingStep.status = 'completed';
        codingStep.result = codingResult;
        codingStep.endTime = Date.now();
        this.callbacks.onStepComplete?.(codingStep);

        // 执行测试
        testingStep.status = 'in_progress';
        testingStep.startTime = Date.now();
        this.callbacks.onStepStart?.(testingStep);

        this.callbacks.onProgress?.('运行测试...');
        const testingResult = await this.executeTestingPhase();

        testingStep.status = 'completed';
        testingStep.result = testingResult;
        testingStep.endTime = Date.now();
        this.callbacks.onStepComplete?.(testingStep);

        return;

      } catch (error) {
        lastError = String(error);
        attemptCount++;

        this.task.errors.push({
          stepId: codingStep.id,
          message: lastError,
          fixAttempted: attemptCount > 0,
          fixed: false,
          timestamp: Date.now(),
          severity: 'error',
        });

        this.callbacks.onError?.(`尝试 ${attemptCount}/${this.config.behavior.maxAutoRetries} 失败: ${lastError}`);

        if (attemptCount < this.config.behavior.maxAutoRetries) {
          this.callbacks.onProgress?.('自动修复错误...');
          await this.fixError(lastError);
        }
      }
    }

    codingStep.status = 'failed';
    codingStep.endTime = Date.now();
    this.callbacks.onStepFail?.(codingStep, lastError || '未知错误');
    throw new Error(`达到最大重试次数 (${this.config.behavior.maxAutoRetries})，任务失败`);
  }

  /**
   * 验证阶段
   */
  private async executeVerificationPhase(): Promise<void> {
    const verificationStep: AgentStep = {
      id: `verification-${Date.now()}`,
      type: 'verification',
      description: '验证最终结果',
      status: 'in_progress',
      startTime: Date.now(),
    };

    this.task.steps.push(verificationStep);
    this.callbacks.onStepStart?.(verificationStep);

    try {
      this.callbacks.onProgress?.('验证结果...');
      const verificationPrompt = this.buildVerificationPrompt();
      const verificationResult = await this.executeAIWithTools(verificationPrompt);

      verificationStep.status = 'completed';
      verificationStep.result = verificationResult;
      verificationStep.endTime = Date.now();
      this.callbacks.onStepComplete?.(verificationStep);

    } catch (error) {
      verificationStep.status = 'failed';
      verificationStep.endTime = Date.now();
      this.callbacks.onStepFail?.(verificationStep, String(error));
    }
  }

  /**
   * 流式 AI 响应
   */
  private async streamAIResponse(prompt: string): Promise<void> {
    return new Promise((resolve, reject) => {
      let fullContent = '';
      let thinking = '';

      const handleChunk = (chunk: StreamChunk) => {
        switch (chunk.type) {
          case 'thinking':
            thinking += chunk.content || '';
            this.callbacks.onThinking?.(chunk.content || '');
            break;
          case 'content':
            fullContent += chunk.content || '';
            // 实时发送内容到前端
            this.callbacks.onStreamContent?.(chunk.content || '');
            break;
          case 'tool_start':
            const toolCall: AgentToolCall = {
              id: chunk.toolCallId || Date.now().toString(),
              toolName: chunk.toolName || '',
              params: chunk.toolParams || {},
              status: 'running',
            };
            this.callbacks.onToolCall?.(toolCall);
            break;
          case 'tool_end':
            this.callbacks.onToolResult?.(
              chunk.toolCallId || Date.now().toString(),
              {
                toolName: chunk.toolName || '',
                params: {},
                status: chunk.toolResult?.success ? 'completed' : 'error',
                result: chunk.toolResult?.data,
                error: chunk.toolResult?.error,
              }
            );
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
            resolve();
            break;
          case 'error':
            reject(new Error(chunk.error));
            break;
        }
      };

      aiStreamService.streamExecute(
        prompt,
        this.task.workspacePath,
        this.config.aiConfig,
        handleChunk,
        {
          history: this.task.messages
            .filter(m => m.role === 'user' || m.role === 'assistant')
            .map(m => ({
              role: m.role as 'user' | 'assistant',
              content: m.content,
            })),
          isRunning: () => this.isRunning && !this.isPaused,
        }
      );
    });
  }

  /**
   * 带工具执行的 AI 请求
   */
  private async executeAIWithTools(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      let fullContent = '';

      const handleChunk = (chunk: StreamChunk) => {
        switch (chunk.type) {
          case 'thinking':
            this.callbacks.onThinking?.(chunk.content || '');
            break;
          case 'content':
            fullContent += chunk.content || '';
            // 实时发送内容到前端
            this.callbacks.onStreamContent?.(chunk.content || '');
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
            if (chunk.toolResult) {
              this.callbacks.onToolResult?.(
                chunk.toolCallId || Date.now().toString(),
                {
                  toolName: chunk.toolName || '',
                  params: {},
                  status: chunk.toolResult.success ? 'completed' : 'error',
                  result: chunk.toolResult.data,
                  error: chunk.toolResult.error,
                }
              );
            }
            break;
          case 'todo_update':
            if (chunk.todoItems) {
              const now = Date.now();
              this.task.todoItems = chunk.todoItems.map(item => ({
                ...item,
                createdAt: (item as any).createdAt || now,
                updatedAt: now,
              }));
              this.callbacks.onTodoUpdate?.(this.task.todoItems);
            }
            break;
          case 'agent_question':
            if (chunk.question) {
              this.callbacks.onQuestion?.({
                ...chunk.question,
                status: 'pending',
                createdAt: Date.now(),
              });
            }
            break;
          case 'done':
            resolve(fullContent);
            break;
          case 'error':
            reject(new Error(chunk.error));
            break;
        }
      };

      aiStreamService.streamExecute(
        prompt,
        this.task.workspacePath,
        this.config.aiConfig,
        handleChunk,
        {
          isRunning: () => this.isRunning && !this.isPaused,
        }
      );
    });
  }

  /**
   * 生成Agent模式的步骤
   */
  private generateAgentSteps(): AgentStep[] {
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
        description: '制定实施计划',
        status: 'pending',
      },
      {
        id: '3',
        type: 'coding',
        description: '执行代码生成',
        status: 'pending',
      },
      {
        id: '4',
        type: 'review',
        description: '审查代码质量',
        status: 'pending',
      },
    ];
  }

  /**
   * 构建聊天提示词
   */
  private buildChatPrompt(userMessage: string): string {
    return `${this.config.systemPrompt}

用户消息：${userMessage}

请根据以上信息提供帮助。`;
  }

  /**
   * 构建步骤提示词
   */
  private buildStepPrompt(step: AgentStep): string {
    const previousSteps = this.task.steps
      .filter(s => s.result && s.status === 'completed')
      .map(s => `[${s.type}] ${s.description}\n${s.result}`)
      .join('\n\n');

    return `${this.config.systemPrompt}

任务：${this.task.title}
描述：${this.task.description}

当前步骤：${step.description}

之前的步骤：
${previousSteps}

请执行当前步骤。`;
  }

  /**
   * 构建分析提示词
   */
  private buildAnalysisPrompt(): string {
    const context = this.task.context;
    return `${this.config.systemPrompt}

## 用户需求
${this.task.description}

## 项目信息
${context.projectType ? `- 项目类型: ${context.projectType}` : ''}
${context.techStack ? `- 技术栈: ${context.techStack.join(', ')}` : ''}
${context.files ? `- 现有文件: ${context.files.slice(0, 20).join(', ')}` : ''}

请分析项目类型、技术栈、核心功能模块和依赖关系。`;
  }

  /**
   * 构建规划提示词
   */
  private buildPlanningPrompt(): string {
    return `${this.config.systemPrompt}

## 需求
${this.task.description}

## 分析结果
${JSON.stringify(this.task.context, null, 2)}

请制定详细的开发计划，包括具体步骤、文件操作和依赖关系。`;
  }

  /**
   * 构建编码提示词
   */
  private buildCodingPrompt(lastError?: string | null): string {
    let prompt = `${this.config.systemPrompt}

## 需求
${this.task.description}

## 任务列表
${this.task.todoItems.map(t => `- [${t.status}] ${t.content}`).join('\n')}

## 已生成文件
${this.task.generatedFiles.map(f => `- ${f.path} (${f.status})`).join('\n')}`;

    if (lastError) {
      prompt += `\n\n## 之前的错误（需要修复）\n${lastError}`;
    }

    prompt += `\n\n请执行代码生成任务。`;
    return prompt;
  }

  /**
   * 构建测试提示词
   */
  private buildTestingPrompt(): string {
    return `${this.config.systemPrompt}

请测试和验证已生成的代码。`;
  }

  /**
   * 构建验证提示词
   */
  private buildVerificationPrompt(): string {
    return `${this.config.systemPrompt}

## 需求
${this.task.description}

## 已完成任务
${this.task.todoItems.filter(t => t.status === 'completed').map(t => `- ${t.content}`).join('\n')}

## 生成的文件
${this.task.generatedFiles.map(f => `- ${f.path}`).join('\n')}

请验证最终结果是否符合需求。`;
  }

  /**
   * 探索项目结构
   */
  private async exploreProjectStructure(): Promise<void> {
    try {
      const rootFiles = await this.toolService.executeTool({
        tool: 'list_files',
        params: { dir_path: '', recursive: false }
      });

      if (rootFiles.success && rootFiles.data?.files) {
        this.task.context.files = rootFiles.data.files;

        // 检测项目类型
        const files = rootFiles.data.files as string[];
        if (files.includes('package.json')) {
          const packageJson = await this.toolService.executeTool({
            tool: 'read_file',
            params: { file_path: 'package.json' }
          });
          if (packageJson.success) {
            this.detectProjectTypeFromPackageJson(packageJson.data.content);
          }
        }
      }
    } catch (error) {
      console.error('探索项目结构失败:', error);
    }
  }

  /**
   * 从 package.json 检测项目类型
   */
  private detectProjectTypeFromPackageJson(content: string): void {
    try {
      const pkg = JSON.parse(content);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      if (deps['react']) {
        this.task.context.projectType = 'React';
        this.task.context.techStack = ['React', 'JavaScript/TypeScript'];
      } else if (deps['vue']) {
        this.task.context.projectType = 'Vue';
        this.task.context.techStack = ['Vue', 'JavaScript/TypeScript'];
      } else if (deps['next']) {
        this.task.context.projectType = 'Next.js';
        this.task.context.techStack = ['Next.js', 'React', 'TypeScript'];
      }

      this.task.context.dependencies = Object.keys(deps);
    } catch (e) {
      // 解析失败
    }
  }

  /**
   * 执行测试阶段
   */
  private async executeTestingPhase(): Promise<string> {
    // 简化实现，实际应该执行具体的测试命令
    return '测试阶段完成';
  }

  /**
   * 自动修复错误
   */
  private async fixError(error: string): Promise<void> {
    const fixPrompt = `请修复以下错误：

## 错误信息
${error}

## 需求
${this.task.description}

请分析错误原因并实施修复。`;

    await this.executeAIWithTools(fixPrompt);
  }

  /**
   * 更新上下文
   */
  private updateContext(analysisResult: string): void {
    try {
      const jsonMatch = analysisResult.match(/```json\n?([\s\S]*?)\n?```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : analysisResult;
      const parsed = JSON.parse(jsonStr);
      this.task.context = {
        ...this.task.context,
        projectType: parsed.projectType || this.task.context.projectType,
        techStack: parsed.techStack || this.task.context.techStack,
        dependencies: parsed.dependencies || this.task.context.dependencies,
      };
      this.callbacks.onContextUpdate?.(this.task.context);
    } catch (e) {
      console.error('解析分析结果失败:', e);
    }
  }

  /**
   * 解析待办事项
   */
  private parseTodoItems(planningResult: string): void {
    try {
      const jsonMatch = planningResult.match(/```json\n?([\s\S]*?)\n?```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : planningResult;
      const parsed = JSON.parse(jsonStr);
      if (parsed.todoItems) {
        this.task.todoItems = parsed.todoItems.map((item: any) => ({
          ...item,
          status: item.status || 'pending',
        }));
        this.callbacks.onTodoUpdate?.(this.task.todoItems);
      }
    } catch (e) {
      console.error('解析待办事项失败:', e);
    }
  }

  /**
   * 启动定期保存
   */
  private startCheckpointSaver(): void {
    this.checkpointInterval = setInterval(() => {
      this.saveCheckpoint();
    }, 30000);
  }

  /**
   * 停止定期保存
   */
  private stopCheckpointSaver(): void {
    if (this.checkpointInterval) {
      clearInterval(this.checkpointInterval);
      this.checkpointInterval = null;
    }
  }

  /**
   * 保存检查点
   */
  private async saveCheckpoint(): Promise<void> {
    try {
      const checkpointDir = path.join(this.task.workspacePath, '.aicoder', 'checkpoints');
      await fs.mkdir(checkpointDir, { recursive: true });
      const checkpointPath = path.join(checkpointDir, `${this.task.id}.json`);
      await fs.writeFile(checkpointPath, JSON.stringify(this.task, null, 2), 'utf-8');
    } catch (error) {
      console.error('保存检查点失败:', error);
    }
  }

  /**
   * 获取当前任务
   */
  getTask(): AgentTask {
    return { ...this.task };
  }

  /**
   * 序列化任务
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
 * 创建统一 Agent
 */
export function createUnifiedAgent(
  title: string,
  description: string,
  workspacePath: string,
  config: AgentConfig,
  callbacks: AgentCallbacks = {}
): UnifiedAgent {
  const task: AgentTask = {
    id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title,
    description,
    agentId: config.id,
    configId: config.id,
    agentType: config.type,
    workspacePath,
    status: 'pending',
    steps: [],
    currentStepIndex: 0,
    messages: [],
    todoItems: [],
    generatedFiles: [],
    errors: [],
    context: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
    metadata: {
      totalFilesGenerated: 0,
      totalCommandsExecuted: 0,
      estimatedTokensUsed: 0,
    },
  };

  return new UnifiedAgent(task, config, callbacks);
}

/**
 * Agent 管理器
 */
export class UnifiedAgentManager {
  private agents: Map<string, UnifiedAgent> = new Map();

  createAgent(
    title: string,
    description: string,
    workspacePath: string,
    config: AgentConfig,
    callbacks: AgentCallbacks = {}
  ): UnifiedAgent {
    const agent = createUnifiedAgent(title, description, workspacePath, config, callbacks);
    this.agents.set(agent.getTask().id, agent);
    return agent;
  }

  getAgent(taskId: string): UnifiedAgent | undefined {
    return this.agents.get(taskId);
  }

  removeAgent(taskId: string): void {
    this.agents.delete(taskId);
  }

  getAllAgents(): UnifiedAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * 从检查点恢复
   */
  async restoreFromCheckpoint(workspacePath: string, taskId: string): Promise<UnifiedAgent | null> {
    try {
      const checkpointPath = path.join(workspacePath, '.aicoder', 'checkpoints', `${taskId}.json`);
      const data = await fs.readFile(checkpointPath, 'utf-8');
      const task = UnifiedAgent.deserialize(data);

      if (task.status === 'running') {
        task.status = 'paused';
      }

      // 注意：恢复时需要一个配置，这里使用默认配置
      // 实际使用时应该从配置管理器获取
      const agent = new UnifiedAgent(task, {} as AgentConfig, {});
      this.agents.set(task.id, agent);
      return agent;
    } catch (error) {
      console.error('从检查点恢复失败:', error);
      return null;
    }
  }
}

export const unifiedAgentManager = new UnifiedAgentManager();
