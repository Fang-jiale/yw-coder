import OpenAI from 'openai';
import { AIRequest, AIResponse, CodeCompletionRequest, AIProviderConfig } from '../../shared/types';
import { SettingsService } from './settingsService';
import * as fs from 'fs/promises';
import * as path from 'path';
import { AgentConfig } from '../../shared/agentTypes';

// 预定义的提供商列表
export const PREDEFINED_PROVIDERS: Record<string, { name: string; defaultBaseUrl: string; models: string[]; defaultModel: string }> = {
  openai: {
    name: 'OpenAI',
    defaultBaseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo', 'o1-preview', 'o1-mini'],
    defaultModel: 'gpt-4o',
  },
  anthropic: {
    name: 'Anthropic',
    defaultBaseUrl: 'https://api.anthropic.com',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
    defaultModel: 'claude-3-5-sonnet-20241022',
  },
  google: {
    name: 'Google Gemini',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: ['gemini-2.0-flash-exp', 'gemini-2.0-pro-exp', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    defaultModel: 'gemini-2.0-flash-exp',
  },
  deepseek: {
    name: 'DeepSeek',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'],
    defaultModel: 'deepseek-chat',
  },
  minimax: {
    name: 'MiniMax',
    defaultBaseUrl: 'https://api.minimaxi.com/v1',
    models: ['MiniMax-M2.5', 'MiniMax-M2.5-highspeed', 'MiniMax-Text-01'],
    defaultModel: 'MiniMax-M2.5',
  },
  moonshot: {
    name: 'Moonshot (Kimi)',
    defaultBaseUrl: 'https://api.moonshot.cn/v1',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
    defaultModel: 'moonshot-v1-8k',
  },
  qwen: {
    name: 'Qwen (Aliyun)',
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen-coder-plus'],
    defaultModel: 'qwen-max',
  },
  baichuan: {
    name: 'Baichuan',
    defaultBaseUrl: 'https://api.baichuan-ai.com/v1',
    models: ['Baichuan4', 'Baichuan3-Turbo', 'Baichuan3-Turbo-128k'],
    defaultModel: 'Baichuan4',
  },
  ollama: {
    name: 'Ollama (Local)',
    defaultBaseUrl: 'http://localhost:11434/v1',
    models: ['llama3.2', 'llama3.1', 'codellama', 'mistral', 'qwen2.5'],
    defaultModel: 'llama3.2',
  },
  lmstudio: {
    name: 'LM Studio (Local)',
    defaultBaseUrl: 'http://localhost:1234/v1',
    models: ['local-model'],
    defaultModel: 'local-model',
  },
  openrouter: {
    name: 'OpenRouter',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    models: ['openai/gpt-4o', 'anthropic/claude-3.5-sonnet', 'google/gemini-pro'],
    defaultModel: 'openai/gpt-4o',
  },
  siliconflow: {
    name: 'SiliconFlow',
    defaultBaseUrl: 'https://api.siliconflow.cn/v1',
    models: ['Qwen/Qwen2.5-72B-Instruct', 'deepseek-ai/DeepSeek-V2.5'],
    defaultModel: 'Qwen/Qwen2.5-72B-Instruct',
  },
  custom: {
    name: 'Custom (OpenAI Compatible)',
    defaultBaseUrl: 'http://localhost:8000/v1',
    models: ['gpt-4', 'gpt-3.5-turbo'],
    defaultModel: 'gpt-4',
  },
};

class AIService {
  private settingsService: SettingsService;
  private clients: Map<string, OpenAI> = new Map();

  constructor(settingsService: SettingsService) {
    this.settingsService = settingsService;
  }

  // 获取所有配置
  getConfigs(): AIProviderConfig[] {
    const configs = (this.settingsService.get('aiConfigs') || []) as AIProviderConfig[];
    return configs;
  }

  // 获取指定配置
  getConfig(configId: string): AIProviderConfig | undefined {
    const configs = this.getConfigs();
    return configs.find(c => c.id === configId);
  }

  // 获取当前激活的配置
  getActiveConfig(): AIProviderConfig | null {
    const configs = this.getConfigs();
    const activeId = this.settingsService.get('activeConfigId');
    
    if (activeId) {
      const config = configs.find(c => c.id === activeId);
      if (config) {
        return config;
      }
    }
    
    // 返回默认配置
    const defaultConfig = configs.find(c => c.isDefault);
    if (defaultConfig) {
      return defaultConfig;
    }
    
    // 返回第一个配置
    if (configs.length > 0) {
      return configs[0];
    }
    
    return null;
  }

  // 保存配置
  saveConfig(config: AIProviderConfig): void {
    console.log('[AIService] Saving config:', {
      id: config.id,
      name: config.name,
      provider: config.provider,
      apiKey: config.apiKey ? `${config.apiKey.substring(0, 10)}...` : 'empty',
      groupId: config.groupId || 'not set',
    });
    
    const configs = this.getConfigs();
    const existingIndex = configs.findIndex(c => c.id === config.id);
    
    if (existingIndex >= 0) {
      configs[existingIndex] = config;
    } else {
      configs.push(config);
    }
    
    this.settingsService.set('aiConfigs', configs);

    // 如果是第一个配置或设置为默认，自动激活
    if (configs.length === 1 || config.isDefault) {
      this.setActiveConfig(config.id);
    }

    // 清除缓存的客户端
    this.clients.delete(config.id);

    // 注意：保存配置时不自动同步 Agent 配置
    // Agent 配置只在对话框切换配置时更新
  }

  // 删除配置
  deleteConfig(configId: string): void {
    const configs = this.getConfigs().filter(c => c.id !== configId);
    this.settingsService.set('aiConfigs', configs);
    this.clients.delete(configId);
    
    // 如果删除的是当前激活的配置，重新选择
    const activeId = this.settingsService.get('activeConfigId');
    if (activeId === configId) {
      if (configs.length > 0) {
        this.setActiveConfig(configs[0].id);
      } else {
        this.settingsService.set('activeConfigId', '');
      }
    }
  }

  // 设置激活的配置
  setActiveConfig(configId: string): void {
    this.settingsService.set('activeConfigId', configId);
  }

  // 获取或创建 OpenAI 客户端
  private getClient(config?: AIProviderConfig): OpenAI {
    const activeConfig = config || this.getActiveConfig();
    
    if (!activeConfig) {
      throw new Error('No AI configuration found. Please add a configuration in settings.');
    }

    // 检查缓存
    if (this.clients.has(activeConfig.id)) {
      return this.clients.get(activeConfig.id)!;
    }

    const providerInfo = PREDEFINED_PROVIDERS[activeConfig.provider];
    let baseURL = activeConfig.baseUrl;
    if (!baseURL) {
      baseURL = providerInfo?.defaultBaseUrl || 'https://api.openai.com/v1';
    }
    
    console.log('Creating OpenAI client:', {
      provider: activeConfig.provider,
      baseURL,
      apiKey: activeConfig.apiKey ? '***' : 'empty',
      model: activeConfig.model,
    });

    if (!activeConfig.apiKey) {
      throw new Error(`API key is required for ${activeConfig.name}`);
    }

    // MiniMax 需要 GroupId header
    const defaultHeaders = activeConfig.provider === 'minimax' && activeConfig.groupId ? {
      'GroupId': activeConfig.groupId,
    } : undefined;

    const client = new OpenAI({
      baseURL,
      apiKey: activeConfig.apiKey,
      timeout: 60000,
      defaultHeaders,
    });

    this.clients.set(activeConfig.id, client);
    return client;
  }

  // 聊天
  async chat(request: AIRequest, configId?: string): Promise<AIResponse> {
    let config: AIProviderConfig | undefined;
    
    if (configId) {
      config = this.getConfigs().find(c => c.id === configId);
    }
    
    const activeConfig = config || this.getActiveConfig();
    
    if (!activeConfig) {
      throw new Error('No AI configuration found');
    }

    // 清除缓存以确保使用最新配置
    this.clients.delete(activeConfig.id);
    
    const client = this.getClient(config);

    try {
      const messages = request.messages.map(msg => {
        if (msg.role === 'tool') {
          return {
            role: 'tool' as const,
            content: msg.content,
            tool_call_id: msg.toolCallId || '',
          };
        }
        return {
          role: msg.role as 'system' | 'user' | 'assistant',
          content: msg.content,
        };
      });

      const response = await client.chat.completions.create({
        model: request.model || activeConfig.model,
        messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens,
      });

      return {
        content: response.choices[0]?.message?.content || '',
        usage: response.usage ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        } : undefined,
      };
    } catch (error: any) {
      console.error('AI chat error:', error);
      throw new Error(`AI request failed: ${error.message}`);
    }
  }

  // 流式聊天
  async *streamChat(request: AIRequest, configId?: string): AsyncGenerator<string> {
    let config: AIProviderConfig | undefined;
    
    if (configId) {
      config = this.getConfigs().find(c => c.id === configId);
    }
    
    const activeConfig = config || this.getActiveConfig();
    
    if (!activeConfig) {
      throw new Error('No AI configuration found. Please add a configuration in settings.');
    }

    // 清除缓存以确保使用最新配置
    this.clients.delete(activeConfig.id);

    try {
      const client = this.getClient(config);
      
      const messages = request.messages.map(msg => {
        if (msg.role === 'tool') {
          return {
            role: 'tool' as const,
            content: msg.content,
            tool_call_id: msg.toolCallId || '',
          };
        }
        return {
          role: msg.role as 'system' | 'user' | 'assistant',
          content: msg.content,
        };
      });

      const stream = await client.chat.completions.create({
        model: request.model || activeConfig.model,
        messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      }
    } catch (error: any) {
      console.error('AI stream error:', error);
      
      // 提供更详细的错误信息
      let errorMessage = error.message || 'Unknown error';
      
      if (error.status === 404) {
        errorMessage = `API endpoint not found (404). Please check your Base URL. Current: ${activeConfig.baseUrl || 'default'}`;
      } else if (error.status === 401) {
        errorMessage = 'Authentication failed (401). Please check your API Key.';
      } else if (error.status === 429) {
        errorMessage = 'Rate limit exceeded (429). Please try again later.';
      } else if (error.code === 'ECONNREFUSED') {
        errorMessage = 'Connection refused. Please check your network or Base URL.';
      }
      
      throw new Error(`AI stream failed: ${errorMessage}`);
    }
  }

  // 代码补全
  async complete(request: CodeCompletionRequest, configId?: string): Promise<string> {
    const client = this.getClient();
    const activeConfig = this.getActiveConfig();
    
    if (!activeConfig) {
      return '';
    }

    try {
      const response = await client.chat.completions.create({
        model: activeConfig.model,
        messages: [
          {
            role: 'system',
            content: 'You are a code completion assistant. Complete the code based on the context. Only return the completion, no explanations.',
          },
          {
            role: 'user',
            content: `Language: ${request.language}\nContext:\n${request.context}\n\nComplete the code at the cursor position.`,
          },
        ],
        temperature: 0.2,
        max_tokens: 150,
      });

      return response.choices[0]?.message?.content || '';
    } catch (error: any) {
      console.error('Code completion error:', error);
      return '';
    }
  }

  // 测试连接
  async testConnection(configId?: string): Promise<{ success: boolean; message: string }> {
    let config: AIProviderConfig | undefined;
    
    if (configId) {
      config = this.getConfigs().find(c => c.id === configId);
    } else {
      config = this.getActiveConfig() || undefined;
    }
    
    if (!config) {
      return { success: false, message: 'No AI configuration found' };
    }

    console.log('Testing connection for config:', config.name, 'provider:', config.provider, 'baseUrl:', config.baseUrl);

    try {
      // 清除缓存以确保使用最新配置
      this.clients.delete(config.id);
      
      const client = this.getClient(config);
      
      const response = await client.chat.completions.create({
        model: config.model,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5,
      });

      if (response.choices[0]?.message?.content) {
        return { success: true, message: 'Connection successful!' };
      }
      
      return { success: false, message: 'No response from AI' };
    } catch (error: any) {
      console.error('Test connection error:', error);
      
      // 提供更详细的错误信息
      let errorMessage = error.message || 'Unknown error';
      
      if (error.status === 404) {
        errorMessage = `API endpoint not found (404). Please check your Base URL. Current: ${config.baseUrl || 'default'}`;
      } else if (error.status === 401) {
        errorMessage = 'Authentication failed (401). Please check your API Key.';
      } else if (error.status === 429) {
        errorMessage = 'Rate limit exceeded (429). Please try again later.';
      } else if (error.code === 'ECONNREFUSED') {
        errorMessage = 'Connection refused. Please check your network or Base URL.';
      }
      
      return { 
        success: false, 
        message: `Connection failed: ${errorMessage}` 
      };
    }
  }

  // 获取预定义的提供商列表
  getPredefinedProviders(): Record<string, { name: string; defaultBaseUrl: string; models: string[]; defaultModel: string }> {
    return PREDEFINED_PROVIDERS;
  }
}

export default AIService;
