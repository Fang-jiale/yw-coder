import { create } from 'zustand';
import type { BuilderTask } from '@shared/types';

interface BuilderState {
  currentTask: BuilderTask | null;
  isRunning: boolean;
  error: string | null;
  
  // Actions
  startBuilder: (description: string, workspacePath: string, configId?: string) => Promise<void>;
  cancelBuilder: () => void;
  updateTask: (task: BuilderTask) => void;
  clearError: () => void;
  reset: () => void;
}

export const useBuilderStore = create<BuilderState>((set) => ({
  currentTask: null,
  isRunning: false,
  error: null,

  startBuilder: async (description: string, workspacePath: string, configId?: string) => {
    set({ isRunning: true, error: null, currentTask: null });
    
    try {
      // Set up progress listener
      window.electronAPI?.builder?.onStatus((task: BuilderTask) => {
        set({ currentTask: task });
      });

      // Start builder task with config
      const task = await window.electronAPI?.builder?.start(description, workspacePath, configId);
      
      if (task) {
        set({ currentTask: task, isRunning: task.status === 'in_progress' });
      }
    } catch (error) {
      set({ error: String(error), isRunning: false });
    }
  },

  cancelBuilder: () => {
    window.electronAPI?.builder?.cancel();
    window.electronAPI?.builder?.removeStatusListener();
    set({ isRunning: false });
  },

  updateTask: (task: BuilderTask) => {
    set({ 
      currentTask: task, 
      isRunning: task.status === 'in_progress' 
    });
  },

  clearError: () => set({ error: null }),

  reset: () => {
    window.electronAPI?.builder?.removeStatusListener();
    set({ currentTask: null, isRunning: false, error: null });
  },
}));
