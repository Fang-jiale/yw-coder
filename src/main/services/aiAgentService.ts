import OpenAI from 'openai';
import { AIProviderConfig } from '../../shared/types';
import { PREDEFINED_PROVIDERS } from './aiService';
import { AIToolService, ToolCall, ToolResult } from './aiToolService';

export interface AgentMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AgentResponse {
  message: string;
  toolCalls: ToolCall[];
  toolResults: ToolResult[];
}

/**
 * AI Agent Service - 支持自动工具调用的 AI 服务
 * 实现多轮对话和自动工具执行
 */
export class AIAgentService {
  private clients: Map<string, OpenAI> = new Map();

  private getClient(config: AIProviderConfig): OpenAI {
    if (this.clients.has(config.id)) {
      return this.clients.get(config.id)!;
    }

    const providerInfo = PREDEFINED_PROVIDERS[config.provider];
    const baseURL = config.baseUrl || providerInfo?.defaultBaseUrl || 'https://api.openai.com/v1';

    const client = new OpenAI({
      apiKey: config.apiKey,
      baseURL,
      timeout: 120000,
    });

    this.clients.set(config.id, client);
    return client;
  }

  private getModel(config: AIProviderConfig): string {
    const providerInfo = PREDEFINED_PROVIDERS[config.provider];
    return config.model || providerInfo?.defaultModel || 'gpt-4o';
  }

  /**
   * 执行 AI 对话，支持自动工具调用
   * 最多执行 5 轮工具调用
   */
  async executeWithTools(
    userInput: string,
    workspacePath: string,
    config: AIProviderConfig,
    context?: {
      openFilePaths?: string[];
      selection?: { filePath: string; code: string; startLine: number; endLine: number; language: string };
    }
  ): Promise<AgentResponse> {
    const client = this.getClient(config);
    const model = this.getModel(config);
    const toolService = new AIToolService(workspacePath);

    // 构建系统提示词
    const systemPrompt = `你是 ywcoder，一个智能编程助手。你可以帮助用户编写、修改、理解和优化代码。

${toolService.getToolsSystemPrompt()}

工作流程：
1. 分析用户的需求
2. 使用工具获取必要的信息（如读取文件、搜索代码）
3. 根据工具返回的结果，决定下一步操作
4. 如果需要修改代码，先读取文件，然后使用 edit_file 工具
5. 完成操作后，向用户说明做了什么

重要提示：
- 你可以在一次响应中使用多个工具
- 工具会被立即执行，执行结果会返回给你
- 基于工具返回的结果继续操作
- 修改文件前务必先读取文件内容
- 使用精确的字符串匹配来编辑文件

当前工作区: ${workspacePath}
${context?.selection ? `\n用户选中了 ${context.selection.filePath} 的第 ${context.selection.startLine}-${context.selection.endLine} 行` : ''}`;

    const messages: AgentMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userInput },
    ];

    const allToolCalls: ToolCall[] = [];
    const allToolResults: ToolResult[] = [];

    // 最多 5 轮工具调用
    for (let round = 0; round < 5; round++) {
      const response = await client.chat.completions.create({
        model,
        messages: messages as any,
        temperature: 0.3,
        max_tokens: 4000,
      });

      const aiMessage = response.choices[0]?.message?.content || '';

      // 解析工具调用
      const toolCalls = toolService.parseToolCalls(aiMessage);

      // 如果没有工具调用，返回结果
      if (toolCalls.length === 0) {
        return {
          message: aiMessage,
          toolCalls: allToolCalls,
          toolResults: allToolResults,
        };
      }

      // 执行工具调用
      const toolResults: ToolResult[] = [];
      for (const toolCall of toolCalls) {
        const result = await toolService.executeTool(toolCall);
        toolResults.push(result);
        allToolCalls.push(toolCall);
        allToolResults.push(result);
      }

      // 构建工具执行结果的消息
      const toolResultsMessage = toolResults
        .map((result, index) => {
          const call = toolCalls[index];
          if (result.success) {
            return `[工具执行成功] ${call.tool}:\n${JSON.stringify(result.data, null, 2)}`;
          } else {
            return `[工具执行失败] ${call.tool}:\n${result.error}`;
          }
        })
        .join('\n\n');

      // 添加 AI 的响应和工具结果到对话历史
      messages.push({ role: 'assistant', content: aiMessage });
      messages.push({
        role: 'user',
        content: `工具执行结果：\n\n${toolResultsMessage}\n\n请基于以上结果继续操作。如果任务已完成，请向用户说明做了什么。`,
      });
    }

    // 如果达到最大轮数，返回最后结果
    const finalResponse = await client.chat.completions.create({
      model,
      messages: messages as any,
      temperature: 0.3,
      max_tokens: 4000,
    });

    return {
      message: finalResponse.choices[0]?.message?.content || '',
      toolCalls: allToolCalls,
      toolResults: allToolResults,
    };
  }
}

export const aiAgentService = new AIAgentService();
