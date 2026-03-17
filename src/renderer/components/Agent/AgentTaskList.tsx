/**
 * Agent 任务列表组件
 * 显示所有 Agent 任务，支持创建新任务
 */

import React, { useState } from 'react';
import { Plus, Play, Pause, Square, Trash2, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import { useAgentStore, AgentTask } from '../../store/agentStore';
import { AgentMode } from '../../../main/agent/agent';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AgentTaskListProps {
  onSelectTask?: (taskId: string) => void;
  selectedTaskId?: string | null;
}

export const AgentTaskList: React.FC<AgentTaskListProps> = ({
  onSelectTask,
  selectedTaskId,
}) => {
  const { tasks, activeTaskId, isCreating, createTask, startTask, pauseTask, stopTask, deleteTask, setActiveTask } = useAgentStore();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskMode, setNewTaskMode] = useState<AgentMode>('build');

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim()) return;
    
    try {
      const taskId = await createTask(
        newTaskTitle,
        newTaskDescription || newTaskTitle,
        newTaskMode
      );
      setShowCreateDialog(false);
      setNewTaskTitle('');
      setNewTaskDescription('');
      onSelectTask?.(taskId);
    } catch (error) {
      console.error('Failed to create task:', error);
    }
  };

  const handleTaskClick = (taskId: string) => {
    setActiveTask(taskId);
    onSelectTask?.(taskId);
  };

  const getStatusIcon = (status: AgentTask['status']) => {
    switch (status) {
      case 'running':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'paused':
        return <Pause className="w-4 h-4 text-yellow-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getModeLabel = (mode: AgentMode) => {
    switch (mode) {
      case 'plan':
        return '规划';
      case 'build':
        return '构建';
      case 'review':
        return '审查';
      default:
        return mode;
    }
  };

  const getModeColor = (mode: AgentMode) => {
    switch (mode) {
      case 'plan':
        return 'bg-purple-100 text-purple-700';
      case 'build':
        return 'bg-blue-100 text-blue-700';
      case 'review':
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
        <h2 className="text-lg font-semibold">Agent 任务</h2>
        <Button
          size="sm"
          onClick={() => setShowCreateDialog(true)}
          disabled={isCreating}
        >
          <Plus className="w-4 h-4 mr-1" />
          新建任务
        </Button>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-500">
            <Clock className="w-12 h-12 mb-2 opacity-50" />
            <p>暂无任务</p>
            <p className="text-sm">点击上方按钮创建新任务</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-800">
            {tasks.map((task) => (
              <div
                key={task.id}
                className={`p-4 cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 ${
                  selectedTaskId === task.id ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500' : ''
                }`}
                onClick={() => handleTaskClick(task.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {getStatusIcon(task.status)}
                      <span className="font-medium truncate">{task.title}</span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {task.description}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${getModeColor(task.mode)}`}>
                        {getModeLabel(task.mode)}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(task.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex items-center gap-1 ml-2">
                    {task.status === 'pending' && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="w-8 h-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          startTask(task.id);
                        }}
                      >
                        <Play className="w-4 h-4" />
                      </Button>
                    )}
                    {task.status === 'running' && (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="w-8 h-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            pauseTask(task.id);
                          }}
                        >
                          <Pause className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="w-8 h-8 text-red-500"
                          onClick={(e) => {
                            e.stopPropagation();
                            stopTask(task.id);
                          }}
                        >
                          <Square className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                    {task.status === 'paused' && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="w-8 h-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          startTask(task.id);
                        }}
                      >
                        <Play className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="w-8 h-8 text-red-500"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteTask(task.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Progress */}
                {task.status === 'running' && task.steps.length > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>进度</span>
                      <span>
                        {task.steps.filter((s) => s.status === 'completed').length} / {task.steps.length}
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all duration-300"
                        style={{
                          width: `${(task.steps.filter((s) => s.status === 'completed').length / task.steps.length) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Task Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>创建新任务</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-1 block">任务标题</label>
              <Input
                placeholder="例如：实现用户登录功能"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">任务描述</label>
              <Input
                placeholder="详细描述任务需求..."
                value={newTaskDescription}
                onChange={(e) => setNewTaskDescription(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">工作模式</label>
              <Select value={newTaskMode} onValueChange={(v) => setNewTaskMode(v as AgentMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="plan">规划模式 - 分析需求并制定计划</SelectItem>
                  <SelectItem value="build">构建模式 - 实现功能代码</SelectItem>
                  <SelectItem value="review">审查模式 - 审查代码质量</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              取消
            </Button>
            <Button onClick={handleCreateTask} disabled={!newTaskTitle.trim() || isCreating}>
              {isCreating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              创建任务
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
