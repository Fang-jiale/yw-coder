/**
 * 对话历史侧边栏
 * 对标 Trae 的历史记录面板
 */

import React from 'react';
import { useUnifiedAgentStore } from '@/store/unifiedAgentStore';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  MessageSquare,
  Plus,
  Trash2,
  Clock,
  Bot,
  Sparkles,
  Code2,
  Zap,
} from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface ChatHistorySidebarProps {
  className?: string;
  onNewChat?: () => void;
}

export const ChatHistorySidebar: React.FC<ChatHistorySidebarProps> = ({
  className,
  onNewChat,
}) => {
  const { tasks, activeTaskId, setActiveTask, deleteTask } = useUnifiedAgentStore();

  // 按日期分组任务
  const groupedTasks = React.useMemo(() => {
    const groups: { [key: string]: typeof tasks } = {
      '今天': [],
      '昨天': [],
      '最近7天': [],
      '更早': [],
    };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    tasks.forEach((task) => {
      const taskDate = new Date(task.createdAt);
      if (taskDate >= today) {
        groups['今天'].push(task);
      } else if (taskDate >= yesterday) {
        groups['昨天'].push(task);
      } else if (taskDate >= lastWeek) {
        groups['最近7天'].push(task);
      } else {
        groups['更早'].push(task);
      }
    });

    return groups;
  }, [tasks]);

  // 获取任务图标
  const getTaskIcon = (task: typeof tasks[0]) => {
    const mode = task.agentType || 'chat';
    switch (mode) {
      case 'solocoder':
        return <Zap className="w-3.5 h-3.5 text-green-500" />;
      case 'builder':
        return <Code2 className="w-3.5 h-3.5 text-purple-500" />;
      default:
        return <MessageSquare className="w-3.5 h-3.5 text-blue-500" />;
    }
  };

  // 获取任务模式标签
  const getModeLabel = (mode?: string) => {
    switch (mode) {
      case 'solocoder':
        return 'Solo Coder';
      case 'builder':
        return '代码构建器';
      default:
        return '对话助手';
    }
  };

  // 过滤标签，获取纯文本预览
  const filterTags = (content: string): string => {
    return content
      // 过滤 think 标签
      .replace(/<think[\s\S]*?<\/think>/g, '')
      // 过滤 file 标签
      .replace(/<file[^>]*>[\s\S]*?<\/file>/g, '')
      // 过滤 todo 标签
      .replace(/<todo[\s\S]*?<\/todo>/g, '')
      // 过滤 question 标签
      .replace(/<question[\s\S]*?<\/question>/g, '')
      // 过滤工具调用标签
      .replace(/<tool[^>]*>[\s\S]*?<\/tool>/g, '')
      .replace(/<tool_call[^>]*>[\s\S]*?<\/tool_call>/g, '')
      // 过滤其他 XML 标签
      .replace(/<[^>]+>/g, '')
      // 清理多余空白
      .replace(/\s+/g, ' ')
      .trim();
  };

  // 获取任务第一条消息预览
  const getTaskPreview = (task: typeof tasks[0]) => {
    const firstUserMessage = task.messages.find((m) => m.role === 'user');
    if (firstUserMessage) {
      const filteredContent = filterTags(firstUserMessage.content);
      return filteredContent.slice(0, 40) + (filteredContent.length > 40 ? '...' : '');
    }
    return '新对话';
  };

  // 处理新建对话 - 只调用传入的回调，由父组件处理创建逻辑
  const handleNewChat = () => {
    onNewChat?.();
  };

  return (
    <div className={cn('flex flex-col h-full bg-background border-r', className)}>
      {/* Header */}
      <div className="p-3 border-b bg-background/50 backdrop-blur-sm">
        <Button
          variant="outline"
          className="w-full justify-start gap-2 h-9 hover:bg-primary/10 hover:border-primary/30 transition-all"
          onClick={handleNewChat}
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm">新建对话</span>
        </Button>
      </div>

      {/* History List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2 space-y-4">
          {Object.entries(groupedTasks).map(([groupName, groupTasks]) =>
            groupTasks.length > 0 ? (
              <div key={groupName} className="space-y-1">
                <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground/80 flex items-center gap-1.5 uppercase tracking-wide">
                  <Clock className="w-3 h-3" />
                  {groupName}
                </div>
                {groupTasks.map((task) => (
                  <div
                    key={task.id}
                    className={cn(
                      'group flex items-start gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer transition-all',
                      'hover:bg-accent/50 border border-transparent hover:border-accent',
                      activeTaskId === task.id && 'bg-primary/10 border-primary/20'
                    )}
                    onClick={() => {
                      setActiveTask(task.id);
                    }}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {getTaskIcon(task)}
                    </div>
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-muted-foreground/80 shrink-0">
                          {getModeLabel(task.agentType)}
                        </span>
                        <span className="text-xs text-muted-foreground/60 shrink-0">
                          {format(task.createdAt, 'HH:mm', { locale: zhCN })}
                        </span>
                      </div>
                      <p className="text-sm text-foreground/80 truncate leading-relaxed">
                        {getTaskPreview(task)}
                      </p>
                    </div>
                    
                    {/* Delete Button - 悬浮可见 */}
                    <button
                      className="opacity-0 group-hover:opacity-100 flex-shrink-0 p-1.5 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 rounded transition-all"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteTask(task.id);
                      }}
                      title="删除对话"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null
          )}

          {tasks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <MessageSquare className="w-12 h-12 mb-4 opacity-20" />
              <p className="text-sm font-medium">暂无历史记录</p>
              <p className="text-xs mt-1.5">开始一个新的对话吧</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatHistorySidebar;
