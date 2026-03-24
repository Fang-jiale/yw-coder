/**
 * StreamingIndicator 组件
 * 流式接收状态指示器
 */

import React from 'react';
import { Square, AlertCircle, Loader2, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface StreamingIndicatorProps {
  isStreaming: boolean;
  isWaiting?: boolean; // AI 开始回复前的等待
  isTyping?: boolean;
  error?: string | null;
  progress?: number; // 0-100
  elapsedTime?: number; // 毫秒
  onStop?: () => void;
  className?: string;
  // 思考内容，实时展示
  thinkingContent?: string;
}

export const StreamingIndicator: React.FC<StreamingIndicatorProps> = ({
  isStreaming,
  isWaiting = false,
  isTyping = false,
  error = null,
  progress,
  elapsedTime = 0,
  onStop,
  className = '',
  thinkingContent = '',
}) => {
  // 如果没有流式状态、等待状态、打字状态且无错误，则不显示
  if (!isStreaming && !isWaiting && !isTyping && !error) return null;

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  // 获取状态文本
  const getStatusText = () => {
    if (error) return '出错了';
    if (isWaiting) return 'AI 思考中';
    if (isTyping) return '正在输入';
    if (isStreaming) return '接收中';
    return '';
  };

  // 三个跳动的点动画
  const BouncingDots = () => (
    <span className="inline-flex items-center gap-0.5 ml-1">
      <span
        className="w-1 h-1 rounded-full bg-current animate-bounce"
        style={{ animationDelay: '0ms' }}
      />
      <span
        className="w-1 h-1 rounded-full bg-current animate-bounce"
        style={{ animationDelay: '150ms' }}
      />
      <span
        className="w-1 h-1 rounded-full bg-current animate-bounce"
        style={{ animationDelay: '300ms' }}
      />
    </span>
  );

  return (
    <div
      className={cn(
        'flex flex-col border-b border-border/30',
        error && 'bg-destructive/5',
        className
      )}
    >
      {/* 思考内容展示区域 - 只显示最新的一行 */}
      {thinkingContent && (() => {
        const latestLine = thinkingContent.split('\n').filter(line => line.trim()).pop() || '';
        return latestLine ? (
          <div className="px-4 py-2 bg-amber-50/50 dark:bg-amber-900/10 border-b border-amber-200/30 dark:border-amber-800/20">
            <div className="flex items-center gap-2 mb-1">
              <Loader2 className="w-3 h-3 text-amber-600 animate-spin" />
              <span className="text-xs font-medium text-amber-700 dark:text-amber-300">思考中...</span>
            </div>
            <p className="text-xs text-amber-800/80 dark:text-amber-200/80 font-mono truncate">
              {latestLine}
            </p>
          </div>
        ) : null;
      })()}

      <div className="flex items-center justify-center gap-3 py-2">
        <div className="flex items-center gap-2">
          {/* 状态图标 */}
          {error ? (
            <AlertCircle className="w-3 h-3 text-destructive flex-shrink-0" />
          ) : isWaiting ? (
            <Loader2 className="w-3 h-3 text-primary animate-spin flex-shrink-0" />
          ) : (
            <span className="relative flex h-2 w-2 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
          )}

          {/* 状态文本 */}
          <span
            className={cn(
              'text-xs font-medium',
              error ? 'text-destructive' : 'text-primary'
            )}
          >
            {getStatusText()}
            {!error && (isStreaming || isWaiting || isTyping) && <BouncingDots />}
          </span>
        </div>

        {/* 进度条 */}
        {typeof progress === 'number' && progress >= 0 && !error && (
          <div className="flex items-center gap-2">
            <div className="w-16 h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground/70 tabular-nums">
              {Math.round(progress)}%
            </span>
          </div>
        )}

        {/* 已用时间 */}
        {elapsedTime > 0 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground/70">
            <Timer className="w-3 h-3" />
            <span className="tabular-nums">{formatDuration(elapsedTime)}</span>
          </div>
        )}

        {/* 停止按钮 */}
        {onStop && !error && (isStreaming || isWaiting) && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onStop}
            className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          >
            <Square className="w-3 h-3 mr-1 fill-current" />
            停止
          </Button>
        )}
      </div>
    </div>
  );
};

export default StreamingIndicator;
