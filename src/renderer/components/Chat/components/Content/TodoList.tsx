/**
 * TodoList 组件
 * 待办事项清单的展示
 */

import React from 'react';
import { CheckCircle2, Circle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TodoItem } from '@shared/agentTypes';

interface TodoListProps {
  items: TodoItem[];
  className?: string;
}

export const TodoList: React.FC<TodoListProps> = ({ items, className = '' }) => {
  return (
    <div className={cn('space-y-2 bg-gradient-to-br from-muted/30 to-muted/10 rounded-lg border border-border/50 p-4 shadow-sm', className)}>
      <div className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-2 uppercase tracking-wide">
        <span className="w-2 h-2 rounded-full bg-purple-500" />
        <span>待办事项</span>
        <span className="text-[10px]">({items.length})</span>
      </div>

      {items.map((item, index) => (
        <div
          key={item.id}
          className={cn(
            'flex items-start gap-3 text-sm',
            item.status === 'completed' && 'opacity-60'
          )}
        >
          <div className="flex-shrink-0 mt-0.5">
            {item.status === 'completed' ? (
              <div className="w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
              </div>
            ) : item.status === 'in_progress' ? (
              <div className="w-5 h-5 rounded-full bg-blue-500/10 flex items-center justify-center">
                <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
            ) : (
              <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center border border-border">
                <Circle className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
            )}
          </div>

          <div className="flex-1">
            <span
              className={cn(
                'leading-relaxed',
                item.status === 'completed' && 'line-through text-muted-foreground'
              )}
            >
              {item.content}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};
