import { create } from 'zustand';
import { ChatSession, ChatMessage, BuilderTask, AIProviderConfig } from '@shared/types';
import { v4 as uuidv4 } from 'uuid';
import { useWorkspaceStore } from './workspaceStore';

interface ChatState {
  sessions: ChatSession[];
  currentSessionId: string | null;
  isStreaming: boolean;
  currentBuilderTask: BuilderTask | null;
  availableProviders: Record<string, { name: string; models: string[]; defaultModel: string }>;
  aiConfigs: AIProviderConfig[];
  activeConfigId: string | null;
  
  // Actions
  createSession: (mode: 'chat' | 'builder' | 'agent', agentMode?: 'plan' | 'build' | 'review' | 'explain') => string;
  deleteSession: (id: string) => void;
  setCurrentSession: (id: string) => void;
  updateSessionModel: (sessionId: string, provider: string, model: string) => void;
  updateSessionAgentMode: (sessionId: string, agentMode: 'plan' | 'build' | 'review' | 'explain' | null) => void;
  updateSessionConfig: (sessionId: string, configId: string) => void;
  addMessage: (sessionId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  updateMessage: (sessionId: string, messageId: string, content: string) => void;
  sendMessage: (sessionId: string, content: string) => Promise<void>;
  sendAgentMessage: (sessionId: string, content: string, agentMode: string) => Promise<void>;
  startBuilderTask: (description: string) => void;
  updateBuilderTask: (task: BuilderTask) => void;
  clearCurrentBuilderTask: () => void;
  loadProviders: () => Promise<void>;
  loadAIConfigs: () => Promise<void>;
  setActiveConfig: (configId: string) => void;
}

// Default providers configuration (will be updated from main process)
const DEFAULT_PROVIDERS: Record<string, { name: string; models: string[]; defaultModel: string }> = {
  openai: {
    name: 'OpenAI',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo', 'o1-preview', 'o1-mini'],
    defaultModel: 'gpt-4o',
  },
  anthropic: {
    name: 'Anthropic',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
    defaultModel: 'claude-3-5-sonnet-20241022',
  },
  google: {
    name: 'Google Gemini',
    models: ['gemini-2.0-flash-exp', 'gemini-2.0-pro-exp', 'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro'],
    defaultModel: 'gemini-2.0-flash-exp',
  },
  deepseek: {
    name: 'DeepSeek',
    models: ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'],
    defaultModel: 'deepseek-chat',
  },
  minimax: {
    name: 'MiniMax',
    models: ['MiniMax-M2.5', 'MiniMax-M2.5-highspeed'],
    defaultModel: 'MiniMax-M2.5',
  },
  moonshot: {
    name: 'Moonshot (Kimi)',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
    defaultModel: 'moonshot-v1-8k',
  },
  qwen: {
    name: 'Qwen (Aliyun)',
    models: ['qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen-coder-plus', 'qwen-coder-turbo'],
    defaultModel: 'qwen-max',
  },
  baichuan: {
    name: 'Baichuan',
    models: ['Baichuan4', 'Baichuan3-Turbo', 'Baichuan3-Turbo-128k', 'Baichuan2-Turbo'],
    defaultModel: 'Baichuan4',
  },
  ollama: {
    name: 'Ollama (Local)',
    models: ['llama3.2', 'llama3.1', 'codellama', 'mistral', 'mixtral', 'qwen2.5', 'phi4', 'deepseek-coder-v2'],
    defaultModel: 'llama3.2',
  },
  lmstudio: {
    name: 'LM Studio (Local)',
    models: ['local-model'],
    defaultModel: 'local-model',
  },
  openrouter: {
    name: 'OpenRouter',
    models: ['openai/gpt-4o', 'anthropic/claude-3.5-sonnet', 'google/gemini-pro', 'meta-llama/llama-3.2-70b'],
    defaultModel: 'openai/gpt-4o',
  },
  siliconflow: {
    name: 'SiliconFlow',
    models: ['Qwen/Qwen2.5-72B-Instruct', 'deepseek-ai/DeepSeek-V2.5', 'meta-llama/Llama-3.3-70B-Instruct'],
    defaultModel: 'Qwen/Qwen2.5-72B-Instruct',
  },
  custom: {
    name: 'Custom',
    models: ['gpt-4', 'gpt-3.5-turbo'],
    defaultModel: 'gpt-4',
  },
};

// Agent mode system prompts
const AGENT_PROMPTS: Record<string, string> = {
  plan: `You are an expert software architect and planner. Your task is to analyze the user's request and create a detailed implementation plan.

When given a task:
1. Break down the request into clear, actionable steps
2. Identify files that need to be created or modified
3. Consider dependencies and prerequisites
4. Provide a structured plan with priorities

Output format:
## Plan Overview
Brief summary of the approach

## Steps
1. [Step name] - Priority: High/Medium/Low
   - Description
   - Files involved
   
2. [Step name]...

## Considerations
- Technical constraints
- Potential issues
- Best practices to follow`,

  build: `You are an expert software engineer. Your task is to implement code based on the user's request.

When writing code:
1. Follow best practices and coding standards
2. Include proper error handling
3. Add comments for complex logic
4. Ensure code is complete and functional
5. Use modern language features appropriately

Always provide complete, working code that can be directly used. Use markdown code blocks with the appropriate language.`,

  review: `You are a senior code reviewer. Analyze the provided code for:
1. Bugs and potential errors
2. Performance issues
3. Security vulnerabilities
4. Code style and best practices
5. Maintainability concerns

Provide constructive feedback with specific suggestions for improvement. Be thorough but constructive.`,

  explain: `You are a technical educator. Explain the provided code or concept in clear, concise terms.

Structure your explanation:
1. High-level overview of what the code does
2. Key components and their purposes
3. Important logic flows
4. Any notable patterns or techniques used
5. Practical examples if applicable`,
};

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [],
  currentSessionId: null,
  isStreaming: false,
  currentBuilderTask: null,
  availableProviders: DEFAULT_PROVIDERS,
  aiConfigs: [],
  activeConfigId: null,

  createSession: (mode: 'chat' | 'builder' | 'agent', agentMode?: 'plan' | 'build' | 'review' | 'explain') => {
    const id = uuidv4();
    const titles: Record<string, string> = {
      chat: 'New Chat',
      builder: 'Builder Mode',
      agent: agentMode ? `Agent: ${agentMode}` : 'AI Agent',
    };
    
    const newSession: ChatSession = {
      id,
      title: titles[mode] || 'New Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      mode,
      agentMode: agentMode || null,
    };
    
    set(state => ({
      sessions: [...state.sessions, newSession],
      currentSessionId: id,
    }));
    
    return id;
  },

  deleteSession: (id: string) => {
    const { sessions, currentSessionId } = get();
    const newSessions = sessions.filter(s => s.id !== id);
    
    let newCurrentId = currentSessionId;
    if (currentSessionId === id) {
      newCurrentId = newSessions.length > 0 ? newSessions[0].id : null;
    }
    
    set({
      sessions: newSessions,
      currentSessionId: newCurrentId,
    });
  },

  setCurrentSession: (id: string) => {
    set({ currentSessionId: id });
  },

  updateSessionModel: (sessionId: string, provider: string, model: string) => {
    set(state => ({
      sessions: state.sessions.map(session => {
        if (session.id === sessionId) {
          return {
            ...session,
            provider,
            model,
            updatedAt: Date.now(),
          };
        }
        return session;
      }),
    }));
  },

  updateSessionAgentMode: (sessionId: string, agentMode: 'plan' | 'build' | 'review' | 'explain' | null) => {
    set(state => ({
      sessions: state.sessions.map(session => {
        if (session.id === sessionId) {
          return {
            ...session,
            agentMode,
            mode: agentMode ? 'agent' : 'chat',
            title: agentMode ? `Agent: ${agentMode}` : 'New Chat',
            updatedAt: Date.now(),
          };
        }
        return session;
      }),
    }));
  },

  updateSessionConfig: (sessionId: string, configId: string) => {
    set(state => ({
      sessions: state.sessions.map(session => {
        if (session.id === sessionId) {
          return {
            ...session,
            configId,
            updatedAt: Date.now(),
          };
        }
        return session;
      }),
    }));
  },

  addMessage: (sessionId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMessage: ChatMessage = {
      ...message,
      id: uuidv4(),
      timestamp: Date.now(),
    };
    
    set(state => ({
      sessions: state.sessions.map(session => {
        if (session.id === sessionId) {
          return {
            ...session,
            messages: [...session.messages, newMessage],
            updatedAt: Date.now(),
          };
        }
        return session;
      }),
    }));
  },

  updateMessage: (sessionId: string, messageId: string, content: string) => {
    set(state => ({
      sessions: state.sessions.map(session => {
        if (session.id === sessionId) {
          return {
            ...session,
            messages: session.messages.map(msg => {
              if (msg.id === messageId) {
                return { ...msg, content };
              }
              return msg;
            }),
          };
        }
        return session;
      }),
    }));
  },

  sendMessage: async (sessionId: string, content: string) => {
    const { addMessage, sessions, activeConfigId, aiConfigs } = get();
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    // Get active config
    let configId = activeConfigId;
    if (!configId) {
      // Use default config or first available
      const defaultConfig = aiConfigs.find(c => c.isDefault);
      if (defaultConfig) configId = defaultConfig.id;
      else if (aiConfigs.length > 0) configId = aiConfigs[0].id;
    }
    
    if (!configId) {
      addMessage(sessionId, {
        role: 'assistant',
        content: '请先配置 AI 设置。点击左侧边栏底部的设置图标，添加一个 AI 配置。',
      });
      return;
    }

    // Add user message
    addMessage(sessionId, { role: 'user', content });

    set({ isStreaming: true });

    // Create assistant message placeholder
    const assistantMessageId = uuidv4();
    
    // Add placeholder message to state
    set(state => ({
      sessions: state.sessions.map(s => {
        if (s.id === sessionId) {
          return {
            ...s,
            messages: [...s.messages, {
              id: assistantMessageId,
              role: 'assistant',
              content: '',
              timestamp: Date.now(),
            }],
          };
        }
        return s;
      }),
    }));

    try {
      // Get workspace info
      const { workspacePath, openFiles } = useWorkspaceStore.getState();
      
      // Get updated session after adding user message
      const updatedSession = get().sessions.find(s => s.id === sessionId);
      if (!updatedSession) return;

      // Prepare messages for API
      const messages = updatedSession.messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      // Add system prompt for builder mode
      if (session.mode === 'builder') {
        messages.unshift({
          role: 'system',
          content: `You are an AI coding assistant in Builder Mode. Help the user build complete applications by:
1. Understanding their requirements
2. Breaking down tasks into steps
3. Generating code for each step
4. Providing clear explanations

When generating code, use markdown code blocks with the appropriate language.`,
        });
      }

      // Get open file paths
      const openFilePaths = openFiles.map(f => f.path);

      // Use aicoder:chat with project context
      const fullContent = await window.electronAPI?.aicoder?.chat({
        messages,
        workspacePath: workspacePath || '',
        openFilePaths,
        configId,
      }) || '';

      // Update the assistant message with the response
      set(state => ({
        sessions: state.sessions.map(s => {
          if (s.id === sessionId) {
            return {
              ...s,
              messages: s.messages.map(msg => {
                if (msg.id === assistantMessageId) {
                  return { ...msg, content: fullContent };
                }
                return msg;
              }),
            };
          }
          return s;
        }),
      }));

    } catch (error: any) {
      console.error('Failed to send message:', error);
      // Update the placeholder message with error
      set(state => ({
        sessions: state.sessions.map(s => {
          if (s.id === sessionId) {
            return {
              ...s,
              messages: s.messages.map(msg => {
                if (msg.id === assistantMessageId) {
                  return { 
                    ...msg, 
                    content: `错误: ${error?.message || '发送消息失败，请检查 AI 配置和网络连接。'}` 
                  };
                }
                return msg;
              }),
            };
          }
          return s;
        }),
      }));
    } finally {
      set({ isStreaming: false });
    }
  },

  sendAgentMessage: async (sessionId: string, content: string, agentMode: string) => {
    const { addMessage, sessions, activeConfigId, aiConfigs } = get();
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    // Get active config
    let configId = activeConfigId;
    if (!configId) {
      const defaultConfig = aiConfigs.find(c => c.isDefault);
      if (defaultConfig) configId = defaultConfig.id;
      else if (aiConfigs.length > 0) configId = aiConfigs[0].id;
    }
    
    if (!configId) {
      addMessage(sessionId, {
        role: 'assistant',
        content: '请先配置 AI 设置。点击左侧边栏底部的设置图标，添加一个 AI 配置。',
      });
      return;
    }

    // Add user message
    addMessage(sessionId, { role: 'user', content });

    set({ isStreaming: true });

    // Create assistant message placeholder
    const assistantMessageId = uuidv4();
    
    // Add placeholder message to state
    set(state => ({
      sessions: state.sessions.map(s => {
        if (s.id === sessionId) {
          return {
            ...s,
            messages: [...s.messages, {
              id: assistantMessageId,
              role: 'assistant',
              content: '',
              timestamp: Date.now(),
            }],
          };
        }
        return s;
      }),
    }));

    try {
      // Get workspace info
      const { workspacePath, openFiles } = useWorkspaceStore.getState();
      
      // Get updated session after adding user message
      const updatedSession = get().sessions.find(s => s.id === sessionId);
      if (!updatedSession) return;

      // Prepare messages for API
      const messages: Array<{ role: string; content: string }> = [];

      // Add agent-specific system prompt
      const systemPrompt = AGENT_PROMPTS[agentMode];
      if (systemPrompt) {
        messages.push({
          role: 'system',
          content: systemPrompt,
        });
      }

      // Add conversation history (last 10 messages for context)
      const recentMessages = updatedSession.messages.slice(-10);
      recentMessages.forEach(msg => {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      });

      // Get open file paths
      const openFilePaths = openFiles.map(f => f.path);

      // Use aicoder:chat with project context
      const fullContent = await window.electronAPI?.aicoder?.chat({
        messages,
        workspacePath: workspacePath || '',
        openFilePaths,
        configId,
      }) || '';

      // Update the assistant message with the response
      set(state => ({
        sessions: state.sessions.map(s => {
          if (s.id === sessionId) {
            return {
              ...s,
              messages: s.messages.map(msg => {
                if (msg.id === assistantMessageId) {
                  return { ...msg, content: fullContent };
                }
                return msg;
              }),
            };
          }
          return s;
        }),
      }));

    } catch (error: any) {
      console.error('Failed to send agent message:', error);
      // Update the placeholder message with error
      set(state => ({
        sessions: state.sessions.map(s => {
          if (s.id === sessionId) {
            return {
              ...s,
              messages: s.messages.map(msg => {
                if (msg.id === assistantMessageId) {
                  return { 
                    ...msg, 
                    content: `错误: ${error?.message || '发送消息失败，请检查 AI 配置和网络连接。'}` 
                  };
                }
                return msg;
              }),
            };
          }
          return s;
        }),
      }));
    } finally {
      set({ isStreaming: false });
    }
  },

  startBuilderTask: (description: string) => {
    const newTask: BuilderTask = {
      id: uuidv4(),
      description,
      status: 'pending',
      steps: [],
      currentStep: 0,
    };
    
    set({ currentBuilderTask: newTask });
  },

  updateBuilderTask: (task: BuilderTask) => {
    set({ currentBuilderTask: task });
  },

  clearCurrentBuilderTask: () => {
    set({ currentBuilderTask: null });
  },

  loadProviders: async () => {
    try {
      const providers = await window.electronAPI?.ai?.getProviders?.();
      if (providers) {
        set({ availableProviders: providers });
      }
    } catch (error) {
      console.error('Failed to load providers:', error);
    }
  },

  loadAIConfigs: async () => {
    try {
      const result = await window.electronAPI?.ai?.getConfigs?.();
      if (result) {
        set({ 
          aiConfigs: result.configs || [],
          activeConfigId: result.activeConfigId || null,
        });
      }
    } catch (error) {
      console.error('Failed to load AI configs:', error);
    }
  },

  setActiveConfig: (configId: string) => {
    set({ activeConfigId: configId });
  },
}));
