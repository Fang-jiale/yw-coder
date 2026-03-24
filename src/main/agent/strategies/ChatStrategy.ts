/**
 * Chat 策略
 * 简单的问答模式，不执行复杂的步骤循环
 */

import { BaseStrategy, type StrategyContext, type StrategyResult, type StrategyCallbacks } from './AgentStrategy';
import type { AgentMessage, AgentStep } from '../../../shared/agentTypes';
import { aiStreamService, StreamChunk } from '../../services/aiStreamService';

export class ChatStrategy extends BaseStrategy {
  readonly type = 'chat' as const;
  readonly name = 'Chat';
  readonly description = 'Simple chat mode for question and answer';

  protected validateContext(context: StrategyContext): string[] {
    const errors: string[] = [];

    if (!context.task.messages || context.task.messages.length === 0) {
      errors.push('No messages in task');
    }

    const lastMessage = context.task.messages[context.task.messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'user') {
      errors.push('Last message must be from user');
    }

    if (!context.context.workspacePath) {
      errors.push('Workspace path is required');
    }

    return errors;
  }

  async execute(context: StrategyContext): Promise<StrategyResult> {
    const { task, context: agentContext, callbacks } = context;

    const validation = this.validate(context);
    if (!validation.valid) {
      return {
        success: false,
        messages: task.messages,
        steps: [],
        error: validation.errors.join(', '),
      };
    }

    const lastMessage = task.messages[task.messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'user') {
      return {
        success: false,
        messages: task.messages,
        steps: [],
        error: 'No user message to respond to',
      };
    }

    callbacks.onProgress?.('Generating response...');

    try {
      const assistantMessage = await this.streamResponse(
        lastMessage.content,
        agentContext.workspacePath,
        task.messages,
        callbacks
      );

      return {
        success: true,
        messages: [...task.messages, assistantMessage],
        steps: [],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      callbacks.onError?.(errorMessage);

      return {
        success: false,
        messages: task.messages,
        steps: [],
        error: errorMessage,
      };
    }
  }

  private async streamResponse(
    userMessage: string,
    workspacePath: string,
    history: AgentMessage[],
    callbacks: StrategyCallbacks,
    aiConfig?: any
  ): Promise<AgentMessage> {
    return new Promise((resolve, reject) => {
      let fullContent = '';
      let thinking = '';

      const handleChunk = (chunk: StreamChunk) => {
        switch (chunk.type) {
          case 'thinking':
            thinking += chunk.content || '';
            callbacks.onThinking?.(chunk.content || '');
            break;

          case 'content':
            fullContent += chunk.content || '';
            callbacks.onStreamContent?.(chunk.content || '');
            break;

          case 'done':
            const message: AgentMessage = {
              id: `msg-${Date.now()}`,
              role: 'assistant',
              content: fullContent,
              timestamp: Date.now(),
              thinking: thinking || undefined,
            };
            callbacks.onMessage?.(message);
            resolve(message);
            break;

          case 'error':
            reject(new Error(chunk.error));
            break;
        }
      };

      const formattedHistory = this.formatMessages(history.slice(0, -1));

      aiStreamService.streamExecute(
        this.buildPrompt(userMessage),
        workspacePath,
        aiConfig || {} as any,
        handleChunk,
        { history: formattedHistory }
      );
    });
  }

  private buildPrompt(userMessage: string): string {
    return `You are a helpful AI coding assistant. Please provide a clear and helpful response to the user's question.

User: ${userMessage}

Please answer the question helpfully.`;
  }

  getEstimatedSteps(): number {
    return 1;
  }

  getPrompt(context: StrategyContext): string {
    const lastMessage = context.task.messages[context.task.messages.length - 1];
    return this.buildPrompt(lastMessage?.content || '');
  }

  canPause(): boolean {
    return false;
  }

  canResume(): boolean {
    return false;
  }
}
