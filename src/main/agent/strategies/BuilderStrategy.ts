/**
 * Builder 策略
 * Plan-Build-Review 循环模式
 */

import { BaseStrategy, type StrategyContext, type StrategyResult } from './AgentStrategy';
import type { AgentStep, AgentMessage } from '../../../shared/agentTypes';

export class BuilderStrategy extends BaseStrategy {
  readonly type = 'builder' as const;
  readonly name = 'Builder';
  readonly description = 'Plan-Build-Review cycle mode for code development';

  private readonly steps: Array<{ id: string; type: AgentStep['type']; description: string }> = [
    { id: '1', type: 'analysis', description: 'Analyze task requirements and goals' },
    { id: '2', type: 'planning', description: 'Create implementation plan' },
    { id: '3', type: 'coding', description: 'Execute code generation' },
    { id: '4', type: 'review', description: 'Review code quality' },
  ];

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
    const executedSteps: AgentStep[] = [];
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

    try {
      for (const stepDef of this.steps) {
        if (isStopped) {
          return {
            success: false,
            messages,
            steps: executedSteps,
            error: 'Task stopped by user',
          };
        }

        if (isPaused) {
          await this.checkShouldPause(context);
        }

        const step = this.createStep(stepDef.id, stepDef.type, stepDef.description);
        step.status = 'in_progress';
        step.startTime = Date.now();

        callbacks.onStepStart?.(step);
        callbacks.onProgress?.(`Executing step: ${step.description}`);

        const result = await this.executeStep(step, context);

        if (!result.success) {
          step.status = 'failed';
          step.endTime = Date.now();
          callbacks.onStepFail?.(step, result.error || 'Step failed');

          return {
            success: false,
            messages,
            steps: [...executedSteps, step],
            error: result.error,
          };
        }

        step.status = 'completed';
        step.endTime = Date.now();
        step.result = result.result;

        executedSteps.push(step);
        callbacks.onStepComplete?.(step);

        if (result.messages) {
          messages.push(...result.messages);
        }
      }

      return {
        success: true,
        messages,
        steps: executedSteps,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      callbacks.onError?.(errorMessage);

      return {
        success: false,
        messages,
        steps: executedSteps,
        error: errorMessage,
      };
    }
  }

  private async executeStep(
    step: AgentStep,
    context: StrategyContext
  ): Promise<{ success: boolean; result?: string; messages?: AgentMessage[]; error?: string }> {
    switch (step.type) {
      case 'analysis':
        return this.executeAnalysisStep(context);
      case 'planning':
        return this.executePlanningStep(context);
      case 'coding':
        return this.executeCodingStep(context);
      case 'review':
        return this.executeReviewStep(context);
      default:
        return { success: false, error: `Unknown step type: ${step.type}` };
    }
  }

  private async executeAnalysisStep(
    context: StrategyContext
  ): Promise<{ success: boolean; result?: string; error?: string }> {
    const { context: agentContext, callbacks } = context;

    callbacks.onProgress?.('Analyzing project structure...');

    const prompt = this.buildAnalysisPrompt(agentContext.taskDescription);
    let result = '';

    try {
      result = await this.executeAI(prompt, context, (chunk) => {
        if (chunk.type === 'content') {
          callbacks.onStreamContent?.(chunk.content || '');
          result += chunk.content || '';
        }
      });

      return { success: true, result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async executePlanningStep(
    context: StrategyContext
  ): Promise<{ success: boolean; result?: string; error?: string }> {
    const { context: agentContext, callbacks } = context;

    callbacks.onProgress?.('Creating implementation plan...');

    const prompt = this.buildPlanningPrompt(agentContext.taskDescription);
    let result = '';

    try {
      result = await this.executeAI(prompt, context, (chunk) => {
        if (chunk.type === 'content') {
          callbacks.onStreamContent?.(chunk.content || '');
          result += chunk.content || '';
        }
      });

      return { success: true, result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async executeCodingStep(
    context: StrategyContext
  ): Promise<{ success: boolean; result?: string; error?: string }> {
    const { context: agentContext, callbacks } = context;

    callbacks.onProgress?.('Generating code...');

    const prompt = this.buildCodingPrompt(agentContext.taskDescription);
    let result = '';

    try {
      result = await this.executeAI(prompt, context, (chunk) => {
        if (chunk.type === 'content') {
          callbacks.onStreamContent?.(chunk.content || '');
          result += chunk.content || '';
        }
      });

      return { success: true, result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async executeReviewStep(
    context: StrategyContext
  ): Promise<{ success: boolean; result?: string; error?: string }> {
    const { context: agentContext, callbacks } = context;

    callbacks.onProgress?.('Reviewing code quality...');

    const prompt = this.buildReviewPrompt(agentContext.taskDescription);
    let result = '';

    try {
      result = await this.executeAI(prompt, context, (chunk) => {
        if (chunk.type === 'content') {
          callbacks.onStreamContent?.(chunk.content || '');
          result += chunk.content || '';
        }
      });

      return { success: true, result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async executeAI(
    prompt: string,
    context: StrategyContext,
    onChunk: (chunk: any) => void
  ): Promise<string> {
    const { aiStreamService } = await import('../../services/aiStreamService');

    // 获取 AI 配置，如果没有则抛出错误
    const aiConfig = context.aiConfig;
    if (!aiConfig) {
      throw new Error('AI configuration is required but not provided');
    }

    return new Promise((resolve, reject) => {
      let fullContent = '';

      aiStreamService.streamExecute(
        prompt,
        context.context.workspacePath,
        aiConfig,
        (chunk: any) => {
          onChunk(chunk);
          if (chunk.type === 'content') {
            fullContent += chunk.content || '';
          }
        },
        { history: [] }
      ).then(() => resolve(fullContent)).catch(reject);
    });
  }

  private buildAnalysisPrompt(taskDescription: string): string {
    return `Analyze the following task and provide insights about the project structure and requirements:

Task: ${taskDescription}

Please analyze:
1. Project type and structure
2. Technology stack
3. Key dependencies
4. Core functionality modules`;
  }

  private buildPlanningPrompt(taskDescription: string): string {
    return `Create a detailed implementation plan for the following task:

Task: ${taskDescription}

Please provide:
1. Step-by-step implementation plan
2. File structure changes
3. Key components to implement
4. Testing strategy`;
  }

  private buildCodingPrompt(taskDescription: string): string {
    return `Implement the code according to the following task:

Task: ${taskDescription}

Please generate complete, production-ready code with proper error handling and documentation.`;
  }

  private buildReviewPrompt(taskDescription: string): string {
    return `Review the generated code for the following task:

Task: ${taskDescription}

Please check:
1. Code quality and best practices
2. Potential bugs or issues
3. Performance considerations
4. Security concerns`;
  }

  getEstimatedSteps(): number {
    return this.steps.length;
  }

  getPrompt(context: StrategyContext): string {
    return `Task: ${context.context.taskDescription}

Execute the Builder strategy with the following steps:
${this.steps.map((s, i) => `${i + 1}. ${s.description}`).join('\n')}`;
  }
}
