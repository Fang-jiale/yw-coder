import OpenAI from 'openai';
import type { Stream } from 'openai/streaming';
import * as fs from 'fs/promises';
import * as path from 'path';
import { AIProviderConfig, ModelCapability, ContextPolicy, getEffectiveContextBudget, UserContextPreference, StreamEventItem } from '../../shared/types';
import { PREDEFINED_PROVIDERS } from './aiService';
import { AIToolService, ToolCall, ToolResult, TOOLS, ToolName } from './aiToolService';
import { logger } from '../utils/logger';

export interface StreamChunk {
  type: 'thinking' | 'thinking_complete' | 'content' | 'tool_call' | 'tool_result' | 'tool_start' | 'tool_end' | 'done' | 'error' | 'todo_update' | 'agent_question';
  content?: string;
  toolCall?: ToolCall;
  toolResult?: ToolResult;
  toolName?: string;
  toolParams?: Record<string, any>;
  toolCallId?: string;
  error?: string;
  // 待办清单更新
  todoItems?: Array<{
    id: string;
    content: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
  }>;
  // 智能体提问
  question?: {
    id: string;
    question: string;
    context?: string;
    options?: Array<{
      id: string;
      label: string;
      value: string;
    }>;
  };
  // 标准化的流式事件（用于事件流驱动渲染）
  streamEvent?: StreamEventItem;
}

export type StreamCallback = (chunk: StreamChunk) => void;

interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_call_id?: string;
  tool_calls?: any[];
}

// 默认上下文长度
const DEFAULT_CONTEXT_LENGTH = 4000;
// 系统提示词预留长度
const SYSTEM_PROMPT_RESERVE = 1000;
// 工具结果预留长度
const TOOL_RESULT_RESERVE = 2000;

// 预算管理常量
const BUDGET_CONFIG = {
  // 预留的 completion tokens（模型输出空间）
  // 根据上下文长度动态调整，默认 8000
  reservedCompletionTokens: 8000,
  // 预留的工具调用空间
  reservedToolTokens: 2000,
  // 安全边距 tokens
  safetyMarginTokens: 500,
};

// Token 预算接口
interface TokenBudget {
  // 总预算（模型上下文窗口）
  totalBudget: number;
  // 系统提示词占用
  systemPromptTokens: number;
  // 预留的 completion tokens
  reservedCompletionTokens: number;
  // 预留的工具调用空间
  reservedToolTokens: number;
  // 安全边距
  safetyMarginTokens: number;
  // history 可用预算 = total - system - completion - tool - safety
  promptBudgetTokens: number;
  // 实际设置的 max_tokens
  maxTokens: number;
}

// 默认模型能力配置 (32KB)
const DEFAULT_MODEL_CAPABILITY: ModelCapability = {
  modelId: 'default',
  maxContextWindow: 32768,
};

// 默认上下文策略 (固定 32KB)
const DEFAULT_CONTEXT_POLICY: ContextPolicy = {
  defaultBudget: 32768,
  maxAllowedBudget: 32768,
  mode: 'conservative',
};

/**
 * 检查模型是否支持 Function Call
 */
function detectFunctionCallSupport(model: string, config?: AIProviderConfig): boolean {
  // 如果配置中明确指定了，使用配置值
  if (config?.supportsFunctionCall !== undefined) {
    return config.supportsFunctionCall;
  }

  // 自动检测
  const supportedModels = [
    'gpt-4', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo',
    'claude-3', 'claude-3-5', 'claude-3-sonnet', 'claude-3-opus',
    'qwen2', 'qwen2.5', 'qwen-max', 'qwen-plus',
    'deepseek-chat', 'deepseek-coder',
    'glm-4', 'glm-4-plus',
    'minimax', 'minimax-m2',
  ];

  const lowerModel = model.toLowerCase();
  return supportedModels.some(m => lowerModel.includes(m));
}

/**
 * 获取模型上下文长度
 */
function getContextLength(config: AIProviderConfig): number {
  if (config.contextLength) {
    return config.contextLength;
  }

  // 根据模型自动推断
  const model = config.model.toLowerCase();
  if (model.includes('gpt-4o') || model.includes('claude-3')) {
    return 128000;
  }
  if (model.includes('gpt-4')) {
    return 8000;
  }
  if (model.includes('gpt-3.5')) {
    return 4000;
  }
  if (model.includes('qwen2.5') || model.includes('qwen-max')) {
    return 32000;
  }
  if (model.includes('deepseek')) {
    return 64000;
  }

  return DEFAULT_CONTEXT_LENGTH;
}

/**
 * 估算消息的 token 数量（简化估算：1 token ≈ 4 字符）
 */
function estimateTokens(content: string): number {
  return Math.ceil(content.length / 4);
}

/**
 * 计算 Token 预算
 * @param totalBudget 总预算（模型上下文窗口）
 * @param systemPromptContent 系统提示词内容（不是长度）
 * @param config 预算配置
 * @returns TokenBudget 预算分配结果
 */
function calculateTokenBudget(
  totalBudget: number,
  systemPromptContent: string,
  config: typeof BUDGET_CONFIG = BUDGET_CONFIG
): TokenBudget {
  // 基于真实 system prompt 内容估算 tokens
  const systemPromptTokens = estimateTokens(systemPromptContent || '');

  // 计算 history 可用预算
  const promptBudgetTokens = Math.max(0,
    totalBudget
    - systemPromptTokens
    - config.reservedCompletionTokens
    - config.reservedToolTokens
    - config.safetyMarginTokens
  );

  const budget: TokenBudget = {
    totalBudget,
    systemPromptTokens,
    reservedCompletionTokens: config.reservedCompletionTokens,
    reservedToolTokens: config.reservedToolTokens,
    safetyMarginTokens: config.safetyMarginTokens,
    promptBudgetTokens,
    maxTokens: config.reservedCompletionTokens,
  };

  return budget;
}

/**
 * 打印预算日志
 */
function logTokenBudget(budget: TokenBudget, traceId: string): void {
  logger.info('token_budget_calculated', {
    traceId,
    totalBudget: budget.totalBudget,
    systemPromptTokens: budget.systemPromptTokens,
    reservedCompletionTokens: budget.reservedCompletionTokens,
    reservedToolTokens: budget.reservedToolTokens,
    safetyMarginTokens: budget.safetyMarginTokens,
    promptBudgetTokens: budget.promptBudgetTokens,
    maxTokens: budget.maxTokens,
    availableForHistory: budget.promptBudgetTokens,
  });
}

/**
 * 裁剪历史消息以适应上下文长度
 * @param messages 历史消息列表
 * @param promptBudgetTokens history 可用预算（来自 calculateTokenBudget）
 * @param traceId 用于日志追踪
 * @returns 裁剪后的消息列表
 */
function trimHistoryMessages(
  messages: Message[],
  promptBudgetTokens: number,
  traceId: string
): Message[] {
  let currentTokens = 0;
  const trimmedMessages: Message[] = [];

  logger.info('trim_history_start', {
    traceId,
    inputMessageCount: messages.length,
    promptBudgetTokens,
  });

  // 从后往前遍历，保留最近的消息
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const msgTokens = estimateTokens(msg.content || '');

    if (currentTokens + msgTokens > promptBudgetTokens) {
      // 如果超出限制，停止添加
      logger.info('trim_history_stopped', {
        traceId,
        stoppedAtIndex: i,
        currentTokens,
        newMessageTokens: msgTokens,
        budgetExceeded: true,
      });
      break;
    }

    trimmedMessages.unshift(msg);
    currentTokens += msgTokens;
  }

  logger.info('trim_history_complete', {
    traceId,
    outputMessageCount: trimmedMessages.length,
    totalTokens: currentTokens,
    trimmedCount: messages.length - trimmedMessages.length,
  });

  return trimmedMessages;
}

/**
 * 生成工具使用说明的系统提示词
 */
function generateToolsSystemPrompt(tools: typeof TOOLS): string {
  const toolsDescription = tools
    .map(
      (tool) => `
## ${tool.name}
${tool.description}

参数:
${JSON.stringify(tool.parameters, null, 2)}

使用格式:
<function_calls>
<invoke name="${tool.name}">
${Object.keys(tool.parameters.properties || {}).map((key) => `<parameter name="${key}">${key}的值</parameter>`).join('\n')}
</invoke>
</function_calls>`
    )
    .join('\n\n');

  return `你可以使用以下工具来帮助用户:

${toolsDescription}

使用规则:
1. 当你需要使用工具时，请使用上述 XML 格式
2. 你可以一次使用多个工具
3. 工具执行结果会返回给你，你可以根据结果继续操作
4. 如果不需要工具，直接回答用户问题即可`;
}

/**
 * AI Stream Service - 支持流式输出和工具调用的 AI 服务
 */
export class AIStreamService {
  private clients: Map<string, OpenAI> = new Map();

  private getClient(config: AIProviderConfig): OpenAI {
    const providerInfo = PREDEFINED_PROVIDERS[config.provider];
    const baseURL = config.baseUrl || providerInfo?.defaultBaseUrl || 'https://api.openai.com/v1';

    // 创建客户端缓存 key，包含关键配置信息
    const cacheKey = `${config.id}-${baseURL}-${config.apiKey.substring(0, 10)}`;

    if (this.clients.has(cacheKey)) {
      return this.clients.get(cacheKey)!;
    }

    // MiniMax 需要 GroupId header
    const defaultHeaders = config.provider === 'minimax' && config.groupId ? {
      'GroupId': config.groupId,
    } : undefined;

    console.log('[AIStreamService] Creating OpenAI client:', {
      provider: config.provider,
      baseURL,
      apiKey: config.apiKey ? `${config.apiKey.substring(0, 10)}...` : 'empty',
      groupId: config.groupId || 'not set',
      defaultHeaders,
    });

    const client = new OpenAI({
      apiKey: config.apiKey,
      baseURL,
      timeout: 120000,
      defaultHeaders,
    });

    this.clients.set(cacheKey, client);
    return client;
  }

  private getModel(config: AIProviderConfig): string {
    const providerInfo = PREDEFINED_PROVIDERS[config.provider];
    return config.model || providerInfo?.defaultModel || 'gpt-4o';
  }

  /**
   * 提取思考过程和内容
   * 支持 <think>...</think> 格式
   */
  private parseThinking(content: string): { thinking: string; content: string } {
    const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/);
    if (thinkMatch) {
      return {
        thinking: thinkMatch[1].trim(),
        content: content.replace(/<think>[\s\S]*?<\/think>/, '').trim(),
      };
    }
    return { thinking: '', content };
  }

  /**
   * 过滤工具调用标签，保留干净的内容
   */
  private filterToolCalls(content: string): string {
    if (!content) return '';

    return content
      // 过滤各种工具调用标签（包括带属性的变体）
      .replace(/<tool[\s\S]*?<\/tool>/g, '')
      .replace(/<tool_call[\s\S]*?<\/tool_call>/g, '')

      .replace(/<function_calls>[\s\S]*?<\/function_calls>/g, '')
      // 过滤带属性的 invoke 标签
      .replace(/<invoke\s+[^>]*>[\s\S]*?<\/invoke>/g, '')
      // 过滤 parameter 标签
      .replace(/<parameter\s+[^>]*>[\s\S]*?<\/parameter>/g, '')
      // 过滤 question 标签（用于主动提问）
      .replace(/<question>[\s\S]*?<\/question>/g, '')
      // 过滤 option 标签
      .replace(/<option\s+[^>]*>[\s\S]*?<\/option>/g, '')
      // 过滤 todo 标签（用于任务管理）
      .replace(/<todo>[\s\S]*?<\/todo>/g, '')
      // 过滤 task 标签
      .replace(/<task\s+[^>]*>[\s\S]*?<\/task>/g, '')
      // 过滤思考标签（兜底过滤，防止状态机处理失败时暴露）
      .replace(/<think>[\s\S]*?<\/think>/g, '')
      // 过滤可能未闭合的标签开头
      .replace(/<\/?tool[^>]*$/g, '')
      .replace(/<\/?tool_call[^>]*$/g, '')
      .replace(/<\/?function_calls[^>]*$/g, '')
      .replace(/<\/?invoke[^>]*$/g, '')
      .replace(/<\/?parameter[^>]*$/g, '')
      .replace(/<\/?question[^>]*$/g, '')
      .replace(/<\/?option[^>]*$/g, '')
      .replace(/<\/?todo[^>]*$/g, '')
      .replace(/<\/?task[^>]*$/g, '')
      .replace(/<\/?think[^>]*$/g, '')
      // 过滤 JSON 代码块
      .replace(/```json\s*[\s\S]*?```/g, '')
      // 清理多余空行
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * 解析 OpenAI 格式的 function_calls
   */
  private parseFunctionCalls(content: string): ToolCall[] {
    const toolCalls: ToolCall[] = [];

    // 匹配 <function_calls>...</function_calls>
    const functionCallsRegex = /<function_calls>([\s\S]*?)<\/function_calls>/g;
    let match;

    while ((match = functionCallsRegex.exec(content)) !== null) {
      const functionCallsBlock = match[1];

      // 匹配 <invoke name="...">...</invoke>
      const invokeRegex = /<invoke\s+name="([^"]+)">([\s\S]*?)<\/invoke>/g;
      let invokeMatch;

      while ((invokeMatch = invokeRegex.exec(functionCallsBlock)) !== null) {
        const toolName = invokeMatch[1];
        const invokeContent = invokeMatch[2];

        // 解析参数
        const params: Record<string, any> = {};
        const paramRegex = /<parameter\s+name="([^"]+)">([\s\S]*?)<\/parameter>/g;
        let paramMatch;

        while ((paramMatch = paramRegex.exec(invokeContent)) !== null) {
          const paramName = paramMatch[1];
          const paramValue = paramMatch[2].trim();
          params[paramName] = paramValue;
        }

        toolCalls.push({
          tool: toolName as ToolName,
          params,
        });
      }
    }

    return toolCalls;
  }

  /**
   * 处理内容：提取思考过程并过滤工具调用
   */
  private processContent(content: string): { thinking: string; cleanContent: string } {
    // 先提取思考过程
    const { thinking, content: afterThink } = this.parseThinking(content);

    // 再过滤工具调用
    const cleanContent = this.filterToolCalls(afterThink);

    return { thinking, cleanContent };
  }

  /**
   * 检查 JSON 是否可能被截断
   * @param jsonStr JSON 字符串
   * @param finishReason 流式响应的 finish_reason
   * @returns 是否高概率被截断
   */
  private isLikelyTruncatedJson(jsonStr: string, finishReason: string | null): boolean {
    if (!jsonStr || jsonStr.length === 0) return true;

    // 检查括号平衡
    let braceCount = 0;
    let bracketCount = 0;
    let inString = false;
    let escaped = false;

    for (const char of jsonStr) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === '"' && !escaped) {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (char === '{') braceCount++;
        if (char === '}') braceCount--;
        if (char === '[') bracketCount++;
        if (char === ']') bracketCount--;
      }
    }

    // 特征1: 明确因长度限制停止（最强信号）
    const isLengthLimited = finishReason === 'length';

    // 特征2: 括号不平衡
    const hasUnbalancedBrackets = braceCount !== 0 || bracketCount !== 0;

    // 特征3: 引号未闭合
    const hasUnclosedString = inString;

    // 特征4: 以明显的中间状态结束
    const lastChar = jsonStr.trim().slice(-1);
    const endsMidField = lastChar === ',' || lastChar === ':' || lastChar === '"' || lastChar === '\\';

    // 特征5: 末尾是半个关键字或值
    const endsMidToken = /[:\s,\[\{]$/.test(jsonStr.trim()) ||
                         jsonStr.trim().endsWith('true') ||
                         jsonStr.trim().endsWith('false') ||
                         jsonStr.trim().endsWith('null');

    // 截断判定：必须满足 finishReason === 'length' 或至少两个结构特征
    const structuralSigns = [
      hasUnbalancedBrackets,
      hasUnclosedString,
      endsMidField,
      endsMidToken
    ].filter(Boolean).length;

    // 高概率截断的条件：
    // 1. 明确因长度限制停止
    // 2. 或同时满足：括号不平衡 + 其他任一结构特征
    // 3. 或同时满足：引号未闭合 + finishReason === 'length'
    const isLikelyTruncated = isLengthLimited ||
                              (hasUnbalancedBrackets && structuralSigns >= 2) ||
                              (hasUnclosedString && isLengthLimited);

    // 如果结构完整但解析失败，可能是格式错误而非截断
    if (!isLikelyTruncated) {
      try {
        JSON.parse(jsonStr);
        return false;
      } catch {
        // 结构完整但解析失败，认为是格式错误，不进入补救
        return false;
      }
    }

    return true;
  }

  /**
   * 补救截断的工具参数
   */
  private async remediateTruncatedArguments(
    toolCall: any,
    messages: Message[],
    client: OpenAI,
    model: string,
    requestParams: any,
    traceId: string,
    roundCount: number,
    finishReason: string | null,
    baseSystemPrompt: string,
    contextLength: number,
    maxAttempts: number = 3
  ): Promise<{ success: boolean; parsedArgs?: any; attempts: number; error?: string }> {
    const args = toolCall.function.arguments;

    // 首先检查是否真的被截断（传入 finishReason 进行更精确的判断）
    if (!this.isLikelyTruncatedJson(args, finishReason)) {
      return {
        success: false,
        attempts: 0,
        error: 'Arguments do not appear to be truncated (finishReason: ' + finishReason + '), parse error may be due to other reasons',
      };
    }

    logger.info('tool_arguments_truncation_detected', {
      traceId,
      toolCallId: toolCall.id,
      functionName: toolCall.function.name,
      argumentsLength: args.length,
      finishReason,
    });

    // 使用统一的预算系统计算补救请求的预算
    const budget = calculateTokenBudget(contextLength, baseSystemPrompt);
    logTokenBudget(budget, traceId);

    // 1. 先估算 remediation 附加消息的 token 开销
    const remediationUserInstruction = `你刚才调用的 ${toolCall.function.name} 工具参数似乎被截断了（参数长度：${args.length}）。请继续完成这个工具调用，提供完整的 JSON 参数。注意：不要重复已经输出的内容，只需补充缺失的部分。`;
    const assistantToolCallMessage = JSON.stringify({
      role: 'assistant',
      content: null,
      tool_calls: [{
        id: toolCall.id,
        type: 'function',
        function: {
          name: toolCall.function.name,
          arguments: args,
        },
      }],
    });

    const remediationOverheadTokens =
      estimateTokens(assistantToolCallMessage) +
      estimateTokens(remediationUserInstruction);

    // 2. 计算实际可用的 history 预算（减去 remediation 附加消息的开销）
    const availableHistoryBudget = Math.max(0, budget.promptBudgetTokens - remediationOverheadTokens);

    // 3. 用 availableHistoryBudget 裁剪历史消息
    const trimmedMessagesForRemediation = trimHistoryMessages(
      messages,
      availableHistoryBudget,
      traceId
    );

    // 4. 构建补救消息：system + 裁剪后的历史 + assistant(截断的tool_call) + user(补救指令)
    // 确保总 prompt token 不超过预算
    const remediationMessages: Message[] = [
      { role: 'system', content: baseSystemPrompt },
      ...trimmedMessagesForRemediation,
      {
        role: 'assistant',
        content: null,
        tool_calls: [{
          id: toolCall.id,
          type: 'function',
          function: {
            name: toolCall.function.name,
            arguments: args,
          },
        }],
      },
      {
        role: 'user',
        content: remediationUserInstruction,
      },
    ];

    // 计算最终的 prompt tokens
    const finalPromptTokens =
      budget.systemPromptTokens +
      trimmedMessagesForRemediation.reduce((sum, m) => sum + estimateTokens(m.content || ''), 0) +
      remediationOverheadTokens;

    logger.info('tool_arguments_remediation_budget_calculated', {
      traceId,
      toolCallId: toolCall.id,
      remediationOverheadTokens,
      availableHistoryBudget,
      promptBudgetTokens: budget.promptBudgetTokens,
      finalPromptTokens,
      maxTokens: budget.maxTokens,
      originalMessagesCount: messages.length,
      trimmedMessagesCount: trimmedMessagesForRemediation.length,
    });

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        logger.info('tool_arguments_remediation_attempt', {
          traceId,
          toolCallId: toolCall.id,
          attempt,
          maxAttempts,
        });

        // 补救请求使用统一的预算逻辑
        const remediationResponse = await client.chat.completions.create({
          model,
          messages: remediationMessages as any,
          stream: false,
          max_tokens: budget.maxTokens, // 使用统一预算中的 maxTokens
          temperature: 0.3,
        });

        const completion = remediationResponse.choices[0]?.message;
        if (completion?.tool_calls && completion.tool_calls.length > 0) {
          const newToolCall = completion.tool_calls[0];
          const newArgs = newToolCall.function?.arguments;

          if (newArgs) {
            try {
              const parsedArgs = JSON.parse(newArgs);
              logger.info('tool_arguments_remediation_success', {
                traceId,
                toolCallId: toolCall.id,
                attempt,
              });
              return { success: true, parsedArgs, attempts: attempt };
            } catch (parseError) {
              logger.warn('tool_arguments_remediation_parse_failed', {
                traceId,
                toolCallId: toolCall.id,
                attempt,
                error: parseError instanceof Error ? parseError.message : String(parseError),
              });
              // 继续下一次尝试
            }
          }
        }

        // 如果没有返回 tool_calls，尝试从 content 中解析
        if (completion?.content) {
          try {
            // 尝试直接解析 content 作为 JSON
            const parsedArgs = JSON.parse(completion.content);
            logger.info('tool_arguments_remediation_success_from_content', {
              traceId,
              toolCallId: toolCall.id,
              attempt,
            });
            return { success: true, parsedArgs, attempts: attempt };
          } catch {
            // 尝试从 content 中提取 JSON
            const jsonMatch = completion.content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              try {
                const parsedArgs = JSON.parse(jsonMatch[0]);
                logger.info('tool_arguments_remediation_success_from_content_json', {
                  traceId,
                  toolCallId: toolCall.id,
                  attempt,
                });
                return { success: true, parsedArgs, attempts: attempt };
              } catch {
                // 继续下一次尝试
              }
            }
          }
        }
      } catch (error) {
        logger.error('tool_arguments_remediation_error', {
          traceId,
          toolCallId: toolCall.id,
          attempt,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      success: false,
      attempts: maxAttempts,
      error: `Failed to remediate truncated arguments after ${maxAttempts} attempts`,
    };
  }

  /**
   * 流式执行 AI 对话，支持工具调用和多轮对话
   */
  async streamExecute(
    userInput: string,
    workspacePath: string,
    config: AIProviderConfig,
    callback: StreamCallback,
    context?: {
      openFilePaths?: string[];
      selection?: { filePath: string; code: string; startLine: number; endLine: number; language: string };
      history?: Array<{ role: 'user' | 'assistant'; content: string }>;
      userPreference?: UserContextPreference;
      skipUserInputAppend?: boolean;
    },
    traceId?: string
  ): Promise<void> {
    // 使用传入的 traceId 或生成新的
    const effectiveTraceId = traceId || logger.generateTraceId('chat');
    // 用于错误处理时记录当前轮数
    let currentRound = 0;

    const client = this.getClient(config);
    const model = this.getModel(config);
    const toolService = new AIToolService(workspacePath);

    // 检测模型能力
    const useFunctionCall = detectFunctionCallSupport(model, config);
    const modelCapability: ModelCapability = {
      modelId: model,
      maxContextWindow: getContextLength(config),
    };
    const userPreference: UserContextPreference = context?.userPreference || {};
    const effectiveContextBudget = getEffectiveContextBudget(userPreference, DEFAULT_CONTEXT_POLICY, modelCapability);
    const contextLength = effectiveContextBudget;
    const maxTokens = config.maxTokens || 4000;

    // 记录请求开始 - 使用统一的 traceId 字段名
    logger.info('chat_request_start', {
      traceId: effectiveTraceId,
      model,
      provider: config.provider,
      useFunctionCall,
      toolsCount: TOOLS.length,
      workspacePath,
      userInputLength: userInput.length,
      contextLength,
      maxTokens
    });

    // 构建基础系统提示词 - 参考业内最佳实践
    // 使用数组拼接避免 TypeScript 解析问题
    const promptParts: string[] = [];
    
    // 1. 角色定义
    promptParts.push('# 角色定义');
    promptParts.push('');
    promptParts.push('你是 ywcoder，一个专业的智能编程助手。你的核心使命是帮助开发者高效完成编程任务。');
    promptParts.push('');
    
    // 2. 能力范围
    promptParts.push('## 能力范围');
    promptParts.push('');
    promptParts.push('你可以：');
    promptParts.push('- 搜索和读取项目文件');
    promptParts.push('- 分析代码结构和逻辑');
    promptParts.push('- 创建和修改文件（使用 file 标签）');
    promptParts.push('- 回答编程相关问题');
    promptParts.push('- 管理任务进展（使用 todo 标签）');
    promptParts.push('- 主动提问澄清需求（使用 question 标签）');
    promptParts.push('');
    promptParts.push('你不能：');
    promptParts.push('- 执行系统命令或脚本');
    promptParts.push('- 访问外部网络资源');
    promptParts.push('- 直接执行文件写入（必须使用 file 标签）');
    promptParts.push('- 使用 tool_call 或 function call 来提问（必须使用 question 标签）');
    promptParts.push('');
    
    // 3. 输出格式规范
    promptParts.push('## 输出格式规范');
    promptParts.push('');
    promptParts.push('### 1. 文件操作（创建/修改文件）');
    promptParts.push('');
    promptParts.push('当需要写入文件时，必须使用以下格式：');
    promptParts.push('');
    promptParts.push('<file path="src/example.ts">');
    promptParts.push('export function hello() {');
    promptParts.push('  console.log("Hello World");');
    promptParts.push('}');
    promptParts.push('</file>');
    promptParts.push('');
    promptParts.push('关键规则：');
    promptParts.push('- 使用 <file path="相对路径">内容</file> 格式');
    promptParts.push('- path 属性必须是相对于工作区的相对路径');
    promptParts.push('- 直接输出文本，不要包裹在代码块中');
    promptParts.push('- 不要尝试使用工具调用来写入文件');
    promptParts.push('');
    
    // 4. 任务管理
    promptParts.push('### 2. 任务管理');
    promptParts.push('');
    promptParts.push('使用待办清单跟踪进展：');
    promptParts.push('');
    promptParts.push('<todo>');
    promptParts.push('<task id="1" status="in_progress">分析项目结构</task>');
    promptParts.push('<task id="2" status="pending">创建核心模块</task>');
    promptParts.push('<task id="3" status="completed">初始化配置</task>');
    promptParts.push('</todo>');
    promptParts.push('');
    promptParts.push('状态说明：pending（待处理）、in_progress（进行中）、completed（已完成）、failed（失败）');
    promptParts.push('');
    
    // 5. 主动提问
    promptParts.push('### 3. 主动提问');
    promptParts.push('');
    promptParts.push('【重要】当需求不明确时，使用 question 标签主动提问。注意：这不是工具调用，而是直接输出的文本格式！');
    promptParts.push('');
    promptParts.push('格式示例：');
    promptParts.push('<question>');
    promptParts.push('你希望使用什么技术栈？');
    promptParts.push('<option id="1" value="react">React - 组件化开发，生态丰富</option>');
    promptParts.push('<option id="2" value="vue">Vue - 渐进式框架，易学易用</option>');
    promptParts.push('<option id="3" value="angular">Angular - 企业级框架，功能完整</option>');
    promptParts.push('<option id="4" value="vanilla">原生 JavaScript - 轻量级，无依赖</option>');
    promptParts.push('</question>');
    promptParts.push('');
    promptParts.push('关键规则：');
    promptParts.push('- 直接输出上述格式的文本，不要包裹在代码块中');
    promptParts.push('- 不要使用 tool_call 或 function call 来提问');
    promptParts.push('- 优先使用选择题（带 option 标签），让用户快速选择');
    promptParts.push('- 如果没有合适的选项，也可以让用户自由输入');
    promptParts.push('');
    
    // 6. 工作流程
    promptParts.push('## 工作流程');
    promptParts.push('');
    promptParts.push('1. 理解需求：仔细阅读用户请求，必要时使用 question 标签澄清');
    promptParts.push('2. 分析现状：使用工具了解当前项目结构和代码');
    promptParts.push('3. 规划任务：使用 todo 标签制定执行计划');
    promptParts.push('4. 执行操作：使用 file 标签创建/修改文件，使用工具读取信息');
    promptParts.push('5. 更新进展：及时更新 todo 状态');
    promptParts.push('6. 总结说明：简要说明完成的工作');
    promptParts.push('');
    
    // 7. 思考与推理
    promptParts.push('## 思考与推理');
    promptParts.push('');
    promptParts.push('在解决问题前，请先进行系统性思考：');
    promptParts.push('');
    promptParts.push('1. 理解问题：用户真正需要什么？');
    promptParts.push('2. 分析现状：当前代码/项目的状态如何？');
    promptParts.push('3. 制定方案：有哪些可能的解决方案？选择最优方案。');
    promptParts.push('4. 执行计划：分步骤实施，每步验证。');
    promptParts.push('5. 验证结果：是否满足需求？是否有副作用？');
    promptParts.push('');
    promptParts.push('使用 <think> 标签展示你的思考过程，帮助用户理解你的决策逻辑。');
    promptParts.push('');
    
    // 8. 输出长度控制（关键约束）
    promptParts.push('## 输出长度控制');
    promptParts.push('');
    promptParts.push('【关键】AI 输出受限于上下文窗口，必须控制每次输出的长度：');
    promptParts.push('');
    promptParts.push('1. **文件写入限制**：');
    promptParts.push('   - 单次 <file> 标签内容不超过 500 行');
    promptParts.push('   - 如果预估代码超过 500 行，先写核心部分，用 <question> 询问后续');
    promptParts.push('');
    promptParts.push('2. **保持 JSON 格式完整**：');
    promptParts.push('   - 所有字符串必须正确闭合（使用单引号或双引号）');
    promptParts.push('   - 检查 <file> 标签的 path 属性是否正确闭合');
    promptParts.push('   - 避免在字符串中间截断');
    promptParts.push('');
    promptParts.push('3. **分步执行**：');
    promptParts.push('   - 复杂任务分多次完成');
    promptParts.push('   - 每次只写一个文件或一个模块');
    promptParts.push('   - 用 todo 标签标记未完成的部分');
    promptParts.push('');
    
    // 9. 精简示例
    promptParts.push('## 示例');
    promptParts.push('');
    promptParts.push('用户：创建登录功能');
    promptParts.push('');
    promptParts.push('<todo>');
    promptParts.push('<task id="1" status="in_progress">分析项目技术栈</task>');
    promptParts.push('<task id="2" status="pending">实现登录模块</task>');
    promptParts.push('</todo>');
    promptParts.push('');
    promptParts.push('<question>你希望使用什么技术栈？JWT/Session/OAuth</question>');
    promptParts.push('');
    promptParts.push('## 最佳实践');
    promptParts.push('');
    promptParts.push('- 复杂任务先规划再执行');
    promptParts.push('- 保持代码清晰、可维护');
    promptParts.push('- 使用中文与用户交流');
    promptParts.push('- 遇到问题及时反馈');
    promptParts.push('');
    promptParts.push('我发现了以下问题并提供重构方案...');
    promptParts.push('（然后输出重构后的代码）');
    promptParts.push('');
    promptParts.push('### 示例 4：性能优化');
    promptParts.push('');
    promptParts.push('用户：页面加载很慢，怎么优化？');
    promptParts.push('');
    promptParts.push('你的响应：');
    promptParts.push('<think>');
    promptParts.push('页面加载慢可能的原因：');
    promptParts.push('1. 资源文件过大（JS/CSS/图片）');
    promptParts.push('2. 请求过多，没有合并');
    promptParts.push('3. 没有使用缓存');
    promptParts.push('4. 渲染阻塞');
    promptParts.push('5. 首屏内容没有优先加载');
    promptParts.push('我需要先分析项目结构和资源加载情况。');
    promptParts.push('</think>');
    promptParts.push('');
    promptParts.push('页面加载慢通常由多种因素造成。让我先分析你的项目...');
    promptParts.push('（使用工具分析后给出具体建议）');
    promptParts.push('');
    promptParts.push('优化建议：');
    promptParts.push('1. 启用代码分割和懒加载');
    promptParts.push('2. 压缩和优化图片资源');
    promptParts.push('3. 使用 CDN 加速静态资源');
    promptParts.push('4. 添加浏览器缓存策略');
    promptParts.push('5. 优化关键渲染路径');
    promptParts.push('');
    promptParts.push('### 示例 5：技术选型');
    promptParts.push('');
    promptParts.push('用户：我想做一个实时聊天应用，用什么技术好？');
    promptParts.push('');
    promptParts.push('你的响应：');
    promptParts.push('<think>');
    promptParts.push('实时聊天应用的关键需求：');
    promptParts.push('1. 实时双向通信');
    promptParts.push('2. 消息持久化');
    promptParts.push('3. 用户在线状态');
    promptParts.push('4. 消息历史记录');
    promptParts.push('可选方案：');
    promptParts.push('- WebSocket：原生支持，性能好');
    promptParts.push('- Socket.io：兼容性好，功能丰富');
    promptParts.push('- Server-Sent Events：单向，简单场景适用');
    promptParts.push('- WebRTC：P2P，适合音视频');
    promptParts.push('</think>');
    promptParts.push('');
    promptParts.push('对于实时聊天应用，我推荐以下技术方案：');
    promptParts.push('');
    promptParts.push('方案一：WebSocket + Node.js（推荐）');
    promptParts.push('- 优点：性能好，原生支持，生态成熟');
    promptParts.push('- 缺点：需要处理连接管理、心跳等');
    promptParts.push('- 适用：中大型应用');
    promptParts.push('');
    promptParts.push('方案二：Socket.io');
    promptParts.push('- 优点：自动降级、房间管理、广播功能');
    promptParts.push('- 缺点：体积稍大，有一定学习成本');
    promptParts.push('- 适用：快速开发，需要丰富功能');
    promptParts.push('');
    promptParts.push('<question>');
    promptParts.push('你的应用预计有多少用户同时在线？');
    promptParts.push('是否需要支持音视频通话？');
    promptParts.push('</question>');
    promptParts.push('');
    
    promptParts.push(`当前工作区: ${workspacePath}`);
    
    let baseSystemPrompt = promptParts.join('\n');

    if (context?.selection) {
      baseSystemPrompt += `\n用户选中了 ${context.selection.filePath} 的第 ${context.selection.startLine}-${context.selection.endLine} 行`;
    }

    // 构建历史消息
    const historyMessages: Message[] = [];
    if (context?.history && context.history.length > 0) {
      for (const msg of context.history) {
        historyMessages.push({ role: msg.role, content: msg.content });
      }
    }

    // 添加当前用户输入（如果 history 中没有且未标记跳过）
    const shouldSkipUserInput = context?.skipUserInputAppend;
    const lastMessage = historyMessages[historyMessages.length - 1];
    const isLastMessageUser = lastMessage?.role === 'user';
    
    if (!shouldSkipUserInput || !isLastMessageUser) {
      // 如果 history 最后一条不是 user，或者没有标记跳过，则追加 userInput
      if (!isLastMessageUser) {
        historyMessages.push({ role: 'user', content: userInput });
        logger.info('chat_user_input_appended', {
          traceId: effectiveTraceId,
          reason: 'last_message_not_user',
          historyLength: context?.history?.length || 0
        });
      } else if (!shouldSkipUserInput) {
        historyMessages.push({ role: 'user', content: userInput });
        logger.info('chat_user_input_appended', {
          traceId: effectiveTraceId,
          reason: 'no_skip_flag',
          historyLength: context?.history?.length || 0
        });
      }
    } else {
      logger.info('chat_user_input_skipped', {
        traceId: effectiveTraceId,
        reason: 'already_in_history',
        historyLength: context?.history?.length || 0
      });
    }

    // 构建最终消息数组（不包含 system 消息，后面单独添加）
    let messages: Message[] = [...historyMessages];

    let allThinking = '';
    // 跟踪整个对话过程中的工具调用总数
    let totalToolCalls = 0;
    let hasToolCallInSession = false;

    // 自动续写相关状态
    let continuationCount = 0;
    const maxContinuations = 3;
    let isContinuation = false;
    let accumulatedContent = '';

    // 流式事件序列号计数器（用于事件流驱动渲染）
    let streamEventSeq = 0;
    // 跟踪已发送的 tool 事件（用于更新而不是重复创建）
    const sentToolEvents = new Map<string, number>();

    // 辅助函数：生成下一个序列号
    const getNextSeq = () => ++streamEventSeq;

    try {
      // 使用 while 循环，限制最大轮数防止无限循环
      let roundCount = 0;
      const maxRounds = 30; // 增加最大轮数，让AI有足够时间收集信息并生成回复

      while (roundCount < maxRounds) {
        roundCount++;
        currentRound = roundCount;

        // 每轮重新计算 Token 预算（因为 messages 会不断增长）
        const budget = calculateTokenBudget(contextLength, baseSystemPrompt);
        logTokenBudget(budget, effectiveTraceId);

        // 每轮重新裁剪历史消息以适应上下文长度
        const trimmedMessages = trimHistoryMessages(messages, budget.promptBudgetTokens, effectiveTraceId);

        // 每次请求都重新构建消息数组，确保 system 消息在最前面且只出现一次
        const requestMessages: Message[] = [
          { role: 'system', content: baseSystemPrompt },
          ...trimmedMessages,
        ];

        // ========== 调试日志：发送请求消息信息 ==========
        console.log(`[DEBUG] ======= 请求 #${roundCount} =======`);
        console.log(`[DEBUG] 消息总数: ${requestMessages.length}`);
        requestMessages.forEach((msg, idx) => {
          const contentLen = msg.content ? msg.content.length : 0;
          const contentPreview = msg.content ? msg.content.slice(0, 100).replace(/\n/g, '\\n') : '(null)';
          console.log(`[DEBUG] 消息[${idx}] role=${msg.role}, length=${contentLen}, preview="${contentPreview}..."`);
        });
        console.log(`[DEBUG] ==========================================`);

        const requestParams: any = {
          model,
          messages: requestMessages,
          stream: true,
        };

        requestParams.temperature = 0.3;
        // 使用预算中预留的 completion tokens
        requestParams.max_tokens = budget.maxTokens;

        // MiniMax 模型启用 reasoning_split，将思考内容分离到 reasoning_details 字段
        if (model.toLowerCase().includes('minimax')) {
          requestParams.extra_body = { reasoning_split: true };
        }

        // 如果支持 Function Call，添加工具定义
        if (useFunctionCall) {
          requestParams.tools = TOOLS.map(tool => ({
            type: 'function' as const,
            function: {
              name: tool.name,
              description: tool.description,
              parameters: tool.parameters,
            },
          }));
          requestParams.tool_choice = 'auto';
        }

        // 记录请求参数
        logger.info('chat_request_params', {
          traceId: effectiveTraceId,
          round: roundCount,
          model,
          messageCount: requestMessages.length,
          hasTools: !!requestParams.tools,
          toolsCount: requestParams.tools?.length || 0,
          temperature: requestParams.temperature,
          maxTokens: requestParams.max_tokens
        });

        let stream;
        const maxRetries = 3;
        const retryDelay = 1000;
        let retryCount = 0;
        
        while (retryCount < maxRetries) {
          try {
            stream = await client.chat.completions.create(requestParams) as unknown as Stream<OpenAI.Chat.Completions.ChatCompletionChunk>;
            break;
          } catch (error: any) {
            retryCount++;
            console.error(`创建流式请求失败 (尝试 ${retryCount}/${maxRetries}):`, error);
            
            if (retryCount >= maxRetries) {
              const errorMessage = error.message || String(error);
              let userFriendlyError = `API 请求失败: ${errorMessage}`;
              
              if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
                userFriendlyError = 'API 密钥无效或已过期，请检查配置';
              } else if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
                userFriendlyError = 'API 请求频率超限，请稍后重试';
              } else if (errorMessage.includes('500') || errorMessage.includes('502') || errorMessage.includes('503')) {
                userFriendlyError = 'API 服务暂时不可用，请稍后重试';
              } else if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('ECONNREFUSED')) {
                userFriendlyError = '网络连接失败，请检查网络设置';
              } else if (errorMessage.includes('timeout')) {
                userFriendlyError = '请求超时，请检查网络连接或稍后重试';
              }
              
              callback({ type: 'error', error: userFriendlyError });
              return;
            }
            
            await new Promise(resolve => setTimeout(resolve, retryDelay * retryCount));
          }
        }

        let fullContent = '';
        let roundThinking = '';
        let toolCallsFromFunction: any[] = [];
        
        if (!stream) {
          callback({ type: 'error', error: '无法创建流式连接，请检查网络设置' });
          return;
        }
        
        // 用于累积的缓冲区
        let buffer = '';
        let inThinkBlock = false;
        let thinkContent = '';
        
        // 用于实时文件编辑
        let inFileEditBlock = false;
        let fileEditPath = '';
        let fileEditContent = '';
        let fileEditToolCallId = '';
        
        // 用于 question 标签
        let inQuestionBlock = false;
        let questionContent = '';
        let questionId = '';
        
        // 用于 todo 标签
        let inTodoBlock = false;
        let todoContent = '';
        
        // 用于捕获 finish_reason
        let finishReason: string | null = null;

        try {
          for await (const chunk of stream) {
            // 安全检查 chunk 结构
            if (!chunk || !chunk.choices || !Array.isArray(chunk.choices) || chunk.choices.length === 0) {
              continue;
            }
            
            // 捕获 finish_reason
            const choice = chunk.choices[0];
            if (choice?.finish_reason) {
              finishReason = choice.finish_reason;
              logger.info('stream_finish_reason_detected', {
                traceId: effectiveTraceId,
                round: roundCount,
                finishReason,
                continuationCount,
                contentLength: fullContent.length,
              });
            }
            
            const delta = choice?.delta;
            if (!delta) continue;

            // 处理 Function Call (OpenAI 原生格式)
            if (delta?.tool_calls) {
              console.log('[AIStreamService] Received tool_calls:', JSON.stringify(delta.tool_calls));
              for (const toolCall of delta.tool_calls) {
                const index = toolCall.index || 0;
                if (!toolCallsFromFunction[index]) {
                  toolCallsFromFunction[index] = {
                    id: toolCall.id,
                    type: 'function',
                    function: {
                      name: toolCall.function?.name || '',
                      arguments: toolCall.function?.arguments || '',
                    },
                  };
                  console.log('[AIStreamService] Created tool call:', toolCall.id, toolCall.function?.name);
                } else {
                  if (toolCall.function?.name) {
                    toolCallsFromFunction[index].function.name += toolCall.function.name;
                  }
                  if (toolCall.function?.arguments) {
                    toolCallsFromFunction[index].function.arguments += toolCall.function.arguments;
                  }
                }
              }
            }

            // 处理普通内容
            const content = delta?.content || '';
            if (content) {
              fullContent += content;
              buffer += content;
              
              // 调试：打印接收到的内容
              console.log('[AIStreamService] Content chunk received:', content.slice(0, 50), '..., buffer length:', buffer.length);
              
              // 调试：打印接收到的内容
              if (content.includes('<file') || content.includes('</file>')) {
                console.log('[AIStreamService] File tag detected in content:', content);
              }
              if (content.includes('<question') || content.includes('</question>')) {
                console.log('[AIStreamService] Question tag detected in content:', content);
              }

              // 使用 while 循环处理 buffer 中的所有 <file> 标签（仅在不在其他特殊块中时处理）
              while (!inThinkBlock && !inTodoBlock && !inQuestionBlock) {
                if (!inFileEditBlock) {
                  // 不在 <file> 块中，检测 <file> 标签开始
                  const fileStartMatch = buffer.match(/<file\s+path="([^"]+)">/);
                  if (fileStartMatch) {
                    inFileEditBlock = true;
                    fileEditPath = fileStartMatch[1];
                    fileEditContent = '';
                    fileEditToolCallId = `file_${Date.now()}`;

                    console.log(`[AIStreamService] <file> tag started, path: ${fileEditPath}`);

                    // 发送 tool_start 回调，在对话界面展示文件操作
                    const seq = getNextSeq();
                    const toolEventId = `tool_${fileEditToolCallId}`;
                    sentToolEvents.set(fileEditToolCallId, seq);
                    callback({
                      type: 'tool_start',
                      toolName: 'edit_file' as ToolName,
                      toolParams: { file_path: fileEditPath },
                      toolCallId: fileEditToolCallId,
                      streamEvent: {
                        id: toolEventId,
                        seq,
                        type: 'tool',
                        toolCallId: fileEditToolCallId,
                        toolName: 'edit_file',
                        params: { file_path: fileEditPath },
                        status: 'running',
                        timestamp: Date.now(),
                      }
                    });

                    // 通知前端打开文件
                    const { BrowserWindow } = require('electron');
                    BrowserWindow.getAllWindows().forEach((window: any) => {
                      window.webContents.send('file:open', {
                        filePath: fileEditPath,
                      });
                    });

                    // 将 <file> 标签前的内容作为普通内容输出
                    const beforeFile = buffer.slice(0, fileStartMatch.index);
                    if (beforeFile) {
                      const seq = getNextSeq();
                      callback({
                        type: 'content',
                        content: beforeFile,
                        streamEvent: {
                          id: `content_${Date.now()}_${seq}`,
                          seq,
                          type: 'content',
                          text: beforeFile,
                          timestamp: Date.now(),
                        },
                      });
                    }

                    // 移除已处理的标签，保留标签后的内容
                    buffer = buffer.slice(fileStartMatch.index! + fileStartMatch[0].length);
                    console.log(`[AIStreamService] <file> tag content after start: "${buffer.slice(0, 50)}..."`);
                    // 继续循环，处理 <file> 块中的内容
                    continue;
                  } else {
                    // 没有 <file> 标签，跳出 while 循环，继续处理其他标签
                    break;
                  }
                } else {
                  // 在 <file> 块中，检查是否结束
                  const fileEndIndex = buffer.indexOf('</file>');
                  if (fileEndIndex !== -1) {
                    // <file> 块结束
                    const finalContent = buffer.slice(0, fileEndIndex);
                    fileEditContent += finalContent;

                    console.log(`[AIStreamService] </file> tag found, total content length: ${fileEditContent.length}`);

                    // 实时更新编辑器
                    const { BrowserWindow } = require('electron');
                    BrowserWindow.getAllWindows().forEach((window: any) => {
                      window.webContents.send('file:progress', {
                        filePath: fileEditPath,
                        content: fileEditContent,
                        isComplete: true,
                      });
                    });

                    // 写入文件
                    const fullPath = path.join(workspacePath, fileEditPath);
                    console.log(`[AIStreamService] Writing file: ${fullPath}`);
                    
                    let writeSuccess = false;
                    let writeError: Error | null = null;
                    
                    try {
                      await fs.mkdir(path.dirname(fullPath), { recursive: true });
                      await fs.writeFile(fullPath, fileEditContent, 'utf-8');
                      console.log(`[AIStreamService] File written successfully: ${fullPath}`);
                      writeSuccess = true;
                    } catch (error: any) {
                        writeError = error as Error;
                        console.error(`[AIStreamService] Failed to write file: ${fullPath}`, {
                          message: writeError?.message,
                          code: error?.code,
                          errno: error?.errno,
                          syscall: error?.syscall,
                          path: error?.path,
                        });
                      }

                    // 发送 tool_end 回调，根据实际结果返回状态
                    const endSeq = getNextSeq();
                    const endToolEventId = `tool_${fileEditToolCallId}`;
                    callback({
                      type: 'tool_end',
                      toolName: 'edit_file' as ToolName,
                      toolResult: {
                        tool: 'edit_file' as ToolName,
                        success: writeSuccess,
                        error: writeError ? `文件写入失败: ${writeError.message} (${(writeError as any).code || 'unknown'})` : undefined,
                        data: writeSuccess ? { file_path: fileEditPath } : undefined,
                      },
                      toolCallId: fileEditToolCallId,
                      streamEvent: {
                        id: endToolEventId,
                        seq: endSeq,
                        type: 'tool',
                        toolCallId: fileEditToolCallId,
                        toolName: 'edit_file',
                        params: { file_path: fileEditPath },
                        status: writeSuccess ? 'completed' : 'error',
                        result: writeSuccess ? { file_path: fileEditPath } : undefined,
                        error: writeError ? `文件写入失败: ${writeError.message} (${(writeError as any).code || 'unknown'})` : undefined,
                        timestamp: Date.now(),
                      }
                    });

                    // 重置状态
                    inFileEditBlock = false;
                    fileEditPath = '';
                    fileEditContent = '';
                    fileEditToolCallId = '';
                    buffer = buffer.slice(fileEndIndex + 7); // 跳过 '</file>'
                    // 继续循环，检查 buffer 中是否还有下一个 <file> 标签
                    continue;
                  } else {
                    // <file> 块继续，累积内容并实时更新
                    fileEditContent += buffer;

                    // 实时更新编辑器
                    const { BrowserWindow } = require('electron');
                    BrowserWindow.getAllWindows().forEach((window: any) => {
                      window.webContents.send('file:progress', {
                        filePath: fileEditPath,
                        content: fileEditContent,
                        isComplete: false,
                      });
                    });

                    // 清空 buffer，避免重复累积
                    buffer = '';
                    // 跳出 while 循环，等待下一个 chunk
                    break;
                  }
                }
              }

              // 检测 think 标签（仅在不在其他特殊块中时处理）
              if (!inThinkBlock && !inTodoBlock && !inQuestionBlock) {
                // 不在 think 块中，检查是否开始 think
                const thinkStartIndex = buffer.indexOf('<think>');
                if (thinkStartIndex !== -1) {
                  // 输出 think 之前的内容
                  const beforeThink = buffer.slice(0, thinkStartIndex);
                  if (beforeThink) {
                    const filtered = this.filterToolCalls(beforeThink);
                    if (filtered) {
                      const seq = getNextSeq();
                      callback({
                        type: 'content',
                        content: filtered,
                        streamEvent: {
                          id: `content_${Date.now()}_${seq}`,
                          seq,
                          type: 'content',
                          text: filtered,
                          timestamp: Date.now(),
                        },
                      });
                    }
                  }
                  // 进入 think 块
                  inThinkBlock = true;
                  thinkContent = '';
                  buffer = buffer.slice(thinkStartIndex + 7); // 跳过 '<think>'
                }
              }

              if (inThinkBlock) {
                // 在 think 块中，检查是否结束
                const thinkEndIndex = buffer.indexOf('</think>');
                if (thinkEndIndex !== -1) {
                  // think 块结束
                  console.log(`[AIStreamService] </think> tag found at index ${thinkEndIndex}, buffer length: ${buffer.length}`);
                  const finalThinkChunk = buffer.slice(0, thinkEndIndex);
                  if (finalThinkChunk) {
                    thinkContent += finalThinkChunk;
                    // 发送最后的 think 内容
                    const seq = getNextSeq();
                    callback({
                      type: 'thinking',
                      content: finalThinkChunk,
                      streamEvent: {
                        id: `thinking_${Date.now()}_${seq}`,
                        seq,
                        type: 'thinking',
                        text: finalThinkChunk,
                        timestamp: Date.now(),
                      }
                    });
                  }
                  // 记录完整的 think 内容到 roundThinking（用于历史记录）
                  if (thinkContent) {
                    roundThinking += (roundThinking ? '\n' : '') + thinkContent;
                  }
                  // 发送思考完成信号，让前端知道思考过程已结束
                  const completeSeq = getNextSeq();
                  callback({
                    type: 'thinking_complete',
                    content: roundThinking,
                    streamEvent: {
                      id: `thinking_${Date.now()}_${completeSeq}`,
                      seq: completeSeq,
                      type: 'thinking',
                      text: roundThinking,
                      done: true,
                      timestamp: Date.now(),
                    }
                  });
                  // 输出 think 之后的内容
                  const afterThink = buffer.slice(thinkEndIndex + 9); // 跳过 '</think>'
                  console.log(`[AIStreamService] Content after </think>: "${afterThink.slice(0, 50)}..."`);
                  // 重置状态
                  inThinkBlock = false;
                  thinkContent = '';
                  buffer = afterThink;
                  // 如果 buffer 中还有内容，继续循环处理
                  if (buffer.length > 0) {
                    continue;
                  }
                } else {
                  // think 块继续 - 实时发送思考内容，让用户看到 AI 的思考过程
                  thinkContent += buffer;
                  const seq = getNextSeq();
                  callback({
                    type: 'thinking',
                    content: buffer,
                    streamEvent: {
                      id: `thinking_${Date.now()}_${seq}`,
                      seq,
                      type: 'thinking',
                      text: buffer,
                      timestamp: Date.now(),
                    }
                  });
                  buffer = '';
                  continue;
                }
              }

              // 检测 todo 标签 - 使用状态机方式处理跨 chunk 的情况（仅在不在其他特殊块中时处理）
              if (!inTodoBlock && !inThinkBlock && !inQuestionBlock) {
                const todoStartIndex = buffer.indexOf('<todo>');
                if (todoStartIndex !== -1) {
                  // 输出 todo 之前的内容
                  const beforeTodo = buffer.slice(0, todoStartIndex);
                  if (beforeTodo) {
                    const filtered = this.filterToolCalls(beforeTodo);
                    if (filtered) {
                      const seq = getNextSeq();
                      callback({
                        type: 'content',
                        content: filtered,
                        streamEvent: {
                          id: `content_${Date.now()}_${seq}`,
                          seq,
                          type: 'content',
                          text: filtered,
                          timestamp: Date.now(),
                        },
                      });
                    }
                  }
                  // 进入 todo 块
                  inTodoBlock = true;
                  todoContent = '';
                  buffer = buffer.slice(todoStartIndex + 6); // 跳过 '<todo>'
                  // 继续循环，处理 todo 块内的内容
                  continue;
                }
              }

              if (inTodoBlock) {
                // 在 todo 块中，检查是否结束
                const todoEndIndex = buffer.indexOf('</todo>');
                if (todoEndIndex !== -1) {
                  // todo 块结束
                  const finalTodoChunk = buffer.slice(0, todoEndIndex);
                  todoContent += finalTodoChunk;

                  // 解析 todo 内容
                  const now = Date.now();
                  const todoItems: Array<{ id: string; content: string; status: 'pending' | 'in_progress' | 'completed' | 'failed'; createdAt: number; updatedAt: number }> = [];
                  const taskRegex = /<task\s+id="([^"]+)"\s+status="([^"]+)">(.*?)<\/task>/g;
                  let taskMatch;
                  while ((taskMatch = taskRegex.exec(todoContent)) !== null) {
                    todoItems.push({
                      id: taskMatch[1],
                      status: taskMatch[2] as 'pending' | 'in_progress' | 'completed' | 'failed',
                      content: taskMatch[3].trim(),
                      createdAt: now,
                      updatedAt: now,
                    });
                  }

                  if (todoItems.length > 0) {
                    const seq = getNextSeq();
                    callback({
                      type: 'todo_update',
                      todoItems,
                      streamEvent: {
                        id: `todo_${Date.now()}_${seq}`,
                        seq,
                        type: 'todo',
                        items: todoItems,
                        timestamp: Date.now(),
                      },
                    });
                  }

                  // 重置状态
                  inTodoBlock = false;
                  todoContent = '';
                  buffer = buffer.slice(todoEndIndex + 7); // 跳过 '</todo>'
                  // 如果 buffer 中还有内容，继续循环处理
                  if (buffer.length > 0) {
                    continue;
                  }
                } else {
                  // todo 块继续，累积内容
                  todoContent += buffer;
                  buffer = '';
                  continue;
                }
              }

              // 检测 question 标签（仅在不在其他特殊块中时处理）
              if (!inQuestionBlock && !inThinkBlock && !inTodoBlock && !inFileEditBlock) {
                const questionStartIndex = buffer.indexOf('<question>');
                if (questionStartIndex !== -1) {
                  console.log(`[AIStreamService] <question> tag detected, buffer: "${buffer.slice(0, 50)}..."`);
                  // 输出 question 之前的内容
                  const beforeQuestion = buffer.slice(0, questionStartIndex);
                  if (beforeQuestion) {
                    const filtered = this.filterToolCalls(beforeQuestion);
                    if (filtered) {
                      const seq = getNextSeq();
                      callback({
                        type: 'content',
                        content: filtered,
                        streamEvent: {
                          id: `content_${Date.now()}_${seq}`,
                          seq,
                          type: 'content',
                          text: filtered,
                          timestamp: Date.now(),
                        },
                      });
                    }
                  }
                  // 进入 question 块
                  inQuestionBlock = true;
                  questionContent = '';
                  questionId = `question_${Date.now()}`;
                  buffer = buffer.slice(questionStartIndex + 10); // 跳过 '<question>'
                  console.log(`[AIStreamService] Entering question block, id: ${questionId}`);
                  // 继续循环，处理 question 块内的内容
                  continue;
                }
              }

              if (inQuestionBlock) {
                // 在 question 块中，检查是否结束
                const questionEndIndex = buffer.indexOf('</question>');
                if (questionEndIndex !== -1) {
                  // question 块结束
                  const finalContent = buffer.slice(0, questionEndIndex);
                  questionContent += finalContent;

                  // 解析 question 内容和选项
                  // 问题文本是 <question> 和第一个 <option> 或 </question> 之间的文本
                  const questionMatch = questionContent.match(/^\s*([^<\n]+)/);
                  const questionText = questionMatch ? questionMatch[1].trim() : '';

                  // 如果没有匹配到，尝试提取第一行非空文本
                  const lines = questionContent.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('<'));
                  const finalQuestionText = questionText || lines[0] || '请回答以下问题';

                  // 解析选项
                  const optionMatches = questionContent.matchAll(/<option\s+id="([^"]+)"\s+value="([^"]+)">(.*?)<\/option>/g);
                  const options: Array<{id: string; label: string; value: string}> = [];

                  for (const match of optionMatches) {
                    options.push({
                      id: match[1],
                      value: match[2],
                      label: match[3].trim(),
                    });
                  }

                  if (finalQuestionText) {
                    console.log(`[AIStreamService] Sending agent_question: ${questionId}, text: ${finalQuestionText}`);
                    const seq = getNextSeq();
                    callback({
                      type: 'agent_question',
                      question: {
                        id: questionId,
                        question: finalQuestionText,
                        options: options.length > 0 ? options : undefined,
                      },
                      streamEvent: {
                        id: `question_${questionId}`,
                        seq,
                        type: 'question',
                        questionId: questionId,
                        question: finalQuestionText,
                        options: options.length > 0 ? options : undefined,
                        timestamp: Date.now(),
                      },
                    });
                  } else {
                    console.log(`[AIStreamService] Question text is empty, not sending agent_question`);
                  }

                  // 重置状态
                  inQuestionBlock = false;
                  questionContent = '';
                  questionId = '';
                  buffer = buffer.slice(questionEndIndex + 11); // 跳过 '</question>'
                  // 如果 buffer 中还有内容，继续循环处理
                  if (buffer.length > 0) {
                    continue;
                  }
                } else {
                  // question 块继续，累积内容
                  questionContent += buffer;
                  buffer = '';
                  continue;
                }
              }

              // 不在任何特殊块中，直接输出
              if (buffer.length > 0) {
                const filtered = this.filterToolCalls(buffer);
                if (filtered) {
                  // 直接发送内容，不累积
                  console.log('[AIStreamService] Sending content:', filtered.slice(0, 50), '...');
                  const seq = getNextSeq();
                  callback({
                    type: 'content',
                    content: filtered,
                    streamEvent: {
                      id: `content_${Date.now()}_${seq}`,
                      seq,
                      type: 'content',
                      text: filtered,
                      timestamp: Date.now(),
                    },
                  });
                }
                buffer = '';
              }
            }
          }
        } catch (streamError: any) {
          console.error('流式读取错误:', streamError);
          callback({ type: 'error', error: `流式输出中断: ${streamError.message || streamError}` });
          return;
        }

        // 流式结束后，处理剩余内容
        if (buffer) {
          if (inFileEditBlock) {
            // 未闭合的 <file> 块，强制结束并写入文件
            console.log('[AIStreamService] File block not closed, forcing end');
            fileEditContent += buffer;
            
            // 实时更新编辑器
            const { BrowserWindow } = require('electron');
            BrowserWindow.getAllWindows().forEach((window: any) => {
              window.webContents.send('file:progress', {
                filePath: fileEditPath,
                content: fileEditContent,
                isComplete: true,
              });
            });
            
            // 写入文件
            const fullPath = path.join(workspacePath, fileEditPath);
            console.log(`[AIStreamService] Writing file (forced): ${fullPath}, content length: ${fileEditContent.length}`);
            
            let writeSuccess = false;
            let writeError: Error | null = null;
            
            try {
              await fs.mkdir(path.dirname(fullPath), { recursive: true });
              await fs.writeFile(fullPath, fileEditContent, 'utf-8');
              console.log(`[AIStreamService] File written successfully (forced): ${fullPath}`);
              writeSuccess = true;
            } catch (error: any) {
              writeError = error as Error;
              console.error(`[AIStreamService] Failed to write file (forced): ${fullPath}`, {
                message: writeError?.message,
                code: error?.code,
                errno: error?.errno,
                syscall: error?.syscall,
                path: error?.path,
              });
            }
            
            // 发送 tool_end 回调，根据实际结果返回状态
            const endSeq2 = getNextSeq();
            const endToolEventId2 = `tool_${fileEditToolCallId}`;
            callback({
              type: 'tool_end',
              toolName: 'edit_file' as ToolName,
              toolResult: {
                tool: 'edit_file' as ToolName,
                success: writeSuccess,
                error: writeError ? `文件写入失败: ${writeError.message} (${(writeError as any).code || 'unknown'})` : undefined,
                data: writeSuccess ? { file_path: fileEditPath } : undefined,
              },
              toolCallId: fileEditToolCallId,
              streamEvent: {
                id: endToolEventId2,
                seq: endSeq2,
                type: 'tool',
                toolCallId: fileEditToolCallId,
                toolName: 'edit_file',
                params: { file_path: fileEditPath },
                status: writeSuccess ? 'completed' : 'error',
                result: writeSuccess ? { file_path: fileEditPath } : undefined,
                error: writeError ? `文件写入失败: ${writeError.message} (${(writeError as any).code || 'unknown'})` : undefined,
                timestamp: Date.now(),
              }
            });
          } else if (inThinkBlock) {
            // 未闭合的 think 块
            thinkContent += buffer;
            roundThinking += thinkContent;
            const seq = getNextSeq();
            callback({
              type: 'thinking',
              content: buffer,
              streamEvent: {
                id: `thinking_${Date.now()}_${seq}`,
                seq,
                type: 'thinking',
                text: buffer,
                timestamp: Date.now(),
              }
            });
          } else {
            // 普通内容
            const filtered = this.filterToolCalls(buffer);
            if (filtered) {
              const seq = getNextSeq();
              callback({
                type: 'content',
                content: filtered,
                streamEvent: {
                  id: `content_${Date.now()}_${seq}`,
                  seq,
                  type: 'content',
                  text: filtered,
                  timestamp: Date.now(),
                },
              });
            }
          }
        }

        // 收集思考过程
        if (roundThinking) {
          allThinking += (allThinking ? '\n\n' : '') + roundThinking;
        }

        // 处理工具调用
        let toolCalls: ToolCall[] = [];

        // 1. 处理原生 Function Call
        if (toolCallsFromFunction.length > 0) {
          for (const toolCall of toolCallsFromFunction) {
            try {
              const functionName = toolCall.function.name;
              const functionArgs = JSON.parse(toolCall.function.arguments);
              toolCalls.push({
                tool: functionName as ToolName,
                params: functionArgs,
                id: toolCall.id, // 保留原始工具调用ID
              });
            } catch (e) {
              console.error('解析 function call 参数失败:', e);
              logger.error('tool_arguments_parse_failed', {
                traceId: effectiveTraceId,
                toolCallId: toolCall.id,
                functionName: toolCall.function.name,
                argumentsLength: toolCall.function.arguments?.length,
                argumentsPreview: toolCall.function.arguments?.slice(0, 200),
                argumentsEnd: toolCall.function.arguments?.slice(-200),
                error: e instanceof Error ? e.message : String(e),
              });
              
              // 尝试补救截断的 JSON
              const remediationResult = await this.remediateTruncatedArguments(
                toolCall,
                messages,
                client,
                model,
                requestParams,
                effectiveTraceId,
                roundCount,
                finishReason,
                baseSystemPrompt,
                contextLength
              );
              
              if (remediationResult.success && remediationResult.parsedArgs) {
                toolCalls.push({
                  tool: toolCall.function.name as ToolName,
                  params: remediationResult.parsedArgs,
                  id: toolCall.id,
                });
                logger.info('tool_arguments_remediation_success', {
                  traceId: effectiveTraceId,
                  toolCallId: toolCall.id,
                  attempts: remediationResult.attempts,
                });
              } else {
                logger.error('tool_arguments_remediation_failed', {
                  traceId: effectiveTraceId,
                  toolCallId: toolCall.id,
                  attempts: remediationResult.attempts,
                  error: remediationResult.error,
                });
                // 补救失败，跳过这个工具调用
                continue;
              }
            }
          }
        }

        // 2. 处理 XML 格式的 function_calls
        const xmlToolCalls = this.parseFunctionCalls(fullContent);
        toolCalls = [...toolCalls, ...xmlToolCalls];

        // 去重
        toolCalls = toolCalls.filter((tc, index, self) =>
          index === self.findIndex((t) =>
            t.tool === tc.tool && JSON.stringify(t.params) === JSON.stringify(tc.params)
          )
        );

        // 记录检测到的工具调用
        if (toolCalls.length > 0) {
          logger.info('tool_call_detected', {
            traceId: effectiveTraceId,
            round: roundCount,
            toolCallCount: toolCalls.length,
            toolNames: toolCalls.map(tc => tc.tool),
            hasNativeFunctionCall: toolCallsFromFunction.length > 0,
            hasXmlFunctionCall: xmlToolCalls.length > 0
          });
        }

        // 执行工具调用
        if (toolCalls.length > 0) {
          console.log('[AIStreamService] Executing tool calls:', toolCalls.length);
          // 更新工具调用统计
          totalToolCalls += toolCalls.length;
          hasToolCallInSession = true;

          for (const toolCall of toolCalls) {
            // 使用原始工具调用ID（来自API）或生成新ID
            const toolCallId = toolCall.id || `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // 特殊处理 ask_followup_question：触发 agent_question 事件而不是 tool_start
            if (toolCall.tool === 'ask_followup_question') {
              console.log(`[AIStreamService] ask_followup_question detected, sending agent_question event`);
              callback({
                type: 'agent_question',
                question: {
                  id: `question_${Date.now()}`,
                  question: toolCall.params.question || '请提供更多信息',
                  options: toolCall.params.options,
                },
              });
              continue;
            }

            console.log(`[AIStreamService] Sending tool_start: ${toolCallId}, tool: ${toolCall.tool}`);
            const toolSeq = getNextSeq();
            const toolEventId = `tool_${toolCallId}`;
            sentToolEvents.set(toolCallId, toolSeq);
            callback({
              type: 'tool_start',
              toolName: toolCall.tool,
              toolParams: toolCall.params,
              toolCallId,
              streamEvent: {
                id: toolEventId,
                seq: toolSeq,
                type: 'tool',
                toolCallId,
                toolName: toolCall.tool,
                params: toolCall.params,
                status: 'running',
                timestamp: Date.now(),
              }
            });

            const result = await toolService.executeTool(toolCall, traceId);
            console.log(`[AIStreamService] Tool executed: ${toolCallId}, success: ${result.success}`);

            // 发送 tool_end 回调
            console.log(`[AIStreamService] Sending tool_end: ${toolCallId}`);
            const toolEndSeq = getNextSeq();
            const toolEndEventId = `tool_${toolCallId}`;
            callback({
              type: 'tool_end',
              toolName: toolCall.tool,
              toolResult: result,
              toolCallId,
              streamEvent: {
                id: toolEndEventId,
                seq: toolEndSeq,
                type: 'tool',
                toolCallId,
                toolName: toolCall.tool,
                params: toolCall.params,
                status: result.success ? 'completed' : 'error',
                result: result.success ? result.data : undefined,
                error: result.error,
                timestamp: Date.now(),
              }
            });

            // 将工具结果添加到消息历史（使用 OpenAI Function Call 格式）
            messages.push({
              role: 'assistant',
              content: null,
              tool_calls: [{
                id: toolCallId,
                type: 'function',
                function: {
                  name: toolCall.tool,
                  arguments: JSON.stringify(toolCall.params),
                },
              }],
            });
            messages.push({
              role: 'tool',
              content: JSON.stringify(result),
              tool_call_id: toolCallId,
            });
          }

          // 继续下一轮对话
          continue;
        }

        // 检查是否需要自动续写（finish_reason === 'length'）
        if (finishReason === 'length' && continuationCount < maxContinuations) {
          continuationCount++;
          isContinuation = true;
          accumulatedContent += fullContent;
          
          logger.info('stream_continuation_triggered', {
            traceId: effectiveTraceId,
            round: roundCount,
            continuationCount,
            maxContinuations,
            accumulatedContentLength: accumulatedContent.length,
            finishReason,
          });

          // 构建续写消息
          const continuationMessage: Message = {
            role: 'user',
            content: `继续上一条未完成的回复，禁止重复已输出内容；如果停在 JSON / 标签 / 结构中间，请先补齐结构，再继续正文。`,
          };

          // 添加 assistant 的回复到消息历史
          messages.push({
            role: 'assistant',
            content: fullContent,
          });
          
          // 添加续写请求
          messages.push(continuationMessage);

          logger.info('stream_continuation_message_added', {
            traceId: effectiveTraceId,
            round: roundCount,
            continuationCount,
            messageCount: messages.length,
          });

          // 继续下一轮以获取续写内容
          continue;
        }

        // 如果是因为 length 停止但已达到最大续写次数，记录日志
        if (finishReason === 'length' && continuationCount >= maxContinuations) {
          logger.warn('stream_continuation_max_reached', {
            traceId: effectiveTraceId,
            round: roundCount,
            continuationCount,
            maxContinuations,
            accumulatedContentLength: accumulatedContent.length,
          });
        }

        // 没有工具调用，结束对话
        break;
      }

      // 发送完成信号
      callback({ type: 'done' });

      // 记录流完成 - 使用正确的工具调用统计
      logger.info('stream_complete', {
        traceId: effectiveTraceId,
        totalRounds: roundCount,
        hasToolCall: hasToolCallInSession,
        toolCallCount: totalToolCalls,
        isNormalTextResponse: !hasToolCallInSession,
        continuationCount,
        hadContinuation: continuationCount > 0,
      });
    } catch (error: any) {
      console.error('AI Stream Service Error:', error);

      // 记录流错误
      logger.error('stream_error', {
        traceId: effectiveTraceId,
        error: error?.message || String(error),
        stack: error?.stack,
        round: currentRound
      });

      callback({ type: 'error', error: String(error) });
    }
  }
}

// 导出单例实例
export const aiStreamService = new AIStreamService();
