/**
 * Agent 面板主组件
 * 整合任务列表和详情视图
 */

import React, { useState, useEffect } from 'react';
import { Bot, X } from 'lucide-react';
import { AgentTaskList } from './AgentTaskList';
import { AgentTaskDetail } from './AgentTaskDetail';
import { useAgentStore, setupAgentEventListeners } from '../../store/agentStore';
import { Button } from '@/components/ui/button';

interface AgentPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AgentPanel: React.FC<AgentPanelProps> = ({ isOpen, onClose }) => {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const { tasks, activeTaskId, loadTasks } = useAgentStore();

  // Setup event listeners
  useEffect(() => {
    setupAgentEventListeners();
    loadTasks();
  }, []);

  // Auto select active task
  useEffect(() => {
    if (activeTaskId && !selectedTaskId) {
      setSelectedTaskId(activeTaskId);
    }
  }, [activeTaskId, selectedTaskId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/50" onClick={onClose} />

      {/* Panel */}
      <div className="w-[900px] h-full bg-background shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <Bot className="w-6 h-6 text-blue-500" />
            <h1 className="text-xl font-bold">Agent 智能体</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Task List */}
          <div className="w-80 flex-shrink-0">
            <AgentTaskList
              onSelectTask={setSelectedTaskId}
              selectedTaskId={selectedTaskId}
            />
          </div>

          {/* Task Detail */}
          <div className="flex-1">
            {selectedTaskId ? (
              <AgentTaskDetail taskId={selectedTaskId} />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <Bot className="w-16 h-16 mb-4 opacity-30" />
                <p className="text-lg font-medium">选择一个任务或创建新任务</p>
                <p className="text-sm text-gray-400 mt-1">
                  Agent 可以帮助你规划、构建和审查代码
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
