import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Task {
  id: string;
  title: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  timestamp: number;
  createdAt: number;
  mode?: 'chat' | 'agent' | 'solo';
  messages: TaskMessage[];
}

export interface TaskMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  thinking?: string;
  toolCalls?: any[];
  codeEdits?: any[];
  streamingItems?: Array<{type: 'text' | 'tool', content?: string, toolCall?: any}>;
  agentQuestions?: Array<{id: string; question: string; context?: string; status: 'pending' | 'answered'; answer?: string; options?: Array<{id: string; label: string; value: string}>}>;
}

interface TaskState {
  tasks: Task[];
  activeTaskId: string | null;
  
  // Actions
  createTask: (title?: string, description?: string, mode?: 'chat' | 'agent' | 'solo') => Promise<string>;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  setActiveTask: (id: string | null) => void;
  addMessageToTask: (taskId: string, message: TaskMessage) => void;
  clearAllTasks: () => void;
  loadTasks: () => void;
}

export const useTaskStore = create<TaskState>()(
  persist(
    (set, get) => ({
      tasks: [],
      activeTaskId: null,

      createTask: async (title = '新任务', description = '', mode = 'chat') => {
        const id = Date.now().toString();
        const now = Date.now();
        const newTask: Task = {
          id,
          title,
          status: 'pending',
          timestamp: now,
          createdAt: now,
          mode,
          messages: [],
        };
        set((state) => ({
          tasks: [newTask, ...state.tasks],
          activeTaskId: id,
        }));
        return id;
      },

      updateTask: (id, updates) => {
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id ? { ...task, ...updates } : task
          ),
        }));
      },

      deleteTask: (id) => {
        set((state) => {
          const newTasks = state.tasks.filter((task) => task.id !== id);
          const newActiveId =
            state.activeTaskId === id
              ? newTasks.length > 0
                ? newTasks[0].id
                : null
              : state.activeTaskId;
          return {
            tasks: newTasks,
            activeTaskId: newActiveId,
          };
        });
      },

      setActiveTask: (id) => {
        set({ activeTaskId: id });
      },

      addMessageToTask: (taskId, message) => {
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === taskId
              ? { ...task, messages: [...task.messages, message] }
              : task
          ),
        }));
      },

      clearAllTasks: () => {
        set({ tasks: [], activeTaskId: null });
      },

      loadTasks: () => {
        // Tasks are loaded automatically by persist middleware
      },
    }),
    {
      name: 'aicoder-tasks',
      version: 2,
    }
  )
);
