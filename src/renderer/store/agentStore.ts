/**
 * Agent Store - 智能体状态管理
 * 管理 Agent 任务的状态和生命周期
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { IPC_CHANNELS } from '../../shared/types';
import type { AgentMode, AgentStep, AgentMessage, AgentToolCall } from '../../main/agent/agent';

export interface AgentTask {
  id: string;
  title: string;
  description: string;
  mode: AgentMode;
  steps: AgentStep[];
  currentStepIndex: number;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  createdAt: number;
  updatedAt: number;
  messages: AgentMessage[];
  thinking?: string;
}

interface AgentState {
  // 任务列表
  tasks: AgentTask[];
  // 当前活跃任务
  activeTaskId: string | null;
  // 是否正在创建任务
  isCreating: boolean;
  // 错误信息
  error: string | null;
}

interface AgentActions {
  // 创建任务
  createTask: (title: string, description: string, mode: AgentMode) => Promise<string>;
  // 启动任务
  startTask: (taskId: string) => Promise<void>;
  // 暂停任务
  pauseTask: (taskId: string) => Promise<void>;
  // 恢复任务
  resumeTask: (taskId: string) => Promise<void>;
  // 停止任务
  stopTask: (taskId: string) => Promise<void>;
  // 删除任务
  deleteTask: (taskId: string) => Promise<void>;
  // 设置活跃任务
  setActiveTask: (taskId: string | null) => void;
  // 更新任务状态
  updateTaskStatus: (taskId: string, status: AgentTask['status']) => void;
  // 添加消息
  addMessage: (taskId: string, message: AgentMessage) => void;
  // 更新思考内容
  updateThinking: (taskId: string, thinking: string) => void;
  // 更新步骤状态
  updateStep: (taskId: string, stepId: string, updates: Partial<AgentStep>) => void;
  // 添加工具调用
  addToolCall: (taskId: string, toolCall: AgentToolCall) => void;
  // 更新工具调用结果
  updateToolCall: (taskId: string, toolCallId: string, result: any, error?: string) => void;
  // 加载所有任务
  loadTasks: () => Promise<void>;
  // 清除错误
  clearError: () => void;
}

export const useAgentStore = create<AgentState & AgentActions>()(
  subscribeWithSelector(
    immer((set, get) => ({
      // 初始状态
      tasks: [],
      activeTaskId: null,
      isCreating: false,
      error: null,

      // 创建任务
      createTask: async (title, description, mode) => {
        set({ isCreating: true, error: null });
        try {
          const workspacePath = localStorage.getItem('lastWorkspace') || '';
          const activeConfigId = localStorage.getItem('activeConfigId');
          
          // 获取当前配置
          const configs = await window.electronAPI?.ai?.getConfigs?.();
          let config = configs?.configs?.find((c: any) => c.id === activeConfigId);
          if (!config && configs?.configs?.length > 0) {
            config = configs.configs[0];
          }
          
          if (!config) {
            throw new Error('请先配置 AI 模型');
          }

          const result = await window.electronAPI?.agent?.create?.({
            title,
            description,
            workspacePath,
            config,
            mode,
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

      // 启动任务
      startTask: async (taskId) => {
        try {
          await window.electronAPI?.agent?.start?.({ taskId });
          set((state) => {
            const task = state.tasks.find((t) => t.id === taskId);
            if (task) {
              task.status = 'running';
            }
          });
        } catch (error: any) {
          set({ error: error.message });
          throw error;
        }
      },

      // 暂停任务
      pauseTask: async (taskId) => {
        try {
          await window.electronAPI?.agent?.pause?.({ taskId });
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

      // 恢复任务
      resumeTask: async (taskId) => {
        try {
          await window.electronAPI?.agent?.resume?.({ taskId });
          set((state) => {
            const task = state.tasks.find((t) => t.id === taskId);
            if (task) {
              task.status = 'running';
            }
          });
        } catch (error: any) {
          set({ error: error.message });
          throw error;
        }
      },

      // 停止任务
      stopTask: async (taskId) => {
        try {
          await window.electronAPI?.agent?.stop?.({ taskId });
          set((state) => {
            const task = state.tasks.find((t) => t.id === taskId);
            if (task) {
              task.status = 'failed';
            }
          });
        } catch (error: any) {
          set({ error: error.message });
          throw error;
        }
      },

      // 删除任务
      deleteTask: async (taskId) => {
        try {
          await window.electronAPI?.agent?.delete?.({ taskId });
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

      // 设置活跃任务
      setActiveTask: (taskId) => {
        set({ activeTaskId: taskId });
      },

      // 更新任务状态
      updateTaskStatus: (taskId, status) => {
        set((state) => {
          const task = state.tasks.find((t) => t.id === taskId);
          if (task) {
            task.status = status;
            task.updatedAt = Date.now();
          }
        });
      },

      // 添加消息
      addMessage: (taskId, message) => {
        set((state) => {
          const task = state.tasks.find((t) => t.id === taskId);
          if (task) {
            task.messages.push(message);
            task.updatedAt = Date.now();
          }
        });
      },

      // 更新思考内容
      updateThinking: (taskId, thinking) => {
        set((state) => {
          const task = state.tasks.find((t) => t.id === taskId);
          if (task) {
            task.thinking = thinking;
          }
        });
      },

      // 更新步骤状态
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

      // 添加工具调用
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

      // 更新工具调用结果
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

      // 加载所有任务
      loadTasks: async () => {
        try {
          const tasks = await window.electronAPI?.agent?.getAll?.();
          if (tasks) {
            set({ tasks });
          }
        } catch (error: any) {
          console.error('Failed to load tasks:', error);
        }
      },

      // 清除错误
      clearError: () => {
        set({ error: null });
      },
    }))
  )
);

// 设置 IPC 事件监听
export function setupAgentEventListeners(): void {
  const { updateTaskStatus, addMessage, updateThinking, updateStep, addToolCall, updateToolCall } = useAgentStore.getState();

  // 模式变更
  window.electronAPI?.agent?.onModeChange?.((data: any) => {
    console.log('Agent mode changed:', data);
  });

  // 步骤开始
  window.electronAPI?.agent?.onStepStart?.((data: any) => {
    updateStep(data.taskId, data.step.id, { status: 'in_progress', startTime: Date.now() });
  });

  // 步骤完成
  window.electronAPI?.agent?.onStepComplete?.((data: any) => {
    updateStep(data.taskId, data.step.id, { status: 'completed', endTime: Date.now(), result: data.step.result });
  });

  // 步骤失败
  window.electronAPI?.agent?.onStepFail?.((data: any) => {
    updateStep(data.taskId, data.step.id, { status: 'failed', endTime: Date.now() });
  });

  // 新消息
  window.electronAPI?.agent?.onMessage?.((data: any) => {
    addMessage(data.taskId, data.message);
  });

  // 思考内容
  window.electronAPI?.agent?.onThinking?.((data: any) => {
    updateThinking(data.taskId, data.thinking);
  });

  // 工具调用
  window.electronAPI?.agent?.onToolCall?.((data: any) => {
    addToolCall(data.taskId, data.toolCall);
  });

  // 工具结果
  window.electronAPI?.agent?.onToolResult?.((data: any) => {
    updateToolCall(data.taskId, data.toolCall.id, data.toolCall.result, data.toolCall.error);
  });

  // 状态变更
  window.electronAPI?.agent?.onStatusChange?.((data: any) => {
    updateTaskStatus(data.taskId, data.status);
  });

  // 错误
  window.electronAPI?.agent?.onError?.((data: any) => {
    console.error('Agent error:', data.error);
  });

  // 完成
  window.electronAPI?.agent?.onComplete?.((data: any) => {
    console.log('Agent completed:', data.taskId);
  });
}
