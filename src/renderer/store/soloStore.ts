/**
 * SOLO Store - SOLO 模式状态管理 (增强版)
 * 支持新的执行引擎功能
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { SoloPhase } from '../../main/agent/solo/SoloExecutor';

export type SOLOMode = 'builder' | 'coder';

export interface SOLOStep {
  id: string;
  type: 'planning' | 'analysis' | 'coding' | 'testing' | 'deployment' | 'verification';
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: string;
}

export interface TodoItem {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  priority?: 'high' | 'medium' | 'low';
  dependsOn?: string[];
}

export interface ToolCall {
  id: string;
  toolName: string;
  params: Record<string, any>;
  status: 'running' | 'completed' | 'error';
  result?: any;
  error?: string;
  timestamp: number;
}

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

export interface SOLOTask {
  id: string;
  title: string;
  description: string;
  mode: SOLOMode;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  currentStepIndex: number;
  steps: SOLOStep[];
  todoItems: TodoItem[];
  thinking?: string;
  progressMessage?: string;
}

interface SOLOState {
  // 当前任务
  currentTask: SOLOTask | null;
  // 任务列表
  tasks: SOLOTask[];
  // 是否正在创建
  isCreating: boolean;
  // 是否正在执行
  isExecuting: boolean;
  // 是否已暂停
  isPaused: boolean;
  // 是否跟随模式
  isFollowing: boolean;
  // 当前执行阶段
  currentPhase: SoloPhase | null;
  // 执行进度 (0-100)
  progress: number;
  // 工具调用列表
  toolCalls: ToolCall[];
  // 执行日志
  logs: ExecutionLog[];
  // 项目上下文
  context: AgentContext | null;
  // 错误
  error: string | null;
}

interface SOLOActions {
  // 创建任务
  createTask: (title: string, description: string, mode: SOLOMode) => Promise<string>;
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
  // 切换跟随模式
  toggleFollow: () => void;
  // 清除错误
  clearError: () => void;
  // 确认操作
  confirmOperation: (confirmationId: string, approved: boolean) => void;
  // 添加日志
  addLog: (type: ExecutionLog['type'], message: string, details?: any) => void;
  // 更新上下文
  updateContext: (context: AgentContext) => void;
}

export const useSOLOStore = create<SOLOState & SOLOActions>()(
  subscribeWithSelector(
    immer((set, get) => ({
      // 初始状态
      currentTask: null,
      tasks: [],
      isCreating: false,
      isExecuting: false,
      isPaused: false,
      isFollowing: true,
      currentPhase: null,
      progress: 0,
      toolCalls: [],
      logs: [],
      context: null,
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

          const result = await window.electronAPI?.solo?.create?.({
            title,
            description,
            workspacePath,
            config,
            mode,
          });

          if (result?.taskId) {
            set((state) => {
              state.tasks.push(result.task);
              state.currentTask = result.task;
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
          await window.electronAPI?.solo?.start?.({ taskId });
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
          await window.electronAPI?.solo?.pause?.({ taskId });
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
          await window.electronAPI?.solo?.resume?.({ taskId });
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
          await window.electronAPI?.solo?.stop?.({ taskId });
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
          await window.electronAPI?.solo?.delete?.({ taskId });
          set((state) => {
            state.tasks = state.tasks.filter((t) => t.id !== taskId);
            if (state.currentTask?.id === taskId) {
              state.currentTask = null;
            }
          });
        } catch (error: any) {
          set({ error: error.message });
          throw error;
        }
      },

      // 切换跟随模式
      toggleFollow: () => {
        set((state) => {
          state.isFollowing = !state.isFollowing;
        });
      },

      // 清除错误
      clearError: () => {
        set({ error: null });
      },

      // 确认操作（已废弃，使用 answer 替代）
      confirmOperation: (confirmationId, approved) => {
        // 此功能已废弃，保留以保持 API 兼容性
        console.warn('confirmOperation is deprecated, use answerQuestion instead');
      },

      // 添加日志
      addLog: (type, message, details) => {
        set((state) => {
          state.logs.push({
            id: `log-${Date.now()}-${Math.random()}`,
            type,
            message,
            timestamp: Date.now(),
            details,
          });
          // 限制日志数量
          if (state.logs.length > 100) {
            state.logs = state.logs.slice(-100);
          }
        });
      },

      // 更新上下文
      updateContext: (context) => {
        set((state) => {
          state.context = context;
        });
      },
    }))
  )
);

// 设置 IPC 事件监听
// 使用全局标志确保只注册一次
let isSOLOEventListenersSetup = false;

export function setupSOLOEventListeners(): void {
  // 如果已经设置过，直接返回
  if (isSOLOEventListenersSetup) {
    return;
  }
  isSOLOEventListenersSetup = true;

  console.log('[SOLOStore] Setting up SOLO event listeners');

  // 步骤开始
  window.electronAPI?.solo?.onStepStart?.((data: any) => {
    console.log('[SOLOStore] onStepStart:', data.step?.id);
    useSOLOStore.setState((state) => {
      if (state.currentTask) {
        const step = data.step;
        const existingIndex = state.currentTask.steps.findIndex((s) => s.id === step.id);
        if (existingIndex >= 0) {
          state.currentTask.steps[existingIndex] = { ...state.currentTask.steps[existingIndex], ...step };
        } else {
          state.currentTask.steps.push(step);
        }
      }
    });
  });

  // 步骤完成
  window.electronAPI?.solo?.onStepComplete?.((data: any) => {
    console.log('[SOLOStore] onStepComplete:', data.step?.id);
    useSOLOStore.setState((state) => {
      if (state.currentTask) {
        const step = data.step;
        const existingIndex = state.currentTask.steps.findIndex((s) => s.id === step.id);
        if (existingIndex >= 0) {
          state.currentTask.steps[existingIndex] = { ...state.currentTask.steps[existingIndex], ...step, status: 'completed' };
        }
      }
    });
  });

  // 步骤失败
  window.electronAPI?.solo?.onStepFail?.((data: any) => {
    console.log('[SOLOStore] onStepFail:', data.step?.id);
    useSOLOStore.setState((state) => {
      if (state.currentTask) {
        const step = data.step;
        const existingIndex = state.currentTask.steps.findIndex((s) => s.id === step.id);
        if (existingIndex >= 0) {
          state.currentTask.steps[existingIndex] = { ...state.currentTask.steps[existingIndex], ...step, status: 'failed' };
        }
      }
    });
  });

  // 思考内容
  window.electronAPI?.solo?.onThinking?.((data: any) => {
    useSOLOStore.setState((state) => {
      if (state.currentTask) {
        state.currentTask.thinking = data.thinking;
      }
    });
  });

  // 任务更新
  window.electronAPI?.solo?.onTodoUpdate?.((data: any) => {
    console.log('[SOLOStore] onTodoUpdate:', data.items?.length);
    useSOLOStore.setState((state) => {
      if (state.currentTask) {
        state.currentTask.todoItems = data.items || [];
      }
    });
  });

  // 进度消息
  window.electronAPI?.solo?.onProgress?.((data: any) => {
    useSOLOStore.setState((state) => {
      if (state.currentTask) {
        state.currentTask.progressMessage = data.message;
      }
    });
  });

  // 错误
  window.electronAPI?.solo?.onError?.((data: any) => {
    console.log('[SOLOStore] onError:', data.error);
    useSOLOStore.setState((state) => {
      state.error = data.error;
      if (state.currentTask) {
        state.currentTask.status = 'failed';
      }
    });
  });

  // 完成
  window.electronAPI?.solo?.onComplete?.(() => {
    console.log('[SOLOStore] onComplete');
    useSOLOStore.setState((state) => {
      if (state.currentTask) {
        state.currentTask.status = 'completed';
      }
    });
  });
}
