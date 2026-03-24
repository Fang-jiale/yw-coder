/**
 * SlashCommandMenu 组件
 * 命令菜单
 */

import React from 'react';
import {
  Zap,
  Search,
  Pencil,
  Code2,
  MessageCircle,
  Bug,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface SlashCommand {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  action: string;
}

const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: 'mode',
    name: '模式切换',
    description: '切换对话模式',
    icon: <Zap className="w-4 h-4" />,
    action: '/mode ',
  },
  {
    id: 'find',
    name: '查找代码',
    description: '搜索文件内容',
    icon: <Search className="w-4 h-4" />,
    action: '/find ',
  },
  {
    id: 'edit',
    name: '编辑文件',
    description: '修改现有文件',
    icon: <Pencil className="w-4 h-4" />,
    action: '/edit ',
  },
  {
    id: 'code',
    name: '生成代码',
    description: '创建新代码',
    icon: <Code2 className="w-4 h-4" />,
    action: '/code ',
  },
  {
    id: 'ask',
    name: '询问',
    description: '提问问题',
    icon: <MessageCircle className="w-4 h-4" />,
    action: '/ask ',
  },
  {
    id: 'fix',
    name: '修复',
    description: '修复代码问题',
    icon: <Bug className="w-4 h-4" />,
    action: '/fix ',
  },
  {
    id: 'clear',
    name: '清空对话',
    description: '清除所有消息',
    icon: <X className="w-4 h-4" />,
    action: '/clear',
  },
];

interface SlashCommandMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (command: SlashCommand) => void;
  className?: string;
}

export const SlashCommandMenu: React.FC<SlashCommandMenuProps> = ({
  isOpen,
  onClose,
  onSelect,
  className = '',
}) => {
  if (!isOpen) return null;

  return (
    <div
      className={cn(
        'mb-2 p-2 bg-popover border rounded-lg shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200',
        className
      )}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {SLASH_COMMANDS.map((command) => (
          <button
            key={command.id}
            onClick={() => {
              onSelect(command);
              onClose();
            }}
            className="flex items-center gap-2 p-2 rounded-lg hover:bg-accent transition-colors text-left group"
          >
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              {command.icon}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-medium truncate">{command.name}</span>
              <span className="text-[10px] text-muted-foreground truncate">
                {command.description}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
