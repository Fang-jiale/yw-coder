/**
 * Agent 策略接口
 * 定义不同 Agent 运行模式的通用接口
 */

import type { AgentContextData } from '../core/AgentContext';
import type { AgentTask, AgentMessage, AgentStep } from '../../../shared/agentTypes';
import type { AIProviderConfig } from '../../../shared/types';

export type StrategyType = 'chat' | 'builder' | 'solo' | 'solocoder';

export interface StrategyCallbacks {
  onProgress?: (message: string) => void;
  onThinking?: (thinking: string) => void;
  onStepStart?: (step: AgentStep) => void;
  onStepComplete?: (step: AgentStep) => void;
  onStepFail?: (step: AgentStep, error: string) => void;
  onMessage?: (message: AgentMessage) => void;
  onStreamContent?: (content: string) => void;
  onError?: (error: string) => void;
}

export interface StrategyContext {
  task: AgentTask;
  context: AgentContextData;
  callbacks: StrategyCallbacks;
  isPaused: boolean;
  isStopped: boolean;
  aiConfig?: AIProviderConfig;
}

export interface StrategyResult {
  success: boolean;
  messages: AgentMessage[];
  steps: AgentStep[];
  error?: string;
}

export interface AgentStrategy {
  readonly type: StrategyType;
  readonly name: string;
  readonly description: string;

  validate(context: StrategyContext): { valid: boolean; errors: string[] };

  execute(context: StrategyContext): Promise<StrategyResult>;

  canPause(): boolean;

  canResume(): boolean;

  canStop(): boolean;

  getEstimatedSteps(): number;

  getPrompt(context: StrategyContext): string;
}

export abstract class BaseStrategy implements AgentStrategy {
  abstract readonly type: StrategyType;
  abstract readonly name: string;
  abstract readonly description: string;

  protected abstract validateContext(context: StrategyContext): string[];

  validate(context: StrategyContext): { valid: boolean; errors: string[] } {
    const errors = this.validateContext(context);
    return {
      valid: errors.length === 0,
      errors,
    };
  }

  abstract execute(context: StrategyContext): Promise<StrategyResult>;

  canPause(): boolean {
    return this.type !== 'chat';
  }

  canResume(): boolean {
    return this.type !== 'chat';
  }

  canStop(): boolean {
    return true;
  }

  abstract getEstimatedSteps(): number;

  abstract getPrompt(context: StrategyContext): string;

  protected checkShouldStop(context: StrategyContext): void {
    if (context.isStopped) {
      throw new Error('Strategy execution stopped');
    }
  }

  protected checkShouldPause(context: StrategyContext): void | Promise<void> {
    if (context.isPaused) {
      return new Promise<void>((resolve) => {
        const checkPause = setInterval(() => {
          if (!context.isPaused) {
            clearInterval(checkPause);
            resolve();
          }
        }, 100);
      });
    }
  }

  protected createStep(
    id: string,
    type: AgentStep['type'],
    description: string
  ): AgentStep {
    return {
      id,
      type,
      description,
      status: 'pending',
    };
  }

  protected formatMessages(
    messages: AgentMessage[]
  ): Array<{ role: 'user' | 'assistant'; content: string }> {
    return messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));
  }
}
