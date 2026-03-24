/**
 * Solo 策略
 * 全流程自动化模式：规划 -> 自主执行 -> 验证
 */

import { BaseStrategy, type StrategyContext, type StrategyResult } from './AgentStrategy';
import type { AgentStep, AgentMessage, TodoItem } from '../../../shared/agentTypes';

interface PhaseResult {
  success: boolean;
  result?: string;
  messages?: AgentMessage[];
  todoItems?: TodoItem[];
  error?: string;
}

export class SoloStrategy extends BaseStrategy {
  readonly type = 'solo' as const;
  readonly name = 'SOLO';
  readonly description = 'Fully automated development mode with planning, execution, and verification';

  protected validateContext(context: StrategyContext): string[] {
    const errors: string[] = [];

    if (!context.context.taskDescription) {
      errors.push('Task description is required');
    }

    if (!context.context.workspacePath) {
      errors.push('Workspace path is required');
    }

    return errors;
  }

  async execute(context: StrategyContext): Promise<StrategyResult> {
    const { task, callbacks, isPaused, isStopped } = context;
    const messages: AgentMessage[] = [...task.messages];

    const validation = this.validate(context);
    if (!validation.valid) {
      return {
        success: false,
        messages,
        steps: [],
        error: validation.errors.join(', '),
      };
    }

    callbacks.onProgress?.('Starting SOLO mode...');

    try {
      const phase1Result = await this.executePlanningPhase(context);
      if (!phase1Result.success) {
        return {
          success: false,
          messages,
          steps: [],
          error: `Planning phase failed: ${phase1Result.error}`,
        };
      }

      if (isStopped) {
        return {
          success: false,
          messages,
          steps: [],
          error: 'Task stopped by user',
        };
      }

      const phase2Result = await this.executeExecutionPhase(context, phase1Result.todoItems || []);
      if (!phase2Result.success) {
        return {
          success: false,
          messages,
          steps: [],
          error: `Execution phase failed: ${phase2Result.error}`,
        };
      }

      if (isStopped) {
        return {
          success: false,
          messages,
          steps: [],
          error: 'Task stopped by user',
        };
      }

      const phase3Result = await this.executeVerificationPhase(context);
      if (!phase3Result.success) {
        return {
          success: false,
          messages,
          steps: [],
          error: `Verification phase failed: ${phase3Result.error}`,
        };
      }

      callbacks.onProgress?.('SOLO mode completed successfully!');

      return {
        success: true,
        messages: phase3Result.messages || messages,
        steps: [],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      callbacks.onError?.(errorMessage);

      return {
        success: false,
        messages,
        steps: [],
        error: errorMessage,
      };
    }
  }

  private async executePlanningPhase(context: StrategyContext): Promise<PhaseResult & { todoItems?: TodoItem[] }> {
    const { context: agentContext, callbacks, isPaused, isStopped } = context;

    callbacks.onProgress?.('Phase 1: Planning...');

    if (isPaused) await this.checkShouldPause(context);
    if (isStopped) return { success: false, error: 'Task stopped' };

    const analysisStep = this.createStep('analysis-1', 'analysis', 'Analyze requirements and project structure');
    analysisStep.status = 'in_progress';
    analysisStep.startTime = Date.now();
    callbacks.onStepStart?.(analysisStep);

    callbacks.onProgress?.('Analyzing project structure...');
    const analysisResult = await this.executeAnalysis(context);

    analysisStep.status = 'completed';
    analysisStep.endTime = Date.now();
    analysisStep.result = analysisResult;
    callbacks.onStepComplete?.(analysisStep);

    if (isPaused) await this.checkShouldPause(context);
    if (isStopped) return { success: false, error: 'Task stopped' };

    const planningStep = this.createStep('planning-1', 'planning', 'Create implementation plan');
    planningStep.status = 'in_progress';
    planningStep.startTime = Date.now();
    callbacks.onStepStart?.(planningStep);

    callbacks.onProgress?.('Creating implementation plan...');
    const planningResult = await this.executePlanning(context);

    planningStep.status = 'completed';
    planningStep.endTime = Date.now();
    planningStep.result = planningResult;
    callbacks.onStepComplete?.(planningStep);

    const todoItems = this.parseTodoItems(planningResult);

    return {
      success: true,
      result: planningResult,
      todoItems,
    };
  }

  private async executeExecutionPhase(context: StrategyContext, todoItems: TodoItem[]): Promise<PhaseResult> {
    const { context: agentContext, callbacks, isPaused, isStopped } = context;

    callbacks.onProgress?.('Phase 2: Execution...');

    if (isPaused) await this.checkShouldPause(context);
    if (isStopped) return { success: false, error: 'Task stopped' };

    const codingStep = this.createStep('coding-1', 'coding', 'Execute code generation');
    codingStep.status = 'in_progress';
    codingStep.startTime = Date.now();
    callbacks.onStepStart?.(codingStep);

    callbacks.onProgress?.('Generating code...');
    const codingResult = await this.executeCoding(context, todoItems);

    codingStep.status = 'completed';
    codingStep.endTime = Date.now();
    codingStep.result = codingResult;
    callbacks.onStepComplete?.(codingStep);

    if (isPaused) await this.checkShouldPause(context);
    if (isStopped) return { success: false, error: 'Task stopped' };

    const testingStep = this.createStep('testing-1', 'testing', 'Run tests and verify');
    testingStep.status = 'in_progress';
    testingStep.startTime = Date.now();
    callbacks.onStepStart?.(testingStep);

    callbacks.onProgress?.('Running tests...');
    const testingResult = await this.executeTesting(context);

    testingStep.status = 'completed';
    testingStep.endTime = Date.now();
    testingStep.result = testingResult;
    callbacks.onStepComplete?.(testingStep);

    return {
      success: true,
      result: `${codingResult}\n\n${testingResult}`,
    };
  }

  private async executeVerificationPhase(context: StrategyContext): Promise<PhaseResult> {
    const { context: agentContext, callbacks, isPaused, isStopped } = context;

    callbacks.onProgress?.('Phase 3: Verification...');

    if (isPaused) await this.checkShouldPause(context);
    if (isStopped) return { success: false, error: 'Task stopped' };

    const verificationStep = this.createStep('verification-1', 'verification', 'Verify final results');
    verificationStep.status = 'in_progress';
    verificationStep.startTime = Date.now();
    callbacks.onStepStart?.(verificationStep);

    callbacks.onProgress?.('Verifying results...');
    const verificationResult = await this.executeVerification(context);

    verificationStep.status = 'completed';
    verificationStep.endTime = Date.now();
    verificationStep.result = verificationResult;
    callbacks.onStepComplete?.(verificationStep);

    return {
      success: true,
      result: verificationResult,
    };
  }

  private async executeAnalysis(context: StrategyContext): Promise<string> {
    const { context: agentContext, callbacks } = context;
    const prompt = this.buildAnalysisPrompt(agentContext.taskDescription);

    let result = '';
    await this.executeAI(prompt, context, (chunk) => {
      if (chunk.type === 'content') {
        callbacks.onStreamContent?.(chunk.content || '');
        result += chunk.content || '';
      }
    });

    return result;
  }

  private async executePlanning(context: StrategyContext): Promise<string> {
    const { context: agentContext, callbacks } = context;
    const prompt = this.buildPlanningPrompt(agentContext.taskDescription);

    let result = '';
    await this.executeAI(prompt, context, (chunk) => {
      if (chunk.type === 'content') {
        callbacks.onStreamContent?.(chunk.content || '');
        result += chunk.content || '';
      }
    });

    return result;
  }

  private async executeCoding(context: StrategyContext, todoItems: TodoItem[]): Promise<string> {
    const { context: agentContext, callbacks } = context;
    const prompt = this.buildCodingPrompt(agentContext.taskDescription, todoItems);

    let result = '';
    await this.executeAI(prompt, context, (chunk) => {
      if (chunk.type === 'content') {
        callbacks.onStreamContent?.(chunk.content || '');
        result += chunk.content || '';
      }
    });

    return result;
  }

  private async executeTesting(context: StrategyContext): Promise<string> {
    const { callbacks } = context;
    const prompt = 'Run tests and verify the generated code works correctly.';

    let result = '';
    await this.executeAI(prompt, context, (chunk) => {
      if (chunk.type === 'content') {
        callbacks.onStreamContent?.(chunk.content || '');
        result += chunk.content || '';
      }
    });

    return result;
  }

  private async executeVerification(context: StrategyContext): Promise<string> {
    const { context: agentContext, callbacks } = context;
    const prompt = this.buildVerificationPrompt(agentContext.taskDescription);

    let result = '';
    await this.executeAI(prompt, context, (chunk) => {
      if (chunk.type === 'content') {
        callbacks.onStreamContent?.(chunk.content || '');
        result += chunk.content || '';
      }
    });

    return result;
  }

  private async executeAI(
    prompt: string,
    context: StrategyContext,
    onChunk: (chunk: any) => void
  ): Promise<void> {
    const { aiStreamService } = await import('../../services/aiStreamService');

    return new Promise((resolve, reject) => {
      aiStreamService.streamExecute(
        prompt,
        context.context.workspacePath,
        {} as any,
        (chunk: any) => {
          onChunk(chunk);
        }
      ).then(resolve).catch(reject);
    });
  }

  private parseTodoItems(planningResult: string): TodoItem[] {
    const todoItems: TodoItem[] = [];

    try {
      const jsonMatch = planningResult.match(/```json\n?([\s\S]*?)\n?```/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1]);
        if (parsed.todoItems && Array.isArray(parsed.todoItems)) {
          return parsed.todoItems.map((item: any, index: number) => ({
            id: item.id || `todo-${index}`,
            content: item.content || item.description || '',
            status: item.status || 'pending',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }));
        }
      }
    } catch (error) {
      console.error('Failed to parse todo items:', error);
    }

    const taskRegex = /<task[^>]*>([^<]*)<\/task>/gi;
    let match;
    let index = 0;

    while ((match = taskRegex.exec(planningResult)) !== null) {
      todoItems.push({
        id: `todo-${index++}`,
        content: match[1].trim(),
        status: 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    return todoItems;
  }

  private buildAnalysisPrompt(taskDescription: string): string {
    return `Analyze the following task and explore the project structure:

Task: ${taskDescription}

Please analyze:
1. Project type (React, Vue, Node.js, etc.)
2. Technology stack and dependencies
3. File structure
4. Core functionality modules
5. Existing code patterns`;
  }

  private buildPlanningPrompt(taskDescription: string): string {
    return `Create a detailed implementation plan for the following task:

Task: ${taskDescription}

Please provide a structured plan in JSON format:
{
  "todoItems": [
    {"id": "1", "content": "Task description", "status": "pending"}
  ],
  "steps": ["Step 1", "Step 2"],
  "estimatedTime": "X minutes"
}

Include all necessary implementation steps and file operations.`;
  }

  private buildCodingPrompt(taskDescription: string, todoItems: TodoItem[]): string {
    const todoList = todoItems
      .map((t) => `- [${t.status}] ${t.content}`)
      .join('\n');

    return `Implement the following tasks:

Task: ${taskDescription}

Todo List:
${todoList}

Please execute all tasks and provide detailed progress updates.`;
  }

  private buildVerificationPrompt(taskDescription: string): string {
    return `Verify the implementation for the following task:

Task: ${taskDescription}

Please verify:
1. All requirements are met
2. Code quality is good
3. No obvious bugs or issues
4. Tests pass successfully
5. Documentation is complete`;
  }

  getEstimatedSteps(): number {
    return 6;
  }

  getPrompt(context: StrategyContext): string {
    return `Task: ${context.context.taskDescription}

Execute SOLO mode:
1. Planning phase (analysis + planning)
2. Execution phase (coding + testing)
3. Verification phase (final verification)`;
  }
}
