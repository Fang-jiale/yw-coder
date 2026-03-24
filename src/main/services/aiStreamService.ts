import OpenAI from 'openai';
import type { Stream } from 'openai/streaming';
import * as fs from 'fs/promises';
import * as path from 'path';
import { AIProviderConfig } from '../../shared/types';
import { PREDEFINED_PROVIDERS } from './aiProvider';
import { AIToolService, ToolCall, ToolResult, TOOLS, ToolName } from './aiToolService';
import { logService } from './logService';

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
 * 裁剪历史消息以适应上下文长度
 */
function trimHistoryMessages(
  messages: Message[],
  maxTokens: number,
  systemPromptLength: number
): Message[] {
  const availableTokens = maxTokens - systemPromptLength - TOOL_RESULT_RESERVE;
  let currentTokens = 0;
  const trimmedMessages: Message[] = [];

  // 从后往前遍历，保留最近的消息
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const msgTokens = estimateTokens(msg.content || '');

    if (currentTokens + msgTokens > availableTokens) {
      // 如果超出限制，停止添加
      break;
    }

    trimmedMessages.unshift(msg);
    currentTokens += msgTokens;
  }

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
      isRunning?: () => boolean;
    }
  ): Promise<void> {
    const client = this.getClient(config);
    const model = this.getModel(config);
    const toolService = new AIToolService(workspacePath);

    // 检测模型能力
    const useFunctionCall = detectFunctionCallSupport(model, config);
    const contextLength = getContextLength(config);
    const maxTokens = config.maxTokens || 4000;

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
    promptParts.push('- 执行文件写入工具调用（必须使用 file 标签）');
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
    
    // 8. Few-shot 示例
    promptParts.push('## 示例');
    promptParts.push('');
    promptParts.push('### 示例 1：创建新功能');
    promptParts.push('');
    promptParts.push('用户：帮我创建一个用户登录功能');
    promptParts.push('');
    promptParts.push('你的响应：');
    promptParts.push('<think>');
    promptParts.push('用户需要创建一个用户登录功能。我需要：');
    promptParts.push('1. 先了解项目使用的技术栈');
    promptParts.push('2. 查看是否已有用户相关的代码');
    promptParts.push('3. 设计登录功能的实现方案');
    promptParts.push('</think>');
    promptParts.push('');
    promptParts.push('<todo>');
    promptParts.push('<task id="1" status="in_progress">分析项目技术栈和现有代码</task>');
    promptParts.push('<task id="2" status="pending">设计登录功能方案</task>');
    promptParts.push('<task id="3" status="pending">实现登录功能</task>');
    promptParts.push('</todo>');
    promptParts.push('');
    promptParts.push('<question>');
    promptParts.push('你希望使用什么技术栈实现登录功能？例如：');
    promptParts.push('- JWT + 本地存储');
    promptParts.push('- Session + Cookie');
    promptParts.push('- OAuth 第三方登录');
    promptParts.push('</question>');
    promptParts.push('');
    
    // 9. 错误处理
    promptParts.push('## 错误处理');
    promptParts.push('');
    promptParts.push('当遇到错误时：');
    promptParts.push('');
    promptParts.push('1. **不要慌张**：冷静分析错误信息');
    promptParts.push('2. **定位问题**：确定错误发生的位置和原因');
    promptParts.push('3. **提供解决方案**：给出具体的修复步骤');
    promptParts.push('4. **预防建议**：说明如何避免类似错误');
    promptParts.push('');
    promptParts.push('如果错误无法解决，诚实地告诉用户，并提供替代方案。');
    promptParts.push('');
    
    // 10. 上下文管理
    promptParts.push('## 上下文管理');
    promptParts.push('');
    promptParts.push('为了高效利用上下文窗口：');
    promptParts.push('');
    promptParts.push('- 优先读取关键文件，避免一次性读取过多内容');
    promptParts.push('- 使用搜索工具快速定位相关代码');
    promptParts.push('- 如果文件太大，先读取关键部分，需要时再读取其他部分');
    promptParts.push('- 及时总结已读取的信息，避免重复读取');
    promptParts.push('');
    
    // 11. 最佳实践
    promptParts.push('## 最佳实践');
    promptParts.push('');
    promptParts.push('### 代码质量');
    promptParts.push('- 编写清晰、可维护的代码');
    promptParts.push('- 添加必要的注释，特别是复杂的逻辑');
    promptParts.push('- 遵循项目已有的代码风格和规范');
    promptParts.push('- 考虑边界情况和错误处理');
    promptParts.push('');
    promptParts.push('### 沟通方式');
    promptParts.push('- 使用中文与用户交流');
    promptParts.push('- 解释技术决策的原因，不只是做什么');
    promptParts.push('- 提供多种方案时，说明各自的优缺点');
    promptParts.push('- 主动确认理解是否正确');
    promptParts.push('');
    promptParts.push('### 任务管理');
    promptParts.push('- 复杂任务先规划，再执行');
    promptParts.push('- 频繁更新 todo 状态，让用户了解进展');
    promptParts.push('- 遇到阻碍及时反馈，不要长时间无响应');
    promptParts.push('- 完成时简要总结做了什么');
    promptParts.push('');
    
    // 12. 工具使用策略
    promptParts.push('## 工具使用策略');
    promptParts.push('');
    promptParts.push('### 何时使用搜索');
    promptParts.push('- 需要了解项目整体结构时');
    promptParts.push('- 查找特定功能或代码片段时');
    promptParts.push('- 不确定文件位置时');
    promptParts.push('- 需要查找相关依赖或配置时');
    promptParts.push('');
    promptParts.push('### 何时读取文件');
    promptParts.push('- 需要理解具体实现逻辑时');
    promptParts.push('- 需要修改或参考现有代码时');
    promptParts.push('- 需要查看配置文件内容时');
    promptParts.push('- 搜索结果显示相关文件后');
    promptParts.push('');
    promptParts.push('### 工具组合使用');
    promptParts.push('1. 先搜索定位 → 2. 读取关键文件 → 3. 分析理解 → 4. 执行修改');
    promptParts.push('避免：不搜索直接读取大量文件，或反复读取同一文件');
    promptParts.push('');
    
    // 13. 代码审查指导
    promptParts.push('## 代码审查指导');
    promptParts.push('');
    promptParts.push('当审查代码时，关注以下方面：');
    promptParts.push('');
    promptParts.push('### 功能性');
    promptParts.push('- 代码是否正确实现了需求？');
    promptParts.push('- 是否处理了边界情况？');
    promptParts.push('- 是否有潜在的 Bug？');
    promptParts.push('');
    promptParts.push('### 可读性');
    promptParts.push('- 命名是否清晰有意义？');
    promptParts.push('- 函数是否过长？是否需要拆分？');
    promptParts.push('- 注释是否充分说明了复杂逻辑？');
    promptParts.push('');
    promptParts.push('### 可维护性');
    promptParts.push('- 代码是否遵循单一职责原则？');
    promptParts.push('- 是否有重复代码需要提取？');
    promptParts.push('- 依赖关系是否清晰？');
    promptParts.push('');
    promptParts.push('### 性能');
    promptParts.push('- 是否有明显的性能瓶颈？');
    promptParts.push('- 是否有不必要的计算或渲染？');
    promptParts.push('- 数据结构选择是否合理？');
    promptParts.push('');
    
    // 14. 安全最佳实践
    promptParts.push('## 安全最佳实践');
    promptParts.push('');
    promptParts.push('编写代码时，始终考虑安全性：');
    promptParts.push('');
    promptParts.push('### 输入验证');
    promptParts.push('- 永远不要信任用户输入');
    promptParts.push('- 对所有输入进行验证和清理');
    promptParts.push('- 使用参数化查询防止 SQL 注入');
    promptParts.push('');
    promptParts.push('### 敏感数据');
    promptParts.push('- 不要将密码、密钥等硬编码在代码中');
    promptParts.push('- 使用环境变量或安全的密钥管理系统');
    promptParts.push('- 日志中不要输出敏感信息');
    promptParts.push('');
    promptParts.push('### 常见漏洞防护');
    promptParts.push('- XSS：对用户输入进行转义');
    promptParts.push('- CSRF：使用 CSRF Token');
    promptParts.push('- 路径遍历：验证文件路径');
    promptParts.push('');
    
    // 15. 性能优化
    promptParts.push('## 性能优化');
    promptParts.push('');
    promptParts.push('### 前端性能');
    promptParts.push('- 避免不必要的重渲染');
    promptParts.push('- 图片懒加载和压缩');
    promptParts.push('- 代码分割，按需加载');
    promptParts.push('- 使用缓存策略');
    promptParts.push('');
    promptParts.push('### 后端性能');
    promptParts.push('- 数据库查询优化，添加索引');
    promptParts.push('- 使用缓存减少重复计算');
    promptParts.push('- 异步处理耗时操作');
    promptParts.push('- 避免 N+1 查询问题');
    promptParts.push('');
    promptParts.push('### 算法优化');
    promptParts.push('- 选择合适的数据结构');
    promptParts.push('- 关注时间复杂度和空间复杂度');
    promptParts.push('- 对于大数据量，考虑分批处理');
    promptParts.push('');
    
    // 16. 更多示例
    promptParts.push('## 更多示例');
    promptParts.push('');
    promptParts.push('### 示例 3：代码重构');
    promptParts.push('');
    promptParts.push('用户：这段代码太乱了，帮我重构一下');
    promptParts.push('（用户提供了代码片段）');
    promptParts.push('');
    promptParts.push('你的响应：');
    promptParts.push('<think>');
    promptParts.push('这段代码存在以下问题：');
    promptParts.push('1. 函数过长，职责不单一');
    promptParts.push('2. 变量命名不清晰');
    promptParts.push('3. 有重复代码可以提取');
    promptParts.push('4. 缺少错误处理');
    promptParts.push('重构方案：');
    promptParts.push('- 将大函数拆分为多个小函数');
    promptParts.push('- 使用有意义的变量名');
    promptParts.push('- 提取重复逻辑为工具函数');
    promptParts.push('- 添加适当的错误处理');
    promptParts.push('</think>');
    promptParts.push('');
    promptParts.push('<todo>');
    promptParts.push('<task id="1" status="in_progress">分析代码问题</task>');
    promptParts.push('<task id="2" status="pending">拆分大函数</task>');
    promptParts.push('<task id="3" status="pending">优化变量命名</task>');
    promptParts.push('<task id="4" status="pending">提取重复代码</task>');
    promptParts.push('</todo>');
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

    // 根据模型是否支持 Function Call 添加不同的工具调用说明
    if (useFunctionCall) {
      // 支持 Function Call 的模型使用原生格式，不需要额外说明
      baseSystemPrompt += '\n\n【注意】本模型支持 Function Call，工具调用会自动处理。';
    } else {
      // 不支持 Function Call 的模型需要使用 XML 标签格式
      baseSystemPrompt += '\n\n【重要】本模型不支持 Function Call，工具调用需要使用 XML 标签格式：';
      baseSystemPrompt += '\n- 读取文件: <invoke name="read_file"><parameter name="file_path">路径</parameter></invoke>';
      baseSystemPrompt += '\n- 搜索文件: <invoke name="search_files"><parameter name="pattern">模式</parameter></invoke>';
      baseSystemPrompt += '\n- 列出目录: <invoke name="list_files"><parameter name="path">路径</parameter></invoke>';
      baseSystemPrompt += '\n- 执行命令: <invoke name="execute_command"><parameter name="command">命令</parameter></invoke>';
      baseSystemPrompt += '\n所有工具调用必须包裹在 <function_calls>...</function_calls> 标签内。';
    }

    // 构建历史消息
    const historyMessages: Message[] = [];
    if (context?.history && context.history.length > 0) {
      for (const msg of context.history) {
        historyMessages.push({ role: msg.role, content: msg.content });
      }
    }

    // 添加当前用户输入
    historyMessages.push({ role: 'user', content: userInput });

    // 裁剪历史消息以适应上下文长度
    const systemPromptLength = estimateTokens(baseSystemPrompt);
    const trimmedHistory = trimHistoryMessages(historyMessages, contextLength, systemPromptLength);

    // 构建最终消息数组（不包含 system 消息，后面单独添加）
    let messages: Message[] = [...trimmedHistory];

    let allThinking = '';

    try {
      // 使用 while 循环，限制最大轮数防止无限循环
      let roundCount = 0;
      const maxRounds = 30; // 增加最大轮数，让AI有足够时间收集信息并生成回复
      
      while (roundCount < maxRounds) {
        roundCount++;

        // 每次请求都重新构建消息数组，确保 system 消息在最前面且只出现一次
        const requestMessages: Message[] = [
          { role: 'system', content: baseSystemPrompt },
          ...messages,
        ];

        const requestParams: any = {
          model,
          messages: requestMessages,
          stream: true,
        };

        requestParams.temperature = 0.3;
        requestParams.max_tokens = maxTokens;

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

        try {
          for await (const chunk of stream) {
            // 安全检查 chunk 结构
            if (!chunk || !chunk.choices || !Array.isArray(chunk.choices) || chunk.choices.length === 0) {
              continue;
            }
            
            const delta = chunk.choices[0]?.delta;
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
                    callback({
                      type: 'tool_start',
                      toolName: 'edit_file' as ToolName,
                      toolParams: { file_path: fileEditPath },
                      toolCallId: fileEditToolCallId,
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
                      callback({ type: 'content', content: beforeFile });
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
                    try {
                      await fs.mkdir(path.dirname(fullPath), { recursive: true });
                      await fs.writeFile(fullPath, fileEditContent, 'utf-8');
                      console.log(`[AIStreamService] File written successfully: ${fullPath}`);
                    } catch (error) {
                      console.error(`[AIStreamService] Failed to write file: ${fullPath}`, error);
                    }

                    // 发送 tool_end 回调，标记文件操作完成
                    callback({
                      type: 'tool_end',
                      toolName: 'edit_file' as ToolName,
                      toolResult: {
                        tool: 'edit_file' as ToolName,
                        success: true,
                        data: { file_path: fileEditPath },
                      },
                      toolCallId: fileEditToolCallId,
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
                      callback({ type: 'content', content: filtered });
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
                    callback({ type: 'thinking', content: finalThinkChunk });
                  }
                  // 记录完整的 think 内容到 roundThinking（用于历史记录）
                  if (thinkContent) {
                    roundThinking += (roundThinking ? '\n' : '') + thinkContent;
                  }
                  // 发送思考完成信号，让前端知道思考过程已结束
                  callback({ type: 'thinking_complete', content: roundThinking });
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
                  callback({ type: 'thinking', content: buffer });
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
                      callback({ type: 'content', content: filtered });
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
                  const todoItems: Array<{ id: string; content: string; status: 'pending' | 'in_progress' | 'completed' | 'failed' }> = [];
                  const taskRegex = /<task\s+id="([^"]+)"\s+status="([^"]+)">(.*?)<\/task>/g;
                  let taskMatch;
                  while ((taskMatch = taskRegex.exec(todoContent)) !== null) {
                    todoItems.push({
                      id: taskMatch[1],
                      status: taskMatch[2] as 'pending' | 'in_progress' | 'completed' | 'failed',
                      content: taskMatch[3].trim(),
                    });
                  }

                  if (todoItems.length > 0) {
                    callback({
                      type: 'todo_update',
                      todoItems,
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
                      callback({ type: 'content', content: filtered });
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
                    callback({
                      type: 'agent_question',
                      question: {
                        id: questionId,
                        question: finalQuestionText,
                        options: options.length > 0 ? options : undefined,
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
                  callback({ type: 'content', content: filtered });
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
            try {
              await fs.mkdir(path.dirname(fullPath), { recursive: true });
              await fs.writeFile(fullPath, fileEditContent, 'utf-8');
              console.log(`[AIStreamService] File written successfully (forced): ${fullPath}`);
            } catch (error) {
              console.error(`[AIStreamService] Failed to write file (forced): ${fullPath}`, error);
            }
            
            // 发送 tool_end 回调
            callback({
              type: 'tool_end',
              toolName: 'edit_file' as ToolName,
              toolResult: {
                tool: 'edit_file' as ToolName,
                success: true,
                data: { file_path: fileEditPath },
              },
              toolCallId: fileEditToolCallId,
            });
          } else if (inThinkBlock) {
            // 未闭合的 think 块
            thinkContent += buffer;
            roundThinking += thinkContent;
            callback({ type: 'thinking', content: buffer });
          } else {
            // 普通内容
            const filtered = this.filterToolCalls(buffer);
            if (filtered) {
              callback({ type: 'content', content: filtered });
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

        // 执行工具调用
        if (toolCalls.length > 0) {
          console.log('[AIStreamService] Executing tool calls:', toolCalls.length);
          
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
            callback({
              type: 'tool_start',
              toolName: toolCall.tool,
              toolParams: toolCall.params,
              toolCallId,
            });

            const result = await toolService.executeTool(toolCall);
            console.log(`[AIStreamService] Tool executed: ${toolCallId}, success: ${result.success}`);

            // 发送 tool_end 回调
            console.log(`[AIStreamService] Sending tool_end: ${toolCallId}`);
            callback({
              type: 'tool_end',
              toolName: toolCall.tool,
              toolResult: result,
              toolCallId,
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

        // 记录完整的流式返回内容
        logService.info('[AIStreamService] ========== 流式返回完整内容 ==========');
        logService.info('[AIStreamService] fullContent 长度:', fullContent.length);
        logService.info('[AIStreamService] fullContent 内容:');
        logService.info(fullContent);
        logService.info('[AIStreamService] ========== 流式返回内容结束 ==========');
        
        // 记录思考过程
        if (roundThinking) {
          logService.info('[AIStreamService] 思考过程:');
          logService.info(roundThinking);
        }
        
        // 记录工具调用
        if (toolCalls.length > 0) {
          logService.info('[AIStreamService] 工具调用数量:', toolCalls.length);
          logService.info('[AIStreamService] 工具调用详情:', JSON.stringify(toolCalls));
        }
        
        // 没有工具调用，结束对话
        break;
      }

      // 发送完成信号
      callback({ type: 'done' });
    } catch (error) {
      console.error('AI Stream Service Error:', error);
      logService.error('[AIStreamService] AI Stream Service Error:', error);
      callback({ type: 'error', error: String(error) });
    }
  }
}

// 导出单例实例
export const aiStreamService = new AIStreamService();
