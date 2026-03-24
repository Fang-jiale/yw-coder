import OpenAI from 'openai';
import { AIProviderConfig } from '../../shared/types';
import { SettingsService } from './settingsService';

export interface AIProvider {
  chat(messages: any[], options?: ChatOptions): Promise<AIResponse>;
  stream(messages: any[], options?: StreamOptions): AsyncGenerator<string>;
  complete(prompt: string, options?: CompleteOptions): Promise<string>;
  testConnection(): Promise<{ success: boolean; message: string }>;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface StreamOptions extends ChatOptions {
  onChunk?: (chunk: string) => void;
  onThinking?: (thinking: string) => void;
  onToolCall?: (toolCall: any) => void;
}

export interface CompleteOptions {
  model?: string;
  maxTokens?: number;
}

export interface AIResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  toolCalls?: any[];
}

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

export class OpenAIProvider implements AIProvider {
  private client: OpenAI;
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
    this.client = this.createClient();
  }

  private createClient(): OpenAI {
    const providerInfo = PREDEFINED_PROVIDERS[this.config.provider];
    let baseURL = this.config.baseUrl;
    if (!baseURL) {
      baseURL = providerInfo?.defaultBaseUrl || 'https://api.openai.com/v1';
    }

    const defaultHeaders = this.config.provider === 'minimax' && this.config.groupId ? {
      'GroupId': this.config.groupId,
    } : undefined;

    return new OpenAI({
      baseURL,
      apiKey: this.config.apiKey,
      timeout: 60000,
      defaultHeaders,
    });
  }

  async chat(messages: any[], options?: ChatOptions): Promise<AIResponse> {
    const model = options?.model || this.config.model;
    const response = await this.client.chat.completions.create({
      model,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens,
    });

    return {
      content: response.choices[0]?.message?.content || '',
      usage: response.usage ? {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
      } : undefined,
    };
  }

  async *stream(messages: any[], options?: StreamOptions): AsyncGenerator<string> {
    const model = options?.model || this.config.model;
    const stream = await this.client.chat.completions.create({
      model,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        if (options?.onChunk) {
          options.onChunk(content);
        }
        yield content;
      }
    }
  }

  async complete(prompt: string, options?: CompleteOptions): Promise<string> {
    const model = options?.model || this.config.model;
    const response = await this.client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: 'You are a code completion assistant.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: options?.maxTokens || 150,
    });

    return response.choices[0]?.message?.content || '';
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5,
      });

      if (response.choices[0]?.message?.content) {
        return { success: true, message: 'Connection successful!' };
      }
      return { success: false, message: 'No response from AI' };
    } catch (error: any) {
      let errorMessage = error.message || 'Unknown error';
      if (error.status === 404) {
        errorMessage = `API endpoint not found (404). Please check your Base URL.`;
      } else if (error.status === 401) {
        errorMessage = 'Authentication failed (401). Please check your API Key.';
      } else if (error.status === 429) {
        errorMessage = 'Rate limit exceeded (429). Please try again later.';
      } else if (error.code === 'ECONNREFUSED') {
        errorMessage = 'Connection refused. Please check your network or Base URL.';
      }
      return { success: false, message: `Connection failed: ${errorMessage}` };
    }
  }
}

export class UnifiedAIProvider {
  private settingsService: SettingsService;
  private clients: Map<string, OpenAIProvider> = new Map();

  constructor(settingsService: SettingsService) {
    this.settingsService = settingsService;
  }

  getConfigs(): AIProviderConfig[] {
    return (this.settingsService.get('aiConfigs') || []) as AIProviderConfig[];
  }

  getConfig(configId: string): AIProviderConfig | undefined {
    return this.getConfigs().find(c => c.id === configId);
  }

  getActiveConfig(): AIProviderConfig | null {
    const configs = this.getConfigs();
    const activeId = this.settingsService.get('activeConfigId');
    
    if (activeId) {
      const config = configs.find(c => c.id === activeId);
      if (config) return config;
    }
    
    const defaultConfig = configs.find(c => c.isDefault);
    if (defaultConfig) return defaultConfig;
    
    return configs.length > 0 ? configs[0] : null;
  }

  getProvider(config?: AIProviderConfig): OpenAIProvider {
    const activeConfig = config || this.getActiveConfig();
    if (!activeConfig) {
      throw new Error('No AI configuration found. Please add a configuration in settings.');
    }

    if (this.clients.has(activeConfig.id)) {
      return this.clients.get(activeConfig.id)!;
    }

    const provider = new OpenAIProvider(activeConfig);
    this.clients.set(activeConfig.id, provider);
    return provider;
  }

  saveConfig(config: AIProviderConfig): void {
    const configs = this.getConfigs();
    const existingIndex = configs.findIndex(c => c.id === config.id);
    
    if (existingIndex >= 0) {
      configs[existingIndex] = config;
    } else {
      configs.push(config);
    }
    
    this.settingsService.set('aiConfigs', configs);
    this.clients.delete(config.id);

    if (configs.length === 1 || config.isDefault) {
      this.setActiveConfig(config.id);
    }
  }

  deleteConfig(configId: string): void {
    const configs = this.getConfigs().filter(c => c.id !== configId);
    this.settingsService.set('aiConfigs', configs);
    this.clients.delete(configId);
    
    const activeId = this.settingsService.get('activeConfigId');
    if (activeId === configId) {
      if (configs.length > 0) {
        this.setActiveConfig(configs[0].id);
      } else {
        this.settingsService.set('activeConfigId', '');
      }
    }
  }

  setActiveConfig(configId: string): void {
    this.settingsService.set('activeConfigId', configId);
  }

  getPredefinedProviders() {
    return PREDEFINED_PROVIDERS;
  }
}
