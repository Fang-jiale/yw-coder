/**
 * Chat Header 组件
 * 显示聊天头部信息
 */

import React from 'react';
import { Bot, Settings, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ChatHeaderProps {
  title?: string;
  subtitle?: string;
  agentName?: string;
  onSettingsClick?: () => void;
  onMenuClick?: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  title = 'AI 助手',
  subtitle,
  agentName,
  onSettingsClick,
  onMenuClick,
}) => {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-3">
        {/* AI头像 - 渐变背景圆形设计，带阴影 */}
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 via-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/25 ring-2 ring-white/20 dark:ring-white/10">
          <Bot className="w-5 h-5 text-white" />
        </div>
        
        {/* 标题和副标题垂直排列 */}
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-semibold text-foreground leading-tight">{title}</h2>
          {subtitle && (
            <span className="text-xs text-muted-foreground leading-tight">{subtitle}</span>
          )}
          {/* 模型名称显示 - 蓝色/青色文字突出显示 */}
          {agentName && (
            <span className="text-xs font-medium text-cyan-600 dark:text-cyan-400 leading-tight">
              {agentName}
            </span>
          )}
        </div>
      </div>

      {/* 设置和菜单按钮 - ghost样式，统一尺寸 */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={onSettingsClick}
          className="h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label="设置"
        >
          <Settings className="h-[18px] w-[18px]" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          className="h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label="更多选项"
        >
          <MoreHorizontal className="h-[18px] w-[18px]" />
        </Button>
      </div>
    </div>
  );
};
