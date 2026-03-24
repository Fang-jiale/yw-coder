import React from 'react';
import { Button } from './button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 px-4 text-center',
        className
      )}
    >
      {icon && (
        <div className="mb-4 text-muted-foreground/50">{icon}</div>
      )}
      <h3 className="text-lg font-medium text-foreground mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-md mb-6">
          {description}
        </p>
      )}
      {action && (
        <Button onClick={action.onClick} variant="default" size="sm">
          {action.label}
        </Button>
      )}
    </div>
  );
}

export function ChatEmptyState({ onNewChat }: { onNewChat?: () => void }) {
  return (
    <EmptyState
      icon={
        <svg
          className="w-16 h-16"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
      }
      title="开始新对话"
      description="输入你的问题或指令，AI 助手将帮助你完成各种编程任务"
      action={
        onNewChat
          ? {
              label: '新建对话',
              onClick: onNewChat,
            }
          : undefined
      }
    />
  );
}

export function FilesEmptyState({ onCreateFile }: { onCreateFile?: () => void }) {
  return (
    <EmptyState
      icon={
        <svg
          className="w-16 h-16"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
          />
        </svg>
      }
      title="暂无文件"
      description="在工作区中打开一个文件夹开始编辑"
      action={
        onCreateFile
          ? {
              label: '新建文件',
              onClick: onCreateFile,
            }
          : undefined
      }
    />
  );
}

export function TasksEmptyState({ onCreateTask }: { onCreateTask?: () => void }) {
  return (
    <EmptyState
      icon={
        <svg
          className="w-16 h-16"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
          />
        </svg>
      }
      title="暂无任务"
      description="创建一个新任务开始使用 AI 助手"
      action={
        onCreateTask
          ? {
              label: '创建任务',
              onClick: onCreateTask,
            }
          : undefined
      }
    />
  );
}
