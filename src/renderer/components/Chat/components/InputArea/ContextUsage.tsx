/**
 * ContextUsage 组件
 * 简化的上下文使用情况展示
 */

import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface ContextMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ContextUsageProps {
  messages: ContextMessage[];
  maxContextTokens?: number;
  systemPrompt?: string;
  className?: string;
}

// 简单的 token 估算：英文 ~4字符/token，中文 ~1.5字符/token
function estimateTokens(content: string): number {
  if (!content) return 0;
  let tokens = 0;
  for (const char of content) {
    if (/[\u4e00-\u9fa5]/.test(char)) {
      tokens += 1.5;
    } else {
      tokens += 0.25;
    }
  }
  return Math.ceil(tokens);
}

export const ContextUsage: React.FC<ContextUsageProps> = ({
  messages,
  maxContextTokens = 8000,
  systemPrompt = '',
  className,
}) => {
  const stats = useMemo(() => {
    const systemTokens = systemPrompt ? estimateTokens(systemPrompt) : 0;
    const messageTokens = messages.reduce((sum, msg) => {
      return sum + estimateTokens(msg.content);
    }, 0);
    const totalTokens = systemTokens + messageTokens;
    const usagePercentage = (totalTokens / maxContextTokens) * 100;

    return {
      totalTokens,
      systemTokens,
      messageTokens,
      usagePercentage,
    };
  }, [messages, maxContextTokens, systemPrompt]);

  const getProgressColor = () => {
    if (stats.usagePercentage >= 90) return 'bg-red-500';
    if (stats.usagePercentage >= 70) return 'bg-amber-500';
    return 'bg-green-500';
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* 进度条 */}
      <div className="w-16 h-1 bg-muted rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-300', getProgressColor())}
          style={{ width: `${Math.min(stats.usagePercentage, 100)}%` }}
        />
      </div>

      {/* Token 数量 */}
      <span
        className={cn(
          'text-[10px] tabular-nums',
          stats.usagePercentage >= 90
            ? 'text-red-500'
            : stats.usagePercentage >= 70
              ? 'text-amber-500'
              : 'text-muted-foreground'
        )}
      >
        {stats.totalTokens.toLocaleString()}
      </span>
    </div>
  );
};
