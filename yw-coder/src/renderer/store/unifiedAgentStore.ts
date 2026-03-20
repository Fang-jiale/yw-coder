/**
 * 统一 Agent Store
 * 整合普通对话、SOLO 模式和 Agent 模式的状态管理
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';
import {
  AgentConfig,
  AgentTask,
  AgentStep,
  AgentMessage,
  AgentToolCall,
  AgentRuntimeMode,
  TodoItem,
  createDefaultAgentConfig,
  ExecutionPlan,
  ExecutionPlanStep,
  AgentQuestion,
} from '../../shared/agentTypes';
import { AIProviderConfig } from '../../shared/types';

// 调试模式开关
const DEBUG = typeof process !== 'undefined' && (process.env?.DEBUG === 'true' || process.env?.NODE_ENV === 'development');

// 重新导出类型供其他组件使用
export type { ExecutionPlan, ExecutionPlanStep };

export interface ExecutionLog {
  id: string;
  type: 'info' | 'success' | 'error' | 'warning';
  message: string;
  timestamp: number;
  details?: any;
}

export interface AgentContext {
  projectType?: string;
  techStack?: string[];
  dependencies?: string[];
  files?: string[];
  analyzedFiles?: Array<{
    path: string;
    purpose: string;
    dependencies: string[];
    exports: string[];
  }>;
  requirements?: Array<{
    id: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    status: 'pending' | 'in_progress' | 'completed';
  }>;
}

interface UnifiedAgentState {
  // Agent 配置列表
  configs: AgentConfig[];
  // 当前活跃配置ID
  activeConfigId: string | null;
  // 任务列表
  tasks: AgentTask[];
  // 当前活跃任务ID
  activeTaskId: string | null;
  // 是否正在创建任务
  isCreating: boolean;
  // 是否正在处理
  isProcessing: boolean;
  // 当前流式消息
  streamingMessage: string;
  // 当前思考内容
  streamingThinking: string;
  // 当前流式工具调用
  streamingToolCalls: AgentToolCall[];
  // 当前待办事项
  todoItems: TodoItem[];
  // 错误信息
  error: string | null;

  // 动态执行计划状态
  executionPlan: ExecutionPlan | null;
  executionProgress: number;
  executionLogs: ExecutionLog[];
  agentContext: AgentContext | null;
  isExecuting: boolean;
  isPaused: boolean;
}

interface UnifiedAgentActions {
  // 配置管理
  createConfig: (runtimeMode: AgentRuntimeMode, aiConfig: AIProviderConfig, name?: string) => Promise<AgentConfig>;
  updateConfig: (configId: string, updates: Partial<AgentConfig>) => Promise<void>;
  deleteConfig: (configId: string) => Promise<void>;
  setActiveConfig: (configId: string) => void;
  loadConfigs: (retryCount?: number) => Promise<void>;

  // 任务管理
  createTask: (title: string, description: string, configId?: string) => Promise<string>;
  startTask: (taskId: string) => Promise<void>;
  pauseTask: (taskId: string) => Promise<void>;
  resumeTask: (taskId: string) => Promise<void>;
  stopTask: (taskId: string) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  setActiveTask: (taskId: string | null) => void;
  loadTasks: () => Promise<void>;

  // 问题类型定义
  addMessage: (taskId: string, message: AgentMessage) => void;
  addQuestionToMessage: (taskId: string, messageIndex: number, question: AgentQuestion) => void;
  answerQuestion: (taskId: string, messageIndex: number, questionId: string, answer: string) => void;
  sendMessage: (taskId: string, content: string, aiConfig?: any) => Promise<void>;

  // 状态更新
  updateTaskStatus: (taskId: string, status: AgentTask['status']) => void;
  updateStep: (taskId: string, stepId: string, updates: Partial<AgentStep>) => void;
  updateThinking: (taskId: string, thinking: string) => void;
  updateTodoItems: (taskId: string, items: TodoItem[]) => void;
  addToolCall: (taskId: string, toolCall: AgentToolCall) => void;
  updateToolCall: (taskId: string, toolCallId: string, result: any, error?: string) => void;

  // 流式状态
  setStreamingMessage: (message: string) => void;
  appendStreamingMessage: (content: string) => void;
  setStreamingThinking: (thinking: string) => void;
  appendStreamingThinking: (content: string) => void;
  addStreamingToolCall: (toolCall: AgentToolCall) => void;
  updateStreamingToolCall: (toolCallId: string, result: any, error?: string, params?: Record<string, any>) => void;
  setIsProcessing: (isProcessing: boolean) => void;
  setIsCreating: (isCreating: boolean) => void;
  clearStreaming: () => void;

  // 错误处理
  setError: (error: string | null) => void;
  clearError: () => void;
}

export const useUnifiedAgentStore = create<UnifiedAgentState & UnifiedAgentActions>()(
  persist(
    subscribeWithSelector(
      immer((set, get) => ({
        // 初始状态
        configs: [],
        activeConfigId: null,
        tasks: [],
        activeTaskId: null,
        isCreating: false,
        isProcessing: false,
        streamingMessage: '',
        streamingThinking: '',
        streamingToolCalls: [],
        todoItems: [],
        error: null,

        // 动态执行计划初始状态
        executionPlan: null,
        executionProgress: 0,
        executionLogs: [],
        agentContext: null,
        isExecuting: false,
        isPaused: false,

        // 配置管理
        createConfig: async (runtimeMode, aiConfig, name) => {
          const config = createDefaultAgentConfig(runtimeMode, aiConfig, name);
          set((state) => {
            state.configs.push(config);
            if (!state.activeConfigId) {
              state.activeConfigId = config.id;
            }
          });

          // 保存到主进程
          await window.electronAPI?.unifiedAgent?.saveConfig?.(config);
          return config;
        },

        updateConfig: async (configId, updates) => {
          set((state) => {
            const config = state.configs.find((c) => c.id === configId);
            if (config) {
              Object.assign(config, updates, { updatedAt: Date.now() });
            }
          });
          await window.electronAPI?.unifiedAgent?.saveConfig?.({ ...get().configs.find(c => c.id === configId), ...updates });
        },

        deleteConfig: async (configId) => {
          set((state) => {
            state.configs = state.configs.filter((c) => c.id !== configId);
            if (state.activeConfigId === configId) {
              state.activeConfigId = state.configs[0]?.id || null;
            }
          });
          await window.electronAPI?.unifiedAgent?.deleteConfig?.(configId);
        },

        setActiveConfig: async (configId) => {
          const state = get();
          // 保存当前活跃任务到主进程（如果有）
          if (state.activeTaskId) {
            const currentTask = state.tasks.find(t => t.id === state.activeTaskId);
            if (currentTask) {
              try {
                await window.electronAPI?.unifiedAgent?.saveTask?.({ task: currentTask });
              } catch (error) {
                console.error('[setActiveConfig] Failed to save task:', error);
              }
            }
          }
          
          // 切换配置（模式）时，重置任务相关状态但保留 tasks 列表
          // 这样切换回来时任务列表仍然存在
          set({
            activeConfigId: configId,
            // 切换模式时重置执行计划相关状态
            executionPlan: null,
            executionProgress: 0,
            executionLogs: [],
            agentContext: null,
            isExecuting: false,
            isPaused: false,
            // 重置流式状态
            streamingMessage: '',
            streamingThinking: '',
            streamingToolCalls: [],
            isProcessing: false,
            // 注意：不重置 activeTaskId，让用户切回原模式时能看到之前的任务
          });
          localStorage.setItem('activeAgentConfigId', configId);
          // 通知主进程更新活跃配置
          await window.electronAPI?.unifiedAgent?.setActiveConfig?.(configId);
          // 重新加载配置列表以确保 isDefault 标志正确
          const configs = await window.electronAPI?.unifiedAgent?.getConfigs?.();
          if (configs) {
            set({ configs });
          }
        },

        loadConfigs: async (retryCount = 0) => {
          try {
            const configs = await window.electronAPI?.unifiedAgent?.getConfigs?.();
            if (configs) {
              set({ configs });
              // Restore active config from localStorage if exists
              const savedConfigId = localStorage.getItem('activeAgentConfigId');
              if (savedConfigId && configs.find((c: AgentConfig) => c.id === savedConfigId)) {
                set({ activeConfigId: savedConfigId });
              } else if (configs.length > 0 && !get().activeConfigId) {
                set({ activeConfigId: configs[0].id });
              } else if (configs.length === 0 && retryCount < 3) {
                // 如果没有配置且重试次数小于3，延迟重试（等待默认配置创建）
                console.log('[loadConfigs] No configs found, retrying...', retryCount + 1);
                setTimeout(() => get().loadConfigs(retryCount + 1), 500);
              }
            }
          } catch (error) {
            console.error('Failed to load configs:', error);
          }
        },

        // 任务管理
        createTask: async (title, description, configId) => {
          set({ isCreating: true, error: null });
          try {
            const workspacePath = localStorage.getItem('lastWorkspace') || '';
            const activeConfigId = configId || get().activeConfigId;

            if (!activeConfigId) {
              throw new Error('请先配置 Agent');
            }

            if (!workspacePath) {
              throw new Error('请先打开一个文件夹');
            }

            const result = await window.electronAPI?.unifiedAgent?.createTask?.({
              title,
              description,
              workspacePath,
              configId: activeConfigId,
            });

            if (result?.taskId) {
              set((state) => {
                state.tasks.push(result.task);
                state.activeTaskId = result.taskId;
              });
              return result.taskId;
            }
            throw new Error('创建任务失败');
          } catch (error: any) {
            set({ error: error.message });
            throw error;
          } finally {
            set({ isCreating: false });
          }
        },

        startTask: async (taskId) => {
          try {
            set({ isProcessing: true });
            await window.electronAPI?.unifiedAgent?.startTask?.({ taskId });
            set((state) => {
              const task = state.tasks.find((t) => t.id === taskId);
              if (task) {
                task.status = 'running';
              }
            });
          } catch (error: any) {
            set({ error: error.message, isProcessing: false });
            throw error;
          }
        },

        pauseTask: async (taskId) => {
          try {
            await window.electronAPI?.unifiedAgent?.pauseTask?.({ taskId });
            set((state) => {
              const task = state.tasks.find((t) => t.id === taskId);
              if (task) {
                task.status = 'paused';
              }
            });
          } catch (error: any) {
            set({ error: error.message });
            throw error;
          }
        },

        resumeTask: async (taskId) => {
          try {
            set({ isProcessing: true });
            await window.electronAPI?.unifiedAgent?.resumeTask?.({ taskId });
            set((state) => {
              const task = state.tasks.find((t) => t.id === taskId);
              if (task) {
                task.status = 'running';
              }
            });
          } catch (error: any) {
            set({ error: error.message, isProcessing: false });
            throw error;
          }
        },

        stopTask: async (taskId) => {
          try {
            await window.electronAPI?.unifiedAgent?.stopTask?.({ taskId });
            set((state) => {
              const task = state.tasks.find((t) => t.id === taskId);
              if (task) {
                task.status = 'failed';
              }
            });
            set({ isProcessing: false });
          } catch (error: any) {
            set({ error: error.message });
            throw error;
          }
        },

        deleteTask: async (taskId) => {
          try {
            await window.electronAPI?.unifiedAgent?.deleteTask?.({ taskId });
            set((state) => {
              state.tasks = state.tasks.filter((t) => t.id !== taskId);
              if (state.activeTaskId === taskId) {
                state.activeTaskId = null;
              }
            });
          } catch (error: any) {
            set({ error: error.message });
            throw error;
          }
        },

        setActiveTask: async (taskId) => {
          const state = get();
          const task = taskId ? state.tasks.find((t) => t.id === taskId) : null;

          // 如果任务存在，尝试自动切换到任务对应的配置
          // 这样切换任务时，如果任务的模式与当前配置不同，会自动切换配置
          // 这会触发 setActiveConfig 中的保存任务逻辑
          if (task && task.runtimeMode && task.configId) {
            const matchingConfig = state.configs.find(c => c.id === task.configId);
            if (matchingConfig && matchingConfig.id !== state.activeConfigId) {
              // 使用 await 确保当前任务先被保存，再切换配置
              await get().setActiveConfig(matchingConfig.id);
            }
          }

          set({
            activeTaskId: taskId,
            // 切换任务时恢复或重置执行计划相关状态
            executionPlan: task?.executionPlan || null,
            executionProgress: task?.executionProgress || 0,
            executionLogs: [],
            agentContext: null,
            isExecuting: task?.status === 'running',
            isPaused: task?.status === 'paused',
            // 重置流式状态
            streamingMessage: '',
            streamingThinking: '',
            streamingToolCalls: [],
            isProcessing: task?.status === 'running',
          });
        },

        loadTasks: async () => {
          try {
            const tasks = await window.electronAPI?.unifiedAgent?.getAllTasks?.();
            if (tasks) {
              set({ tasks });
            }
          } catch (error) {
            console.error('Failed to load tasks:', error);
          }
        },

        // 消息管理
        addMessage: (taskId, message) => {
          set((state) => {
            const task = state.tasks.find((t) => t.id === taskId);
            if (task) {
              task.messages.push(message);
              task.updatedAt = Date.now();
            }
          });
        },

        // 添加问题到消息
        addQuestionToMessage: (taskId: string, messageIndex: number, question: AgentQuestion) => {
          console.log('[addQuestionToMessage] Adding question to task:', taskId, 'messageIndex:', messageIndex);
          set((state) => {
            const task = state.tasks.find((t) => t.id === taskId);
            if (task && task.messages[messageIndex]) {
              const message = task.messages[messageIndex];
              console.log('[addQuestionToMessage] Found message:', message.id);
              if (!message.agentQuestions) {
                message.agentQuestions = [];
              }
              message.agentQuestions.push(question);
              console.log('[addQuestionToMessage] Question added, total:', message.agentQuestions.length);
            } else {
              console.error('[addQuestionToMessage] Task or message not found:', taskId, messageIndex);
            }
          });
        },

        // 回答问题
        answerQuestion: (taskId: string, messageIndex: number, questionId: string, answer: string) => {
          console.log('[answerQuestion] Answering question:', questionId, 'with:', answer);
          set((state) => {
            const task = state.tasks.find((t) => t.id === taskId);
            if (task && task.messages[messageIndex]) {
              const message = task.messages[messageIndex];
              const question = message.agentQuestions?.find((q) => q.id === questionId);
              if (question) {
                question.status = 'answered';
                question.answer = answer;
                console.log('[answerQuestion] Question answered:', questionId);
              }
            }
          });
        },

        sendMessage: async (taskId, content, aiConfig) => {
          const { addMessage, activeConfigId, configs, setIsProcessing } = get();
          const task = get().tasks.find((t) => t.id === taskId);
          if (!task) return;

          // 获取配置
          const config = configs.find((c) => c.id === task.configId) ||
                        configs.find((c) => c.id === activeConfigId);

          if (!config) {
            throw new Error('未找到 Agent 配置');
          }

          // 添加用户消息到前端 store
          const userMessage: AgentMessage = {
            id: Date.now().toString(),
            role: 'user',
            content,
            timestamp: Date.now(),
          };
          addMessage(taskId, userMessage);

          // 设置处理状态
          setIsProcessing(true);

          try {
            // 根据模式选择处理方式
            if (config.runtimeMode === 'solo' || config.runtimeMode === 'agent') {
              // SOLO 和 Agent 模式：先发送消息到主进程，再启动任务
              // 这样主进程中的 task.messages 会包含用户消息
              await window.electronAPI?.unifiedAgent?.sendMessage?.({ taskId, content, aiConfig });
              await window.electronAPI?.unifiedAgent?.startTask?.({ taskId });
            } else {
              // Chat 模式：发送消息并获取流式响应，传入当前选择的 AI 配置
              await window.electronAPI?.unifiedAgent?.sendMessage?.({ taskId, content, aiConfig });
            }
          } catch (error: any) {
            setIsProcessing(false);
            throw error;
          }
        },

        // 状态更新
        updateTaskStatus: (taskId, status) => {
          set((state) => {
            const task = state.tasks.find((t) => t.id === taskId);
            if (task) {
              task.status = status;
              task.updatedAt = Date.now();
            }
          });
        },

        updateStep: (taskId, stepId, updates) => {
          set((state) => {
            const task = state.tasks.find((t) => t.id === taskId);
            if (task) {
              const step = task.steps.find((s) => s.id === stepId);
              if (step) {
                Object.assign(step, updates);
              }
            }
          });
        },

        updateThinking: (taskId, thinking) => {
          set((state) => {
            const task = state.tasks.find((t) => t.id === taskId);
            if (task) {
              // 更新最后一条AI消息的思考内容
              const lastMessage = task.messages[task.messages.length - 1];
              if (lastMessage && lastMessage.role === 'assistant') {
                lastMessage.thinking = thinking;
              }
            }
          });
        },

        updateTodoItems: (taskId, items) => {
          set((state) => {
            const task = state.tasks.find((t) => t.id === taskId);
            if (task) {
              task.todoItems = items;
            }
            state.todoItems = items;
          });
        },

        addToolCall: (taskId, toolCall) => {
          set((state) => {
            const task = state.tasks.find((t) => t.id === taskId);
            if (task) {
              const lastMessage = task.messages[task.messages.length - 1];
              if (lastMessage && lastMessage.role === 'assistant') {
                if (!lastMessage.toolCalls) {
                  lastMessage.toolCalls = [];
                }
                lastMessage.toolCalls.push(toolCall);
              }
            }
          });
        },

        updateToolCall: (taskId, toolCallId, result, error) => {
          set((state) => {
            const task = state.tasks.find((t) => t.id === taskId);
            if (task) {
              for (const message of task.messages) {
                if (message.toolCalls) {
                  const toolCall = message.toolCalls.find((tc) => tc.id === toolCallId);
                  if (toolCall) {
                    toolCall.status = error ? 'error' : 'completed';
                    toolCall.result = result;
                    toolCall.error = error;
                    break;
                  }
                }
              }
            }
          });
        },

        // 流式状态
        setStreamingMessage: (message) => {
          set({ streamingMessage: message });
        },

        appendStreamingMessage: (content) => {
          set((state) => {
            state.streamingMessage += content;
          });
        },

        setStreamingThinking: (thinking) => {
          set({ streamingThinking: thinking });
        },

        appendStreamingThinking: (content) => {
          set((state) => {
            state.streamingThinking += content;
          });
        },

        addStreamingToolCall: (toolCall) => {
          set((state) => {
            state.streamingToolCalls.push(toolCall);
          });
        },

        updateStreamingToolCall: (toolCallId, result, error, params) => {
          set((state) => {
            const toolCall = state.streamingToolCalls.find((tc) => tc.id === toolCallId);
            if (toolCall) {
              toolCall.status = error ? 'error' : 'completed';
              toolCall.result = result;
              toolCall.error = error;
              if (params) {
                toolCall.params = params;
              }
            }
          });
        },

        setIsProcessing: (isProcessing) => {
          set({ isProcessing });
        },

        setIsCreating: (isCreating) => {
          set({ isCreating });
        },

        clearStreaming: () => {
          set({
            streamingMessage: '',
            streamingThinking: '',
            streamingToolCalls: [],
            isProcessing: false,
          });
        },

        // 错误处理
        setError: (error) => {
          set({ error });
        },

        clearError: () => {
          set({ error: null });
        },
      }))
    ),
    {
      name: 'unified-agent-store',
      version: 1,
      partialize: (state) => ({
        configs: state.configs,
        activeConfigId: state.activeConfigId,
        tasks: state.tasks,
      }),
    }
  )
);

/**
 * 设置 IPC 事件监听
 * 使用全局标志确保只注册一次
 */
let isEventListenersSetup = false;

export function setupUnifiedAgentEventListeners(): void {
  // 如果已经设置过，直接返回
  if (isEventListenersSetup) {
    return;
  }
  isEventListenersSetup = true;

  const {
    updateTaskStatus,
    addMessage,
    updateThinking,
    updateStep,
    addToolCall,
    updateToolCall,
    updateTodoItems,
    appendStreamingMessage,
    appendStreamingThinking,
    addStreamingToolCall,
    updateStreamingToolCall,
    setIsProcessing,
    clearStreaming,
    setError,
  } = useUnifiedAgentStore.getState();

  // 步骤开始
  window.electronAPI?.unifiedAgent?.onStepStart?.((data: any) => {
    updateStep(data.taskId, data.step.id, { status: 'in_progress', startTime: Date.now() });
  });

  // 步骤完成
  window.electronAPI?.unifiedAgent?.onStepComplete?.((data: any) => {
    updateStep(data.taskId, data.step.id, {
      status: 'completed',
      endTime: Date.now(),
      result: data.step.result,
    });
  });

  // 步骤失败
  window.electronAPI?.unifiedAgent?.onStepFail?.((data: any) => {
    updateStep(data.taskId, data.step.id, { status: 'failed', endTime: Date.now() });
  });

  // 新消息
  window.electronAPI?.unifiedAgent?.onMessage?.((data: any) => {
    DEBUG && console.log('[UnifiedAgentStore] onMessage received:', data.message.id, 'toolCalls:', data.message.toolCalls?.length);
    addMessage(data.taskId, data.message);
    // 不再追加到 streamingMessage，因为消息已保存在 task.messages 中
    // streamingMessage 只用于流式过程中的临时显示

    // 检查是否有暂存的问题需要添加
    const pendingQuestion = pendingQuestions.get(data.taskId);
    if (pendingQuestion && data.message.role === 'assistant') {
      DEBUG && console.log('[UnifiedAgentStore] Adding pending question to new message:', data.message.id);
      const { tasks, addQuestionToMessage } = useUnifiedAgentStore.getState();
      const task = tasks.find((t) => t.id === data.taskId);
      if (task) {
        const messageIndex = task.messages.length - 1;
        addQuestionToMessage(data.taskId, messageIndex, {
          id: pendingQuestion.id,
          question: pendingQuestion.question,
          context: pendingQuestion.context,
          status: 'pending',
          options: pendingQuestion.options,
        });
        pendingQuestions.delete(data.taskId);
        DEBUG && console.log('[UnifiedAgentStore] Pending question added to message:', data.message.id);
      }
    }
  });

  // 思考内容（完整更新）
  window.electronAPI?.unifiedAgent?.onThinking?.((data: any) => {
    updateThinking(data.taskId, data.thinking);
  });

  // 流式思考内容（追加）- 只处理当前活跃任务
  window.electronAPI?.unifiedAgent?.onStreamThinking?.((data: any) => {
    const { activeTaskId } = useUnifiedAgentStore.getState();
    if (data.taskId === activeTaskId) {
      appendStreamingThinking(data.thinking);
    }
  });

  // 思考完成 - 更新消息中的思考内容
  window.electronAPI?.unifiedAgent?.onThinkingComplete?.((data: any) => {
    DEBUG && console.log('[UnifiedAgentStore] onThinkingComplete received');
    const { tasks, activeTaskId } = useUnifiedAgentStore.getState();
    if (data.taskId === activeTaskId) {
      // 更新最后一条 AI 消息的思考内容
      const task = tasks.find(t => t.id === data.taskId);
      if (task && task.messages.length > 0) {
        const lastMessage = task.messages[task.messages.length - 1];
        if (lastMessage.role === 'assistant') {
          lastMessage.thinking = data.thinking;
        }
      }
    }
  });

  // 流式内容（追加）- 实时更新到 streamingMessage，只处理当前活跃任务
  window.electronAPI?.unifiedAgent?.onStreamContent?.((data: any) => {
    const { activeTaskId } = useUnifiedAgentStore.getState();
    if (data.taskId === activeTaskId && data.content) {
      DEBUG && console.log('[UnifiedAgentStore] onStreamContent received:', data.content?.slice(0, 50), '...');
      appendStreamingMessage(data.content);
    }
  });

  // 工具调用 - 添加到流式工具调用列表，只处理当前活跃任务
  window.electronAPI?.unifiedAgent?.onToolCall?.((data: any) => {
    const { activeTaskId } = useUnifiedAgentStore.getState();
    if (data.taskId === activeTaskId) {
      addStreamingToolCall(data.toolCall);
    }
  });

  // 工具结果 - 更新流式工具调用，只处理当前活跃任务
  window.electronAPI?.unifiedAgent?.onToolResult?.((data: any) => {
    const { activeTaskId, streamingToolCalls } = useUnifiedAgentStore.getState();
    if (data.taskId === activeTaskId) {
      // 保留原始 params
      const existingToolCall = streamingToolCalls.find(tc => tc.id === data.toolCall.id);
      const params = existingToolCall?.params || data.toolCall.params || {};
      updateStreamingToolCall(data.toolCall.id, data.toolCall.result, data.toolCall.error, params);
    }
  });

  // 待办更新
  window.electronAPI?.unifiedAgent?.onTodoUpdate?.((data: any) => {
    updateTodoItems(data.taskId, data.items);
  });

  // 暂存的问题（当 onQuestion 在 onMessage 之前触发时使用）
  const pendingQuestions: Map<string, any> = new Map();

  // 问题提问
  DEBUG && console.log('[UnifiedAgentStore] Registering onQuestion listener, available:', !!window.electronAPI?.unifiedAgent?.onQuestion);
  window.electronAPI?.unifiedAgent?.onQuestion?.((data: any) => {
    DEBUG && console.log('[UnifiedAgentStore] onQuestion received:', data.question);
    const { tasks, addQuestionToMessage } = useUnifiedAgentStore.getState();
    const task = tasks.find((t) => t.id === data.taskId);
    if (task) {
      // 找到最近的 AI 消息的索引
      const lastAssistantMessageIndex = [...task.messages].reverse().findIndex(m => m.role === 'assistant');
      if (lastAssistantMessageIndex !== -1) {
        const actualIndex = task.messages.length - 1 - lastAssistantMessageIndex;
        const message = task.messages[actualIndex];
        // 使用 action 添加问题
        addQuestionToMessage(data.taskId, actualIndex, {
          id: data.question.id,
          question: data.question.question,
          context: data.question.context,
          status: 'pending',
          options: data.question.options,
        });
        DEBUG && console.log('[UnifiedAgentStore] Question added to message:', message.id, 'total questions:', (message.agentQuestions?.length || 0) + 1);
      } else {
        // 没有找到消息，暂存问题，等 onMessage 到达后再添加
        DEBUG && console.log('[UnifiedAgentStore] No assistant message found, queuing question for later:', data.question.id);
        pendingQuestions.set(data.taskId, data.question);
      }
    }
  });

  // 状态变更
  window.electronAPI?.unifiedAgent?.onStatusChange?.((data: any) => {
    updateTaskStatus(data.taskId, data.status);
    if (data.status === 'completed' || data.status === 'failed') {
      setIsProcessing(false);
    }
  });

  // 错误
  window.electronAPI?.unifiedAgent?.onError?.((data: any) => {
    console.error('Agent error:', data.error);
    setError(data.error || '执行过程中发生错误');
    setIsProcessing(false);
  });

  // 完成
  window.electronAPI?.unifiedAgent?.onComplete?.((data: any) => {
    DEBUG && console.log('Agent completed:', data.taskId);
    clearStreaming();
  });

  // 动态计划生成事件 - 只保存到任务对象，不更新全局状态
  window.electronAPI?.unifiedAgent?.onPlanGenerated?.((data: any) => {
    DEBUG && console.log('[UnifiedAgentStore] Plan generated:', data.plan);
    useUnifiedAgentStore.setState((state) => {
      const task = state.tasks.find((t) => t.id === data.taskId);
      if (task) {
        task.executionPlan = data.plan;
      }
      // 只更新当前活跃任务的全局状态
      if (state.activeTaskId === data.taskId) {
        state.executionPlan = data.plan;
        state.isExecuting = true;
      }
    });
  });

  // 进度更新事件 - 只保存到任务对象，不更新全局状态
  window.electronAPI?.unifiedAgent?.onProgressUpdate?.((data: any) => {
    useUnifiedAgentStore.setState((state) => {
      const task = state.tasks.find((t) => t.id === data.taskId);
      if (task) {
        task.executionProgress = data.progress;
      }
      // 只更新当前活跃任务的全局状态
      if (state.activeTaskId === data.taskId) {
        state.executionProgress = data.progress;
      }
    });
  });

  // 任务完成时重置状态
  window.electronAPI?.unifiedAgent?.onComplete?.((data: any) => {
    DEBUG && console.log('[UnifiedAgentStore] Task completed:', data.taskId);
    useUnifiedAgentStore.setState((state) => {
      const task = state.tasks.find((t) => t.id === data.taskId);
      if (task) {
        task.executionProgress = 100;
      }
      // 只更新当前活跃任务的全局状态
      if (state.activeTaskId === data.taskId) {
        state.isExecuting = false;
        state.executionProgress = 100;
      }
    });
  });

  // 任务失败时重置状态
  window.electronAPI?.unifiedAgent?.onError?.((data: any) => {
    DEBUG && console.log('[UnifiedAgentStore] Task error:', data.error);
    useUnifiedAgentStore.setState({
      isExecuting: false,
    });
  });

}
