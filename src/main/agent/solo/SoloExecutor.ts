/**
 * SOLO 模式执行器
 * 参考 Cline、Cursor、Devin 等业界最佳实践
 * 实现智能任务规划、上下文管理、执行审查等功能
 */

import { EventEmitter } from 'events';
import {
  AgentTask,
  AgentConfig,
  AgentStep,
  AgentMessage,
  AgentToolCall,
  TodoItem,
  AgentContext,
  AnalyzedFile,
  Requirement,
} from '../../../shared/agentTypes';
import { aiStreamService, StreamChunk } from '../../services/aiStreamService';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * SOLO 执行配置
 */
interface SoloExecutionConfig {
  // 是否在执行前询问确认
  requireConfirmation: boolean;
  // 最大执行步骤数
  maxSteps: number;
  // 最大重试次数
  maxRetries: number;
  // 是否启用智能上下文管理
  enableSmartContext: boolean;
  // 上下文窗口大小（token 数）
  contextWindowSize: number;
  // 是否启用检查点保存
  enableCheckpoints: boolean;
  // 检查点间隔（步骤数）
  checkpointInterval: number;
}

/**
 * 执行状态
 */
interface ExecutionState {
  currentPhase: SoloPhase;
  currentStep: number;
  totalSteps: number;
  context: AgentContext;
  checkpoints: Checkpoint[];
  lastError?: string;
  retryCount: number;
}

/**
 * SOLO 执行阶段
 */
export type SoloPhase =
  | 'requirement_analysis'    // 需求分析
  | 'context_gathering'       // 上下文收集
  | 'architecture_design'     // 架构设计
  | 'task_planning'          // 任务规划
  | 'implementation'         // 实现执行
  | 'code_review'            // 代码审查
  | 'testing'                // 测试验证
  | 'refinement'             // 优化完善
  | 'documentation'          // 文档生成
  | 'completion';            // 完成

/**
 * 检查点
 */
interface Checkpoint {
  id: string;
  phase: SoloPhase;
  step: number;
  timestamp: number;
  files: string[];
  description: string;
}

/**
 * 工具执行请求
 */
interface ToolExecutionRequest {
  toolCall: AgentToolCall;
  requiresConfirmation: boolean;
  reason: string;
}

/**
 * SOLO 执行事件
 */
export interface SoloExecutionEvents {
  'phase:start': (phase: SoloPhase, description: string) => void;
  'phase:end': (phase: SoloPhase, result: any) => void;
  'step:start': (step: AgentStep) => void;
  'step:end': (step: AgentStep, result: any) => void;
  'step:error': (step: AgentStep, error: string) => void;
  'tool:request': (request: ToolExecutionRequest) => void;
  'tool:execute': (toolCall: AgentToolCall) => void;
  'tool:result': (toolCall: AgentToolCall, result: any) => void;
  'thinking': (thinking: string) => void;
  'content': (content: string) => void;
  'todo:update': (items: TodoItem[]) => void;
  'context:update': (context: AgentContext) => void;
  'checkpoint': (checkpoint: Checkpoint) => void;
  'confirmation:required': (request: ConfirmationRequest) => void;
  'error': (error: string) => void;
  'complete': (result: any) => void;
}

/**
 * 确认请求
 */
interface ConfirmationRequest {
  id: string;
  type: 'file_write' | 'file_edit' | 'command_execute' | 'tool_call';
  description: string;
  details: any;
  timeout?: number;
}

/**
 * 文件变更预览
 */
interface FileChangePreview {
  path: string;
  originalContent?: string;
  newContent: string;
  type: 'create' | 'modify' | 'delete';
  diff?: string;
}

/**
 * SOLO 执行器类
 */
export class SoloExecutor extends EventEmitter {
  private task: AgentTask;
  private config: AgentConfig;
  private executionConfig: SoloExecutionConfig;
  private state: ExecutionState;
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private abortController: AbortController | null = null;
  private pendingConfirmations: Map<string, (approved: boolean) => void> = new Map();

  constructor(
    task: AgentTask,
    config: AgentConfig,
    executionConfig?: Partial<SoloExecutionConfig>
  ) {
    super();
    this.task = task;
    this.config = config;
    this.executionConfig = {
      requireConfirmation: config.behavior.askBeforeExecute,
      maxSteps: 100,
      maxRetries: config.behavior.maxAutoRetries,
      enableSmartContext: true,
      contextWindowSize: 8000,
      enableCheckpoints: true,
      checkpointInterval: 5,
      ...executionConfig,
    };
    this.state = {
      currentPhase: 'requirement_analysis',
      currentStep: 0,
      totalSteps: 0,
      context: task.context || {},
      checkpoints: [],
      retryCount: 0,
    };
  }

  /**
   * 检查是否应该停止
   */
  private shouldStop(): boolean {
    return !this.isRunning || this.isPaused || (this.abortController?.signal.aborted ?? false);
  }

  /**
   * 开始执行
   */
  async execute(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Execution already in progress');
    }

    this.isRunning = true;
    this.abortController = new AbortController();

    try {
      // 执行各个阶段
      await this.executeRequirementAnalysis();
      if (this.shouldStop()) return;

      await this.executeContextGathering();
      if (this.shouldStop()) return;

      await this.executeArchitectureDesign();
      if (this.shouldStop()) return;

      await this.executeTaskPlanning();
      if (this.shouldStop()) return;

      await this.executeImplementation();
      if (this.shouldStop()) return;

      await this.executeCodeReview();
      if (this.shouldStop()) return;

      await this.executeTesting();
      if (this.shouldStop()) return;

      await this.executeRefinement();
      if (this.shouldStop()) return;

      await this.executeDocumentation();
      if (this.shouldStop()) return;

      await this.executeCompletion();

      this.emit('complete', {
        success: true,
        task: this.task,
        context: this.state.context,
      });
    } catch (error: any) {
      this.emit('error', error.message || 'Execution failed');
      throw error;
    } finally {
      this.isRunning = false;
      this.abortController = null;
    }
  }

  /**
   * 暂停执行
   */
  pause(): void {
    this.isPaused = true;
  }

  /**
   * 恢复执行
   */
  resume(): void {
    this.isPaused = false;
  }

  /**
   * 停止执行
   */
  stop(): void {
    this.isRunning = false;
    this.abortController?.abort();
  }

  /**
   * 确认操作
   */
  confirmOperation(confirmationId: string, approved: boolean): void {
    const resolver = this.pendingConfirmations.get(confirmationId);
    if (resolver) {
      resolver(approved);
      this.pendingConfirmations.delete(confirmationId);
    }
  }

  /**
   * 需求分析阶段
   */
  private async executeRequirementAnalysis(): Promise<void> {
    this.setPhase('requirement_analysis');
    this.emit('phase:start', 'requirement_analysis', '分析用户需求');

    const userInput = this.getUserInput();
    if (!userInput) {
      throw new Error('No user input found');
    }

    // 构建需求分析提示词
    const prompt = this.buildRequirementAnalysisPrompt(userInput);

    // 执行 AI 分析
    const result = await this.executeAIStream(prompt, (chunk) => {
      this.handleStreamChunk(chunk);
    });

    // 解析需求
    const requirements = this.parseRequirements(result);
    this.state.context.requirements = requirements;

    this.emit('phase:end', 'requirement_analysis', { requirements });
    this.emit('context:update', this.state.context);
  }

  /**
   * 上下文收集阶段
   */
  private async executeContextGathering(): Promise<void> {
    this.setPhase('context_gathering');
    this.emit('phase:start', 'context_gathering', '收集项目上下文');

    const workspacePath = this.task.workspacePath;
    if (!workspacePath) {
      throw new Error('No workspace path specified');
    }

    // 分析项目结构
    const projectStructure = await this.analyzeProjectStructure(workspacePath);
    this.state.context.projectType = projectStructure.type;
    this.state.context.techStack = projectStructure.techStack;
    this.state.context.dependencies = projectStructure.dependencies;

    // 识别相关文件
    const relevantFiles = await this.identifyRelevantFiles(workspacePath);
    this.state.context.files = relevantFiles;

    // 分析关键文件
    const analyzedFiles = await this.analyzeKeyFiles(relevantFiles);
    this.state.context.analyzedFiles = analyzedFiles;

    this.emit('phase:end', 'context_gathering', {
      projectType: projectStructure.type,
      filesAnalyzed: analyzedFiles.length,
    });
    this.emit('context:update', this.state.context);
  }

  /**
   * 架构设计阶段
   */
  private async executeArchitectureDesign(): Promise<void> {
    this.setPhase('architecture_design');
    this.emit('phase:start', 'architecture_design', '设计系统架构');

    const prompt = this.buildArchitectureDesignPrompt();

    const result = await this.executeAIStream(prompt, (chunk) => {
      this.handleStreamChunk(chunk);
    });

    // 解析架构设计
    const architecture = this.parseArchitecture(result);

    this.emit('phase:end', 'architecture_design', { architecture });
  }

  /**
   * 任务规划阶段
   */
  private async executeTaskPlanning(): Promise<void> {
    this.setPhase('task_planning');
    this.emit('phase:start', 'task_planning', '制定执行计划');

    const prompt = this.buildTaskPlanningPrompt();

    const result = await this.executeAIStream(prompt, (chunk) => {
      this.handleStreamChunk(chunk);
    });

    // 解析任务计划
    const todoItems = this.parseTodoItems(result);
    this.task.todoItems = todoItems;
    this.state.totalSteps = todoItems.length;

    this.emit('todo:update', todoItems);
    this.emit('phase:end', 'task_planning', { totalSteps: todoItems.length });
  }

  /**
   * 实现执行阶段
   */
  private async executeImplementation(): Promise<void> {
    this.setPhase('implementation');
    this.emit('phase:start', 'implementation', '执行代码实现');

    for (let i = 0; i < this.task.todoItems.length; i++) {
      if (this.shouldStop()) break;

      const todoItem = this.task.todoItems[i];
      if (todoItem.status === 'completed') continue;

      // 更新当前步骤
      this.state.currentStep = i + 1;

      // 创建步骤
      const step: AgentStep = {
        id: `step-${Date.now()}-${i}`,
        type: 'coding',
        description: todoItem.content,
        status: 'in_progress',
        startTime: Date.now(),
      };

      this.emit('step:start', step);

      try {
        // 执行步骤
        await this.executeTodoItem(todoItem, step);

        // 更新待办项状态
        todoItem.status = 'completed';

        step.status = 'completed';
        step.endTime = Date.now();
        this.emit('step:end', step, { success: true });

        // 创建检查点
        if (this.executionConfig.enableCheckpoints &&
            (i + 1) % this.executionConfig.checkpointInterval === 0) {
          await this.createCheckpoint(step);
        }
      } catch (error: any) {
        todoItem.status = 'failed';

        step.status = 'failed';
        step.endTime = Date.now();
        this.emit('step:error', step, error.message);

        // 尝试自动修复
        if (this.state.retryCount < this.executionConfig.maxRetries) {
          this.state.retryCount++;
          this.state.lastError = error.message;
          i--; // 重试当前步骤
          continue;
        } else {
          throw error;
        }
      }

      this.emit('todo:update', this.task.todoItems);
    }

    this.emit('phase:end', 'implementation', { completedSteps: this.state.currentStep });
  }

  /**
   * 代码审查阶段
   */
  private async executeCodeReview(): Promise<void> {
    this.setPhase('code_review');
    this.emit('phase:start', 'code_review', '审查代码质量');

    const prompt = this.buildCodeReviewPrompt();

    const result = await this.executeAIStream(prompt, (chunk) => {
      this.handleStreamChunk(chunk);
    });

    // 解析审查结果
    const reviewResult = this.parseCodeReview(result);

    // 如果有问题，创建修复任务
    if (reviewResult.issues.length > 0) {
      const now = Date.now();
      for (const issue of reviewResult.issues) {
        this.task.todoItems.push({
          id: `fix-${now}`,
          content: `修复: ${issue.description}`,
          status: 'pending',
          priority: issue.severity === 'high' ? 'high' : 'medium',
          createdAt: now,
          updatedAt: now,
        });
      }
      this.emit('todo:update', this.task.todoItems);
    }

    this.emit('phase:end', 'code_review', reviewResult);
  }

  /**
   * 测试验证阶段
   */
  private async executeTesting(): Promise<void> {
    this.setPhase('testing');
    this.emit('phase:start', 'testing', '执行测试验证');

    // 检查是否有测试命令
    const testCommands = await this.detectTestCommands();

    for (const command of testCommands) {
      if (this.shouldStop()) break;

      const toolCall: AgentToolCall = {
        id: `test-${Date.now()}`,
        toolName: 'terminal',
        params: { command },
        status: 'running',
      };

      // 请求确认（如果需要）
      if (this.executionConfig.requireConfirmation) {
        const approved = await this.requestConfirmation({
          id: toolCall.id,
          type: 'command_execute',
          description: `执行测试命令: ${command}`,
          details: { command },
        });

        if (!approved) {
          continue;
        }
      }

      this.emit('tool:execute', toolCall);

      // 执行测试
      try {
        // 实际执行命令...
        toolCall.status = 'completed';
        toolCall.result = { success: true };
      } catch (error: any) {
        toolCall.status = 'error';
        toolCall.error = error.message;
      }

      this.emit('tool:result', toolCall, toolCall.result);
    }

    this.emit('phase:end', 'testing', { testsRun: testCommands.length });
  }

  /**
   * 优化完善阶段
   */
  private async executeRefinement(): Promise<void> {
    this.setPhase('refinement');
    this.emit('phase:start', 'refinement', '优化完善代码');

    // 检查是否有待修复的问题
    const pendingFixes = this.task.todoItems.filter(
      item => item.status === 'pending' && item.content.startsWith('修复:')
    );

    if (pendingFixes.length > 0) {
      for (const fix of pendingFixes) {
        if (this.shouldStop()) break;

        // 执行修复
        await this.executeFix(fix);
        fix.status = 'completed';
      }

      this.emit('todo:update', this.task.todoItems);
    }

    this.emit('phase:end', 'refinement', { fixesApplied: pendingFixes.length });
  }

  /**
   * 文档生成阶段
   */
  private async executeDocumentation(): Promise<void> {
    this.setPhase('documentation');
    this.emit('phase:start', 'documentation', '生成项目文档');

    const prompt = this.buildDocumentationPrompt();

    const result = await this.executeAIStream(prompt, (chunk) => {
      this.handleStreamChunk(chunk);
    });

    // 生成文档文件
    const docs = this.parseDocumentation(result);

    for (const doc of docs) {
      if (this.shouldStop()) break;

      // 请求确认（如果需要）
      if (this.executionConfig.requireConfirmation) {
        const approved = await this.requestConfirmation({
          id: `doc-${Date.now()}`,
          type: 'file_write',
          description: `创建文档: ${doc.path}`,
          details: { path: doc.path, content: doc.content },
        });

        if (!approved) continue;
      }

      // 写入文档文件
      // await fs.writeFile(path.join(this.task.workspacePath, doc.path), doc.content);
    }

    this.emit('phase:end', 'documentation', { docsGenerated: docs.length });
  }

  /**
   * 完成阶段
   */
  private async executeCompletion(): Promise<void> {
    this.setPhase('completion');
    this.emit('phase:start', 'completion', '完成任务');

    // 生成执行摘要
    const summary = this.generateExecutionSummary();

    this.emit('phase:end', 'completion', { summary });
  }

  /**
   * 执行待办项
   */
  private async executeTodoItem(todoItem: TodoItem, step: AgentStep): Promise<void> {
    const prompt = this.buildTodoExecutionPrompt(todoItem);

    let accumulatedContent = '';

    await this.executeAIStream(prompt, (chunk) => {
      this.handleStreamChunk(chunk);
      accumulatedContent += chunk.content || '';
    });

    // 解析并执行工具调用
    const toolCalls = this.parseToolCalls(accumulatedContent);

    for (const toolCall of toolCalls) {
      if (this.shouldStop()) break;

      // 检查是否需要确认
      const requiresConfirmation = this.requiresConfirmation(toolCall);

      if (requiresConfirmation && this.executionConfig.requireConfirmation) {
        const approved = await this.requestConfirmation({
          id: toolCall.id,
          type: this.getConfirmationType(toolCall),
          description: this.getConfirmationDescription(toolCall),
          details: toolCall.params,
        });

        if (!approved) {
          toolCall.status = 'error';
          toolCall.error = 'User declined';
          this.emit('tool:result', toolCall, null);
          continue;
        }
      }

      // 执行工具调用
      this.emit('tool:execute', toolCall);

      try {
        const result = await this.executeToolCall(toolCall);
        toolCall.status = 'completed';
        toolCall.result = result;
      } catch (error: any) {
        toolCall.status = 'error';
        toolCall.error = error.message;
        throw error;
      }

      this.emit('tool:result', toolCall, toolCall.result);
    }

    step.result = accumulatedContent;
  }

  /**
   * 执行 AI 流式调用
   */
  private async executeAIStream(
    prompt: string,
    onChunk: (chunk: StreamChunk) => void
  ): Promise<string> {
    let fullContent = '';

    await aiStreamService.streamExecute(
      prompt,
      this.task.workspacePath,
      this.config.aiConfig,
      (chunk) => {
        onChunk(chunk);
        if (chunk.type === 'content') {
          fullContent += chunk.content || '';
        }
      },
      {
        isRunning: () => this.isRunning && !this.isPaused,
      }
    );

    return fullContent;
  }

  /**
   * 处理流式响应块
   */
  private handleStreamChunk(chunk: StreamChunk): void {
    switch (chunk.type) {
      case 'thinking':
        this.emit('thinking', chunk.content || '');
        break;
      case 'content':
        this.emit('content', chunk.content || '');
        break;
      case 'tool_start':
        // 工具开始执行
        break;
      case 'tool_end':
        // 工具执行完成
        break;
    }
  }

  /**
   * 请求用户确认
   */
  private async requestConfirmation(request: ConfirmationRequest): Promise<boolean> {
    return new Promise((resolve) => {
      this.pendingConfirmations.set(request.id, resolve);
      this.emit('confirmation:required', request);

      // 设置超时
      if (request.timeout) {
        setTimeout(() => {
          if (this.pendingConfirmations.has(request.id)) {
            this.pendingConfirmations.delete(request.id);
            resolve(false);
          }
        }, request.timeout);
      }
    });
  }

  /**
   * 创建检查点
   */
  private async createCheckpoint(step: AgentStep): Promise<void> {
    const checkpoint: Checkpoint = {
      id: `checkpoint-${Date.now()}`,
      phase: this.state.currentPhase,
      step: this.state.currentStep,
      timestamp: Date.now(),
      files: this.state.context.files || [],
      description: `Checkpoint after: ${step.description}`,
    };

    this.state.checkpoints.push(checkpoint);
    this.emit('checkpoint', checkpoint);
  }

  /**
   * 分析项目结构
   */
  private async analyzeProjectStructure(workspacePath: string): Promise<{
    type: string;
    techStack: string[];
    dependencies: string[];
  }> {
    // 检查常见项目文件
    const files = await fs.readdir(workspacePath);

    let type = 'unknown';
    const techStack: string[] = [];
    const dependencies: string[] = [];

    if (files.includes('package.json')) {
      type = 'node';
      techStack.push('Node.js');

      const packageJson = JSON.parse(
        await fs.readFile(path.join(workspacePath, 'package.json'), 'utf-8')
      );

      dependencies.push(...Object.keys(packageJson.dependencies || {}));

      if (dependencies.includes('react')) techStack.push('React');
      if (dependencies.includes('vue')) techStack.push('Vue');
      if (dependencies.includes('next')) techStack.push('Next.js');
      if (dependencies.includes('typescript')) techStack.push('TypeScript');
    }

    if (files.includes('requirements.txt')) {
      type = 'python';
      techStack.push('Python');
    }

    if (files.includes('Cargo.toml')) {
      type = 'rust';
      techStack.push('Rust');
    }

    if (files.includes('go.mod')) {
      type = 'go';
      techStack.push('Go');
    }

    return { type, techStack, dependencies };
  }

  /**
   * 识别相关文件
   */
  private async identifyRelevantFiles(workspacePath: string): Promise<string[]> {
    const relevantFiles: string[] = [];

    // 递归扫描文件
    const scanDir = async (dir: string, depth: number = 0) => {
      if (depth > 3) return;

      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(workspacePath, fullPath);

        if (entry.isDirectory()) {
          // 跳过常见忽略目录
          if (['node_modules', '.git', 'dist', 'build', '.next'].includes(entry.name)) {
            continue;
          }
          await scanDir(fullPath, depth + 1);
        } else {
          // 只关注代码文件
          const ext = path.extname(entry.name);
          if (['.ts', '.tsx', '.js', '.jsx', '.py', '.rs', '.go', '.java'].includes(ext)) {
            relevantFiles.push(relativePath);
          }
        }
      }
    };

    await scanDir(workspacePath);

    return relevantFiles;
  }

  /**
   * 分析关键文件
   */
  private async analyzeKeyFiles(files: string[]): Promise<AnalyzedFile[]> {
    const analyzedFiles: AnalyzedFile[] = [];

    // 限制分析文件数量
    const filesToAnalyze = files.slice(0, 20);

    for (const filePath of filesToAnalyze) {
      try {
        const content = await fs.readFile(
          path.join(this.task.workspacePath, filePath),
          'utf-8'
        );

        // 简单分析文件内容
        const purpose = this.inferFilePurpose(content, filePath);
        const dependencies = this.extractDependencies(content);
        const exports = this.extractExports(content);

        analyzedFiles.push({
          path: filePath,
          purpose,
          dependencies,
          exports,
        });
      } catch (error) {
        // 忽略读取错误
      }
    }

    return analyzedFiles;
  }

  /**
   * 推断文件用途
   */
  private inferFilePurpose(content: string, filePath: string): string {
    const fileName = path.basename(filePath);

    if (fileName.includes('test') || fileName.includes('spec')) {
      return 'Test file';
    }
    if (fileName.includes('config')) {
      return 'Configuration';
    }
    if (content.includes('export default') || content.includes('module.exports')) {
      return 'Module';
    }
    if (content.includes('interface') || content.includes('type ')) {
      return 'Type definitions';
    }

    return 'Source code';
  }

  /**
   * 提取依赖
   */
  private extractDependencies(content: string): string[] {
    const dependencies: string[] = [];

    // 匹配 import 语句
    const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      if (!match[1].startsWith('.') && !match[1].startsWith('/')) {
        dependencies.push(match[1]);
      }
    }

    return [...new Set(dependencies)];
  }

  /**
   * 提取导出
   */
  private extractExports(content: string): string[] {
    const exports: string[] = [];

    // 匹配 export 语句
    const exportRegex = /export\s+(?:default\s+)?(?:class|function|const|interface|type)\s+(\w+)/g;
    let match;
    while ((match = exportRegex.exec(content)) !== null) {
      exports.push(match[1]);
    }

    return exports;
  }

  /**
   * 检测测试命令
   */
  private async detectTestCommands(): Promise<string[]> {
    const commands: string[] = [];

    try {
      const packageJsonPath = path.join(this.task.workspacePath, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

      if (packageJson.scripts?.test) {
        commands.push('npm test');
      }
      if (packageJson.scripts?.['test:unit']) {
        commands.push('npm run test:unit');
      }
    } catch (error) {
      // 忽略错误
    }

    return commands;
  }

  /**
   * 执行修复
   */
  private async executeFix(fix: TodoItem): Promise<void> {
    // 实现修复逻辑
  }

  /**
   * 执行工具调用
   */
  private async executeToolCall(toolCall: AgentToolCall): Promise<any> {
    // 实际执行工具调用
    return { success: true };
  }

  /**
   * 检查是否需要确认
   */
  private requiresConfirmation(toolCall: AgentToolCall): boolean {
    const { toolName, params } = toolCall;

    if (toolName === 'write_file' || toolName === 'edit_file') {
      return true;
    }

    if (toolName === 'terminal') {
      const command = params.command || '';
      // 检查是否在白名单中
      const whitelist = this.config.behavior.commandWhitelist || [];
      return !whitelist.some(cmd => command.startsWith(cmd));
    }

    return false;
  }

  /**
   * 获取确认类型
   */
  private getConfirmationType(toolCall: AgentToolCall): ConfirmationRequest['type'] {
    const { toolName } = toolCall;

    if (toolName === 'write_file') return 'file_write';
    if (toolName === 'edit_file') return 'file_edit';
    if (toolName === 'terminal') return 'command_execute';

    return 'tool_call';
  }

  /**
   * 获取确认描述
   */
  private getConfirmationDescription(toolCall: AgentToolCall): string {
    const { toolName, params } = toolCall;

    switch (toolName) {
      case 'write_file':
        return `写入文件: ${params.path}`;
      case 'edit_file':
        return `编辑文件: ${params.path}`;
      case 'terminal':
        return `执行命令: ${params.command}`;
      default:
        return `执行工具: ${toolName}`;
    }
  }

  /**
   * 设置当前阶段
   */
  private setPhase(phase: SoloPhase): void {
    this.state.currentPhase = phase;
  }

  /**
   * 获取用户输入
   */
  private getUserInput(): string {
    const lastUserMessage = this.task.messages
      .filter(m => m.role === 'user')
      .pop();
    return lastUserMessage?.content || this.task.description || '';
  }

  // ==================== 提示词构建 ====================

  private buildRequirementAnalysisPrompt(userInput: string): string {
    return `You are an expert software analyst. Analyze the following user requirement and extract structured information.

User Input:
${userInput}

Please analyze and provide:
1. Main goal/objective
2. Functional requirements (list each with priority: high/medium/low)
3. Non-functional requirements (performance, security, etc.)
4. Constraints or limitations
5. Success criteria

Format your response as JSON:
{
  "goal": "...",
  "functionalRequirements": [
    {"id": "1", "description": "...", "priority": "high"}
  ],
  "nonFunctionalRequirements": [...],
  "constraints": [...],
  "successCriteria": [...]
}`;
  }

  private buildArchitectureDesignPrompt(): string {
    const requirements = this.state.context.requirements || [];
    const projectType = this.state.context.projectType || 'unknown';

    return `You are a software architect. Design the system architecture based on the following context.

Project Type: ${projectType}
Requirements:
${requirements.map(r => `- ${r.description}`).join('\n')}

Please provide:
1. High-level architecture overview
2. Component breakdown
3. Data flow description
4. Technology stack recommendations
5. File structure proposal

Format your response as JSON:
{
  "overview": "...",
  "components": [
    {"name": "...", "description": "...", "responsibilities": [...]}
  ],
  "dataFlow": "...",
  "techStack": [...],
  "fileStructure": [...]
}`;
  }

  private buildTaskPlanningPrompt(): string {
    const requirements = this.state.context.requirements || [];
    const architecture = this.state.context;

    return `You are a project manager. Create a detailed task plan based on the requirements and architecture.

Requirements:
${requirements.map(r => `- [${r.priority}] ${r.description}`).join('\n')}

Please create a task plan with:
1. Break down into small, actionable tasks
2. Identify dependencies between tasks
3. Estimate complexity (high/medium/low)
4. Order tasks by priority and dependencies

Format your response as JSON:
{
  "tasks": [
    {
      "id": "1",
      "content": "...",
      "priority": "high",
      "dependsOn": [],
      "complexity": "medium"
    }
  ]
}`;
  }

  private buildTodoExecutionPrompt(todoItem: TodoItem): string {
    const context = this.state.context;

    return `You are an expert developer. Implement the following task.

Task: ${todoItem.content}

Project Context:
- Type: ${context.projectType}
- Tech Stack: ${context.techStack?.join(', ')}

Instructions:
1. Analyze what needs to be done
2. Use appropriate tools to read existing files if needed
3. Write or modify code following best practices
4. Ensure code is complete and functional
5. Add comments where necessary

Use tools to complete the task. Available tools:
- read_file: Read file content
- write_file: Create new file
- edit_file: Modify existing file
- list_files: List directory contents
- search: Search for patterns in files
- terminal: Execute terminal commands

Think step by step and explain your approach.`;
  }

  private buildCodeReviewPrompt(): string {
    return `You are a code reviewer. Review the code that was just implemented.

Please check for:
1. Code quality and best practices
2. Potential bugs or issues
3. Security concerns
4. Performance optimizations
5. Missing error handling
6. Incomplete implementations

Format your response as JSON:
{
  "issues": [
    {
      "severity": "high|medium|low",
      "description": "...",
      "file": "...",
      "suggestion": "..."
    }
  ],
  "summary": "..."
}`;
  }

  private buildDocumentationPrompt(): string {
    return `You are a technical writer. Generate documentation for the implemented feature.

Please create:
1. README section describing the feature
2. API documentation (if applicable)
3. Usage examples
4. Any important notes or caveats

Format your response as JSON:
{
  "docs": [
    {
      "path": "...",
      "content": "..."
    }
  ]
}`;
  }

  // ==================== 解析方法 ====================

  private parseRequirements(content: string): Requirement[] {
    try {
      const json = this.extractJSON(content);
      if (json?.functionalRequirements) {
        return json.functionalRequirements.map((r: any, i: number) => ({
          id: r.id || `req-${i}`,
          description: r.description,
          priority: r.priority || 'medium',
          status: 'pending',
        }));
      }
    } catch (error) {
      // 解析失败，返回空数组
    }
    return [];
  }

  private parseArchitecture(content: string): any {
    try {
      return this.extractJSON(content);
    } catch (error) {
      return {};
    }
  }

  private parseTodoItems(content: string): TodoItem[] {
    try {
      const json = this.extractJSON(content);
      if (json?.tasks) {
        return json.tasks.map((t: any) => ({
          id: t.id || `todo-${Date.now()}-${Math.random()}`,
          content: t.content,
          status: 'pending',
          priority: t.priority || 'medium',
          dependsOn: t.dependsOn || [],
        }));
      }
    } catch (error) {
      // 解析失败，返回空数组
    }
    return [];
  }

  private parseToolCalls(content: string): AgentToolCall[] {
    // 解析工具调用
    const toolCalls: AgentToolCall[] = [];

    // 匹配工具调用模式
    const toolRegex = /<tool>([\s\S]*?)<\/tool>/g;
    let match;

    while ((match = toolRegex.exec(content)) !== null) {
      try {
        const toolData = JSON.parse(match[1]);
        toolCalls.push({
          id: toolData.id || `tool-${Date.now()}-${Math.random()}`,
          toolName: toolData.name,
          params: toolData.params,
          status: 'running',
        });
      } catch (error) {
        // 忽略解析错误
      }
    }

    return toolCalls;
  }

  private parseCodeReview(content: string): { issues: any[]; summary: string } {
    try {
      const json = this.extractJSON(content);
      return {
        issues: json?.issues || [],
        summary: json?.summary || '',
      };
    } catch (error) {
      return { issues: [], summary: '' };
    }
  }

  private parseDocumentation(content: string): Array<{ path: string; content: string }> {
    try {
      const json = this.extractJSON(content);
      return json?.docs || [];
    } catch (error) {
      return [];
    }
  }

  private extractJSON(content: string): any {
    // 尝试提取 JSON 块
    const jsonRegex = /```json\n([\s\S]*?)\n```/;
    const match = content.match(jsonRegex);

    if (match) {
      return JSON.parse(match[1]);
    }

    // 尝试直接解析整个内容
    try {
      return JSON.parse(content);
    } catch (error) {
      // 失败
    }

    throw new Error('No JSON found in content');
  }

  /**
   * 生成执行摘要
   */
  private generateExecutionSummary(): any {
    return {
      totalSteps: this.state.totalSteps,
      completedSteps: this.state.currentStep,
      phasesCompleted: this.state.checkpoints.length,
      filesModified: this.task.generatedFiles.length,
      requirements: this.state.context.requirements?.length || 0,
      duration: Date.now() - this.task.createdAt,
    };
  }
}

export default SoloExecutor;
