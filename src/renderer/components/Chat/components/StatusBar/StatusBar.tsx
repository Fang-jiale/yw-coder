/**
 * StatusBar 组件
 * 简洁的状态栏组件
 */

import React from 'react';
import { Square, AlertCircle, X, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface ProcessingIndicatorProps {
  isProcessing: boolean;
  isRetrying?: boolean;
  retryCount?: number;
  maxRetries?: number;
  elapsedTime?: number;
  onStop?: () => void;
  className?: string;
}

export const ProcessingIndicator: React.FC<ProcessingIndicatorProps> = ({
  isProcessing,
  isRetrying = false,
  retryCount = 0,
  maxRetries = 3,
  elapsedTime = 0,
  onStop,
  className = '',
}) => {
  if (!isProcessing) return null;

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  return (
    <div
      className={cn(
        'flex items-center justify-center gap-3 py-2 border-b border-border/30',
        className
      )}
    >
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/60" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
        </span>
        <span className="text-xs text-primary font-medium">
          {isRetrying ? `重试中 (${retryCount + 1}/${maxRetries})` : '处理中...'}
        </span>
      </div>

      {elapsedTime > 0 && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground/70">
          <Timer className="w-3 h-3" />
          <span className="tabular-nums">{formatDuration(elapsedTime)}</span>
        </div>
      )}

      {onStop && (
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
  );
};

interface ErrorBannerProps {
  error: string | null;
  onClose?: () => void;
  className?: string;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({
  error,
  onClose,
  className = '',
}) => {
  if (!error) return null;

  return (
    <div
      className={cn(
        'mx-auto max-w-4xl w-full px-4 pb-2',
        className
      )}
    >
      <div className="bg-destructive/10 text-destructive text-xs px-3 py-2 rounded-lg flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          <span className="flex-1">{error}</span>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="hover:bg-destructive/20 p-1 rounded ml-2"
            aria-label="关闭"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
};

interface TokenCounterProps {
  used: number;
  max: number;
  className?: string;
}

export const TokenCounter: React.FC<TokenCounterProps> = ({
  used,
  max,
  className = '',
}) => {
  const percentage = (used / max) * 100;
  const getColor = () => {
    if (percentage < 60) return 'bg-green-500';
    if (percentage < 85) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground/60">
        <span>Token 使用</span>
        <span>{used} / {max}</span>
      </div>
      <div className="h-1 bg-muted rounded-full overflow-hidden">
        <div
          className={cn('h-full transition-all', getColor())}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
