import { useCallback, useEffect } from 'react';
import { useUnifiedAgentStore } from '@/store/unifiedAgentStore';
import { setupUnifiedAgentEventListeners } from '@/store/unifiedAgentStore';

let isInitialized = false;

export function useAgent() {
  const {
    configs,
    activeConfigId,
    tasks,
    activeTaskId,
    isProcessing,
    streamingMessage,
    createTask,
    startTask,
    pauseTask,
    resumeTask,
    stopTask,
    deleteTask,
    setActiveTask,
    loadConfigs,
    loadTasks,
  } = useUnifiedAgentStore();

  const initialize = useCallback(() => {
    if (!isInitialized) {
      setupUnifiedAgentEventListeners();
      isInitialized = true;
    }
  }, []);

  useEffect(() => {
    initialize();
    loadConfigs();
    loadTasks();
  }, [initialize, loadConfigs, loadTasks]);

  const handleNewTask = useCallback(async (title: string, description: string = '') => {
    try {
      const taskId = await createTask(title, description);
      return taskId;
    } catch (error) {
      console.error('Failed to create task:', error);
      return null;
    }
  }, [createTask]);

  return {
    configs,
    activeConfigId,
    tasks,
    activeTaskId,
    isProcessing,
    streamingMessage,
    createTask: handleNewTask,
    startTask,
    pauseTask,
    resumeTask,
    stopTask,
    deleteTask,
    setActiveTask,
    loadConfigs,
    loadTasks,
  };
}
