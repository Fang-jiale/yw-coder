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
  MoreHorizontal,
  Clock,
  Bot,
  Sparkles,
  MessageCircle,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  const { tasks, activeTaskId, setActiveTask, setActiveConfig, deleteTask } = useUnifiedAgentStore();

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
    const mode = task.runtimeMode || 'chat';
    switch (mode) {
      case 'solo':
        return <Sparkles className="w-3.5 h-3.5 text-amber-500" />;
      case 'agent':
        return <Bot className="w-3.5 h-3.5 text-purple-500" />;
      default:
        return <MessageCircle className="w-3.5 h-3.5 text-blue-500" />;
    }
  };

  // 获取任务模式标签
  const getModeLabel = (mode?: string) => {
    switch (mode) {
      case 'solo':
        return 'SOLO';
      case 'agent':
        return 'Agent';
      default:
        return 'Chat';
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
      return filteredContent.slice(0, 50) + (filteredContent.length > 50 ? '...' : '');
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
      <div className="p-3 border-b bg-background/50">
        <Button
          variant="outline"
          className="w-full justify-start gap-2 h-9"
          onClick={handleNewChat}
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm">新建对话</span>
        </Button>
      </div>

      {/* History List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-4">
          {Object.entries(groupedTasks).map(([groupName, groupTasks]) =>
            groupTasks.length > 0 ? (
              <div key={groupName} className="space-y-1">
                <div className="px-2 py-1 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Clock className="w-3 h-3" />
                  {groupName}
                </div>
                {groupTasks.map((task) => (
                  <div
                    key={task.id}
                    className={cn(
                      'group flex items-start gap-2 px-2 py-2 rounded-md cursor-pointer transition-all',
                      'hover:bg-accent',
                      activeTaskId === task.id && 'bg-accent/80'
                    )}
                    onClick={() => {
                      setActiveTask(task.id);
                      // 注意：不要在这里调用 setActiveConfig，否则会重置执行计划等状态
                      // setActiveConfig 应该在切换配置（模式）时调用，而不是切换任务时
                    }}
                  >
                    <div className="mt-0.5 flex-shrink-0">
                      {getTaskIcon(task)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-muted-foreground">
                          {getModeLabel(task.runtimeMode)}
                        </span>
                        <span className="text-xs text-muted-foreground/60">
                          {format(task.createdAt, 'HH:mm', { locale: zhCN })}
                        </span>
                      </div>
                      <p className="text-sm truncate mt-0.5">
                        {getTaskPreview(task)}
                      </p>
                    </div>
                    
                    {/* Actions */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-background rounded transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-32">
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteTask(task.id);
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-2" />
                          删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            ) : null
          )}

          {tasks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <MessageSquare className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">暂无历史记录</p>
              <p className="text-xs mt-1">开始一个新的对话吧</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default ChatHistorySidebar;
