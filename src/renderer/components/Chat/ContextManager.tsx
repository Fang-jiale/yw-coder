/**
 * Context Manager Component
 * 参考 OpenCode 的 auto-compact 功能
 * 提供上下文长度监控和智能压缩
 */

import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  Minimize2,
  Info,
  ChevronDown,
  ChevronUp,
  Database,
  Trash2,
  Scissors,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface ContextMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  tokenCount?: number;
  isCompacted?: boolean;
  compactedSummary?: string;
}

export interface ContextStats {
  totalMessages: number;
  totalTokens: number;
  maxTokens: number;
  userMessages: number;
  assistantMessages: number;
  systemMessages: number;
  compactedMessages: number;
  systemPromptTokens: number; // 系统提示词 token 数
}

interface ContextManagerProps {
  messages: ContextMessage[];
  maxContextTokens?: number;
  warningThreshold?: number;
  criticalThreshold?: number;
  onCompact?: (messageIds: string[]) => void;
  onClear?: () => void;
  className?: string;
  systemPrompt?: string; // 系统提示词内容
}

// 估算 token 数量（简化算法）
const estimateTokens = (text: string): number => {
  // 中文字符约 1.5 tokens，英文单词约 1 token
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
  const otherChars = text.length - chineseChars - englishWords;
  return Math.ceil(chineseChars * 1.5 + englishWords + otherChars * 0.5);
};

// 生成消息摘要
const generateSummary = (message: ContextMessage): string => {
  const maxLength = 100;
  if (message.content.length <= maxLength) {
    return message.content;
  }
  return message.content.substring(0, maxLength) + '...';
};

export const ContextManager: React.FC<ContextManagerProps> = ({
  messages,
  maxContextTokens = 8000,
  warningThreshold = 0.7,
  criticalThreshold = 0.9,
  onCompact,
  onClear,
  className,
  systemPrompt = '', // 默认空系统提示词
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedMessages] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState<ContextStats>({
    totalMessages: 0,
    totalTokens: 0,
    maxTokens: maxContextTokens,
    userMessages: 0,
    assistantMessages: 0,
    systemMessages: 0,
    compactedMessages: 0,
    systemPromptTokens: 0,
  });

  // 计算统计信息（包含系统提示词）
  useEffect(() => {
    const systemPromptTokens = systemPrompt ? estimateTokens(systemPrompt) : 0;

    const newStats: ContextStats = {
      totalMessages: messages.length,
      totalTokens: systemPromptTokens, // 从系统提示词开始计算
      maxTokens: maxContextTokens,
      userMessages: 0,
      assistantMessages: 0,
      systemMessages: 0,
      compactedMessages: 0,
      systemPromptTokens,
    };

    messages.forEach((msg) => {
      const tokenCount = msg.tokenCount || estimateTokens(msg.content);
      newStats.totalTokens += tokenCount;

      if (msg.role === 'user') newStats.userMessages++;
      else if (msg.role === 'assistant') newStats.assistantMessages++;
      else if (msg.role === 'system') newStats.systemMessages++;

      if (msg.isCompacted) newStats.compactedMessages++;
    });

    setStats(newStats);
  }, [messages, maxContextTokens, systemPrompt]);

  const usagePercentage = (stats.totalTokens / stats.maxTokens) * 100;
  const isWarning = usagePercentage >= warningThreshold * 100;
  const isCritical = usagePercentage >= criticalThreshold * 100;

  const getStatusColor = () => {
    if (isCritical) return 'text-red-500 bg-red-500/10 border-red-500/30';
    if (isWarning) return 'text-amber-500 bg-amber-500/10 border-amber-500/30';
    return 'text-green-500 bg-green-500/10 border-green-500/30';
  };

  const getProgressColor = () => {
    if (isCritical) return 'bg-red-500';
    if (isWarning) return 'bg-amber-500';
    return 'bg-green-500';
  };

  // 自动压缩建议
  const getCompactSuggestion = (): { message: string; action: string } | null => {
    if (isCritical) {
      return {
        message: '上下文即将超出限制，建议立即压缩',
        action: 'compact-critical',
      };
    }
    if (isWarning) {
      return {
        message: '上下文使用量较高，建议压缩早期消息',
        action: 'compact-warning',
      };
    }
    return null;
  };

  // 执行压缩
  const handleCompact = useCallback(() => {
    const messagesToCompact = messages
      .filter((msg) => !msg.isCompacted && msg.role !== 'system')
      .slice(0, Math.ceil(messages.length * 0.3)); // 压缩前 30% 的消息

    const idsToCompact = messagesToCompact.map((msg) => msg.id);
    onCompact?.(idsToCompact);
  }, [messages, onCompact]);

  // 智能压缩（保留重要消息）
  const handleSmartCompact = useCallback(() => {
    // 保留最近的消息和重要的系统消息
    const messagesToCompact = messages
      .filter((msg, index) => {
        if (msg.role === 'system') return false;
        if (msg.isCompacted) return false;
        // 保留最近 4 条消息
        if (index >= messages.length - 4) return false;
        return true;
      })
      .slice(0, Math.ceil(messages.length * 0.5));

    const idsToCompact = messagesToCompact.map((msg) => msg.id);
    onCompact?.(idsToCompact);
  }, [messages, onCompact]);

  const suggestion = getCompactSuggestion();

  return (
    <div className={cn('space-y-2', className)}>
      {/* Status Bar */}
      <div
        className={cn(
          'flex items-center gap-3 p-3 rounded-lg border transition-colors',
          getStatusColor()
        )}
      >
        <Database className="w-4 h-4 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium">上下文使用</span>
            <span className="text-xs">
              {stats.totalTokens.toLocaleString()} / {stats.maxTokens.toLocaleString()} tokens
            </span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-300', getProgressColor())}
              style={{ width: `${Math.min(usagePercentage, 100)}%` }}
            />
          </div>
          {/* 显示系统提示词占用 */}
          {stats.systemPromptTokens > 0 && (
            <div className="flex items-center justify-between mt-1 text-[10px] text-muted-foreground">
              <span>系统提示词: {stats.systemPromptTokens.toLocaleString()} tokens</span>
              <span>消息: {(stats.totalTokens - stats.systemPromptTokens).toLocaleString()} tokens</span>
            </div>
          )}
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 hover:bg-black/5 rounded transition-colors"
        >
          {isExpanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Warning Message */}
      {suggestion && (
        <div
          className={cn(
            'flex items-center gap-2 p-2 rounded-lg text-sm',
            isCritical
              ? 'bg-red-500/10 text-red-600 border border-red-500/20'
              : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
          )}
        >
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{suggestion.message}</span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={handleSmartCompact}
          >
            <Minimize2 className="w-3 h-3 mr-1" />
            压缩
          </Button>
        </div>
      )}

      {/* Expanded Details */}
      {isExpanded && (
        <div className="bg-muted/30 rounded-lg p-4 space-y-4">
          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-background rounded-lg p-3 text-center">
              <div className="text-lg font-semibold">{stats.userMessages}</div>
              <div className="text-xs text-muted-foreground">用户消息</div>
            </div>
            <div className="bg-background rounded-lg p-3 text-center">
              <div className="text-lg font-semibold">{stats.assistantMessages}</div>
              <div className="text-xs text-muted-foreground">AI 消息</div>
            </div>
            <div className="bg-background rounded-lg p-3 text-center">
              <div className="text-lg font-semibold">{stats.compactedMessages}</div>
              <div className="text-xs text-muted-foreground">已压缩</div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={handleCompact}
              disabled={stats.totalTokens < maxContextTokens * 0.5}
            >
              <Scissors className="w-4 h-4 mr-1" />
              压缩旧消息
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={handleSmartCompact}
              disabled={messages.length <= 4}
            >
              <Minimize2 className="w-4 h-4 mr-1" />
              智能压缩
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={onClear}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>

          {/* Message List */}
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2">消息历史</div>
            <ScrollArea className="h-48">
              <div className="space-y-1">
                {messages.map((msg, index) => (
                  <div
                    key={msg.id}
                    className={cn(
                      'flex items-center gap-2 p-2 rounded text-sm',
                      msg.isCompacted && 'opacity-60 bg-muted/50',
                      selectedMessages.has(msg.id) && 'bg-primary/10'
                    )}
                  >
                    <div
                      className={cn(
                        'w-2 h-2 rounded-full flex-shrink-0',
                        msg.role === 'user' && 'bg-blue-500',
                        msg.role === 'assistant' && 'bg-green-500',
                        msg.role === 'system' && 'bg-purple-500'
                      )}
                    />
                    <span className="text-xs text-muted-foreground w-6">
                      #{index + 1}
                    </span>
                    <span className="flex-1 truncate">
                      {msg.isCompacted ? (
                        <span className="text-muted-foreground italic">
                          [已压缩] {msg.compactedSummary || generateSummary(msg)}
                        </span>
                      ) : (
                        generateSummary(msg)
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {(msg.tokenCount || estimateTokens(msg.content)).toLocaleString()} tokens
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Tips */}
          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p>• 压缩会将消息内容替换为摘要，减少 token 消耗</p>
              <p>• 系统消息和最近的消息不会被自动压缩</p>
              <p>• 建议在上下文使用超过 70% 时进行压缩</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Hook for managing context compaction
export function useContextCompaction(
  messages: ContextMessage[],
  options?: {
    maxTokens?: number;
    autoCompact?: boolean;
    autoCompactThreshold?: number;
    onCompact?: (compactedIds: string[]) => void;
  }
) {
  const [compactedIds, setCompactedIds] = useState<Set<string>>(new Set());

  const stats = React.useMemo(() => {
    const totalTokens = messages.reduce(
      (sum, msg) => sum + (msg.tokenCount || estimateTokens(msg.content)),
      0
    );
    return {
      totalTokens,
      maxTokens: options?.maxTokens || 8000,
      usagePercentage: (totalTokens / (options?.maxTokens || 8000)) * 100,
    };
  }, [messages, options?.maxTokens]);

  // Auto-compact when threshold is reached
  useEffect(() => {
    if (
      options?.autoCompact &&
      stats.usagePercentage >= (options?.autoCompactThreshold || 85)
    ) {
      const messagesToCompact = messages
        .filter((msg) => !msg.isCompacted && msg.role !== 'system')
        .slice(0, Math.ceil(messages.length * 0.3));

      const newCompactedIds = new Set(compactedIds);
      messagesToCompact.forEach((msg) => newCompactedIds.add(msg.id));
      setCompactedIds(newCompactedIds);
      options?.onCompact?.(messagesToCompact.map((m) => m.id));
    }
  }, [stats.usagePercentage, messages, options, compactedIds]);

  const compactMessages = useCallback(
    (ids: string[]) => {
      const newCompactedIds = new Set(compactedIds);
      ids.forEach((id) => newCompactedIds.add(id));
      setCompactedIds(newCompactedIds);
      options?.onCompact?.(ids);
    },
    [compactedIds, options]
  );

  const clearCompaction = useCallback(() => {
    setCompactedIds(new Set());
  }, []);

  return {
    stats,
    compactedIds: Array.from(compactedIds),
    compactMessages,
    clearCompaction,
    shouldCompact: stats.usagePercentage >= 70,
  };
}

export default ContextManager;
