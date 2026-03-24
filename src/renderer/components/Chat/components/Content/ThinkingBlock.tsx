/**
 * ThinkingBlock 组件
 * AI 思考过程的展示
 */

import React from 'react';
import { Brain, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface ThinkingBlockProps {
  thinking: string;
  isExpanded?: boolean;
  onToggle?: () => void;
  isStreaming?: boolean;
  className?: string;
}

export const ThinkingBlock: React.FC<ThinkingBlockProps> = ({
  thinking,
  isExpanded = true,
  onToggle,
  isStreaming = false,
  className = '',
}) => {
  // 只显示最新的一行思考内容
  const latestLine = thinking.split('\n').filter(line => line.trim()).pop() || '';

  return (
    <div
      className={cn(
        'mb-3 rounded-lg border border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-900/20 dark:to-amber-900/10 dark:border-amber-800/20 overflow-hidden shadow-sm',
        className
      )}
    >
      <div className="flex items-center justify-between px-4 py-3 bg-amber-100/50 dark:bg-amber-900/20 border-b border-amber-200/50 dark:border-amber-800/20">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-amber-500/10 flex items-center justify-center">
            {isStreaming ? (
              <Loader2 className="w-4 h-4 text-amber-600 dark:text-amber-400 animate-spin" />
            ) : (
              <Brain className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            )}
          </div>
          <span className="text-xs font-semibold text-amber-800 dark:text-amber-200 uppercase tracking-wide">
            {isStreaming ? '思考中...' : '思考过程'}
          </span>
        </div>

        {onToggle && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="h-7 px-3 text-xs text-amber-700 dark:text-amber-300 hover:bg-amber-200/50 dark:hover:bg-amber-800/30 transition-all"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-4 h-4 mr-1" />
                收起
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4 mr-1" />
                展开
              </>
            )}
          </Button>
        )}
      </div>

      {isExpanded && (
        <div className="px-4 py-3">
          <pre className="text-xs text-amber-900 dark:text-amber-100 font-mono whitespace-pre-wrap leading-relaxed animate-pulse">
            {latestLine}
          </pre>
        </div>
      )}
    </div>
  );
};
