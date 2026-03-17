/**
 * Agent 任务详情组件
 * 显示任务详情、步骤进度、对话内容
 */

import React, { useEffect, useRef } from 'react';
import { Play, Pause, Square, RotateCcw, CheckCircle, XCircle, Clock, Loader2, ChevronRight, Brain, Wrench, MessageSquare } from 'lucide-react';
import { useAgentStore, AgentTask } from '../../store/agentStore';
import { AgentStep } from '../../../main/agent/agent';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface AgentTaskDetailProps {
  taskId: string;
}

export const AgentTaskDetail: React.FC<AgentTaskDetailProps> = ({ taskId }) => {
  const { tasks, startTask, pauseTask, resumeTask, stopTask } = useAgentStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  const task = tasks.find((t) => t.id === taskId);

  useEffect(() => {
    // Auto scroll to bottom when new messages arrive
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [task?.messages]);

  if (!task) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <p>选择或创建一个任务开始</p>
      </div>
    );
  }

  const getStepIcon = (step: AgentStep) => {
    switch (step.status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'in_progress':
        return <Loader2 className="w-5 h-5 animate-spin text-blue-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStepTypeLabel = (type: AgentStep['type']) => {
    switch (type) {
      case 'analysis':
        return '分析';
      case 'planning':
        return '规划';
      case 'coding':
        return '编码';
      case 'testing':
        return '测试';
      case 'review':
        return '审查';
      default:
        return type;
    }
  };

  const getStepTypeIcon = (type: AgentStep['type']) => {
    switch (type) {
      case 'analysis':
        return <Brain className="w-4 h-4" />;
      case 'planning':
        return <ChevronRight className="w-4 h-4" />;
      case 'coding':
        return <Wrench className="w-4 h-4" />;
      case 'testing':
        return <CheckCircle className="w-4 h-4" />;
      case 'review':
        return <MessageSquare className="w-4 h-4" />;
      default:
        return <ChevronRight className="w-4 h-4" />;
    }
  };

  const handleAction = () => {
    switch (task.status) {
      case 'pending':
        startTask(task.id);
        break;
      case 'running':
        pauseTask(task.id);
        break;
      case 'paused':
        resumeTask(task.id);
        break;
      case 'failed':
      case 'completed':
        startTask(task.id);
        break;
    }
  };

  const getActionButton = () => {
    switch (task.status) {
      case 'pending':
        return (
          <Button onClick={handleAction}>
            <Play className="w-4 h-4 mr-2" />
            开始
          </Button>
        );
      case 'running':
        return (
          <Button onClick={handleAction} variant="outline">
            <Pause className="w-4 h-4 mr-2" />
            暂停
          </Button>
        );
      case 'paused':
        return (
          <Button onClick={handleAction}>
            <Play className="w-4 h-4 mr-2" />
            继续
          </Button>
        );
      case 'failed':
      case 'completed':
        return (
          <Button onClick={handleAction}>
            <RotateCcw className="w-4 h-4 mr-2" />
            重新开始
          </Button>
        );
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-semibold truncate">{task.title}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
            {task.description}
          </p>
        </div>
        <div className="flex items-center gap-2 ml-4">
          {getActionButton()}
          {task.status === 'running' && (
            <Button variant="outline" onClick={() => stopTask(task.id)} className="text-red-500">
              <Square className="w-4 h-4 mr-2" />
              停止
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Steps */}
        <div className="w-64 border-r border-gray-200 dark:border-gray-800 p-4 overflow-y-auto">
          <h3 className="text-sm font-medium mb-3 text-gray-500">执行步骤</h3>
          <div className="space-y-2">
            {task.steps.map((step, index) => (
              <div
                key={step.id}
                className={`flex items-center gap-3 p-3 rounded-lg border ${
                  step.status === 'in_progress'
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                    : step.status === 'completed'
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                    : step.status === 'failed'
                    ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                    : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800'
                }`}
              >
                {getStepIcon(step)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 text-sm font-medium">
                    {getStepTypeIcon(step.type)}
                    <span>{getStepTypeLabel(step.type)}</span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">{step.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Progress */}
          {task.steps.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-gray-500">总体进度</span>
                <span className="font-medium">
                  {Math.round(
                    (task.steps.filter((s) => s.status === 'completed').length / task.steps.length) * 100
                  )}%
                </span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-500"
                  style={{
                    width: `${
                      (task.steps.filter((s) => s.status === 'completed').length / task.steps.length) * 100
                    }%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Right: Messages */}
        <ScrollArea className="flex-1" ref={scrollRef}>
          <div className="p-4 space-y-4">
            {/* Thinking Section */}
            {task.thinking && (
              <Collapsible defaultOpen={false}>
                <CollapsibleTrigger className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                  <Brain className="w-4 h-4" />
                  <span>思考过程</span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                    {task.thinking}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Messages */}
            {task.messages.map((message, index) => (
              <div
                key={message.id || index}
                className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                    message.role === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {message.role === 'user' ? 'U' : 'AI'}
                </div>
                <div
                  className={`max-w-[80%] p-3 rounded-lg ${
                    message.role === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                  }`}
                >
                  <div className="whitespace-pre-wrap text-sm">{message.content}</div>

                  {/* Tool Calls */}
                  {message.toolCalls && message.toolCalls.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {message.toolCalls.map((toolCall) => (
                        <div
                          key={toolCall.id}
                          className={`p-2 rounded text-xs ${
                            toolCall.status === 'running'
                              ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200'
                              : toolCall.status === 'completed'
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                              : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                          }`}
                        >
                          <div className="flex items-center gap-1 font-medium">
                            <Wrench className="w-3 h-3" />
                            <span>{toolCall.toolName}</span>
                            {toolCall.status === 'running' && (
                              <Loader2 className="w-3 h-3 animate-spin ml-1" />
                            )}
                          </div>
                          {toolCall.status === 'completed' && toolCall.result && (
                            <div className="mt-1 text-gray-600 dark:text-gray-400">
                              结果: {JSON.stringify(toolCall.result).substring(0, 100)}
                              {JSON.stringify(toolCall.result).length > 100 ? '...' : ''}
                            </div>
                          )}
                          {toolCall.status === 'error' && toolCall.error && (
                            <div className="mt-1 text-red-600 dark:text-red-400">
                              错误: {toolCall.error}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="text-xs opacity-50 mt-1">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}

            {/* Empty State */}
            {task.messages.length === 0 && task.status === 'pending' && (
              <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                <MessageSquare className="w-12 h-12 mb-2 opacity-50" />
                <p>点击"开始"按钮启动任务</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};
