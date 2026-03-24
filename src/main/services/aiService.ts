import { AIRequest, AIResponse, CodeCompletionRequest, AIProviderConfig } from '../../shared/types';
import { SettingsService } from './settingsService';
import { 
  UnifiedAIProvider, 
  PREDEFINED_PROVIDERS,
  OpenAIProvider 
} from './aiProvider';

class AIService {
  private unifiedProvider: UnifiedAIProvider;

  constructor(settingsService: SettingsService) {
    this.unifiedProvider = new UnifiedAIProvider(settingsService);
  }

  getConfigs(): AIProviderConfig[] {
    return this.unifiedProvider.getConfigs();
  }

  getConfig(configId: string): AIProviderConfig | undefined {
    return this.unifiedProvider.getConfig(configId);
  }

  getActiveConfig(): AIProviderConfig | null {
    return this.unifiedProvider.getActiveConfig();
  }

  saveConfig(config: AIProviderConfig): void {
    console.log('[AIService] Saving config:', {
      id: config.id,
      name: config.name,
      provider: config.provider,
      apiKey: config.apiKey ? `${config.apiKey.substring(0, 10)}...` : 'empty',
      groupId: config.groupId || 'not set',
    });
    
    this.unifiedProvider.saveConfig(config);
  }

  deleteConfig(configId: string): void {
    this.unifiedProvider.deleteConfig(configId);
  }

  setActiveConfig(configId: string): void {
    this.unifiedProvider.setActiveConfig(configId);
  }

  async chat(request: AIRequest, configId?: string): Promise<AIResponse> {
    let config: AIProviderConfig | undefined;
    
    if (configId) {
      config = this.getConfigs().find(c => c.id === configId);
    }
    
    const activeConfig = config || this.getActiveConfig();
    
    if (!activeConfig) {
      throw new Error('No AI configuration found');
    }

    try {
      const provider = this.unifiedProvider.getProvider(activeConfig);
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

      return await provider.chat(messages, {
        model: request.model,
        temperature: request.temperature,
        maxTokens: request.maxTokens,
      });
    } catch (error: any) {
      console.error('AI chat error:', error);
      throw new Error(`AI request failed: ${error.message}`);
    }
  }

  async *streamChat(request: AIRequest, configId?: string): AsyncGenerator<string> {
    let config: AIProviderConfig | undefined;
    
    if (configId) {
      config = this.getConfigs().find(c => c.id === configId);
    }
    
    const activeConfig = config || this.getActiveConfig();
    
    if (!activeConfig) {
      throw new Error('No AI configuration found. Please add a configuration in settings.');
    }

    try {
      const provider = this.unifiedProvider.getProvider(activeConfig);
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

      for await (const chunk of provider.stream(messages, {
        model: request.model,
        temperature: request.temperature,
        maxTokens: request.maxTokens,
      })) {
        yield chunk;
      }
    } catch (error: any) {
      console.error('AI stream error:', error);
      
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

  async complete(request: CodeCompletionRequest, configId?: string): Promise<string> {
    const activeConfig = this.getActiveConfig();
    
    if (!activeConfig) {
      return '';
    }

    try {
      const provider = this.unifiedProvider.getProvider(activeConfig);
      const prompt = `Language: ${request.language}\nContext:\n${request.context}\n\nComplete the code at the cursor position.`;
      return await provider.complete(prompt, { maxTokens: 150 });
    } catch (error: any) {
      console.error('Code completion error:', error);
      return '';
    }
  }

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
      const provider = this.unifiedProvider.getProvider(config);
      return await provider.testConnection();
    } catch (error: any) {
      console.error('Test connection error:', error);
      
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

  getPredefinedProviders() {
    return PREDEFINED_PROVIDERS;
  }
}

export default AIService;
