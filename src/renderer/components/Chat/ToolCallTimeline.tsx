/**
 * Tool Call Timeline Component
 * 参考 Claude Code 和 OpenCode 的工具调用可视化设计
 * 提供时间线式的工具调用展示，增强用户体验
 */

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Terminal,
  FileText,
  Search,
  Edit3,
  FolderOpen,
  Code,
  ChevronDown,
  ChevronRight,
  Clock,
  XCircle,
  Play,
} from 'lucide-react';

export interface ToolCallInfo {
  id: string;
  toolName: string;
  params: Record<string, any>;
  status: 'running' | 'completed' | 'error' | 'pending';
  result?: any;
  error?: string;
  startTime?: number;
  endTime?: number;
  duration?: number;
}

interface ToolCallTimelineProps {
  toolCalls: ToolCallInfo[];
  className?: string;
  showTimeline?: boolean;
  maxHeight?: string;
}

const toolIcons: Record<string, React.ElementType> = {
  read_file: FileText,
  write_file: Edit3,
  edit_file: Edit3,
  search_files: Search,
  list_files: FolderOpen,
  execute_command: Terminal,
  grep_search: Search,
  glob_search: Search,
  get_file_info: FileText,
  ask_followup_question: Code,
  attempt_completion: CheckCircle2,
};

const toolLabels: Record<string, string> = {
  read_file: '读取文件',
  write_file: '写入文件',
  edit_file: '编辑文件',
  search_files: '搜索文件',
  list_files: '列出文件',
  execute_command: '执行命令',
  grep_search: 'Grep 搜索',
  glob_search: 'Glob 搜索',
  get_file_info: '获取文件信息',
  ask_followup_question: '提问',
  attempt_completion: '完成任务',
};

const ToolCallCard: React.FC<{
  toolCall: ToolCallInfo;
  isLast: boolean;
  index: number;
}> = ({ toolCall, isLast, index }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const Icon = toolIcons[toolCall.toolName] || Code;

  const getStatusColor = () => {
    switch (toolCall.status) {
      case 'running':
        return 'border-blue-500/30 bg-blue-500/5 text-blue-600';
      case 'completed':
        return 'border-green-500/30 bg-green-500/5 text-green-600';
      case 'error':
        return 'border-red-500/30 bg-red-500/5 text-red-600';
      case 'pending':
        return 'border-amber-500/30 bg-amber-500/5 text-amber-600';
      default:
        return 'border-border bg-muted/50';
    }
  };

  const getStatusIcon = () => {
    switch (toolCall.status) {
      case 'running':
        return <Loader2 className="w-3.5 h-3.5 animate-spin" />;
      case 'completed':
        return <CheckCircle2 className="w-3.5 h-3.5" />;
      case 'error':
        return <XCircle className="w-3.5 h-3.5" />;
      case 'pending':
        return <Clock className="w-3.5 h-3.5" />;
      default:
        return <Play className="w-3.5 h-3.5" />;
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getParamSummary = () => {
    const params = toolCall.params;
    if (toolCall.toolName === 'read_file' || toolCall.toolName === 'write_file' || toolCall.toolName === 'edit_file') {
      return params.file_path || params.path || '';
    }
    if (toolCall.toolName === 'execute_command') {
      return params.command || '';
    }
    if (toolCall.toolName === 'search_files' || toolCall.toolName === 'grep_search') {
      return params.query || params.pattern || '';
    }
    if (toolCall.toolName === 'list_files') {
      return params.dir_path || '根目录';
    }
    return Object.values(params)[0] || '';
  };

  return (
    <div className="relative flex gap-3">
      {/* Timeline line */}
      {!isLast && (
        <div className="absolute left-[11px] top-6 bottom-0 w-px bg-border" />
      )}

      {/* Status dot */}
      <div
        className={cn(
          'relative z-10 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-1',
          toolCall.status === 'running' && 'bg-blue-500/20',
          toolCall.status === 'completed' && 'bg-green-500/20',
          toolCall.status === 'error' && 'bg-red-500/20',
          toolCall.status === 'pending' && 'bg-amber-500/20'
        )}
      >
        {getStatusIcon()}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-3">
        <div
          className={cn(
            'rounded-lg border p-3 transition-all cursor-pointer hover:shadow-sm',
            getStatusColor(),
            isExpanded && 'shadow-sm'
          )}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {/* Header */}
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span className="font-medium text-sm">
              {toolLabels[toolCall.toolName] || toolCall.toolName}
            </span>
            {toolCall.duration && (
              <span className="text-xs opacity-60 ml-auto">
                {formatDuration(toolCall.duration)}
              </span>
            )}
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 opacity-60" />
            ) : (
              <ChevronRight className="w-4 h-4 opacity-60" />
            )}
          </div>

          {/* Summary */}
          <div className="mt-1 text-xs opacity-80 truncate">
            {getParamSummary()}
          </div>

          {/* Expanded details */}
          {isExpanded && (
            <div className="mt-3 pt-3 border-t border-current border-opacity-20">
              {/* Parameters */}
              <div className="space-y-2">
                <div className="text-xs font-medium opacity-60">参数</div>
                <pre className="text-xs bg-black/5 dark:bg-white/5 p-2 rounded overflow-x-auto">
                  {JSON.stringify(toolCall.params, null, 2)}
                </pre>
              </div>

              {/* Result or Error */}
              {toolCall.result && (
                <div className="mt-3 space-y-2">
                  <div className="text-xs font-medium opacity-60">结果</div>
                  <pre className="text-xs bg-black/5 dark:bg-white/5 p-2 rounded overflow-x-auto max-h-40 overflow-y-auto">
                    {typeof toolCall.result === 'string'
                      ? toolCall.result
                      : JSON.stringify(toolCall.result, null, 2)}
                  </pre>
                </div>
              )}

              {toolCall.error && (
                <div className="mt-3 space-y-2">
                  <div className="text-xs font-medium text-red-600">错误</div>
                  <div className="text-xs text-red-600 bg-red-50 dark:bg-red-950/30 p-2 rounded">
                    {toolCall.error}
                  </div>
                </div>
              )}

              {/* Timing info */}
              {(toolCall.startTime || toolCall.endTime) && (
                <div className="mt-3 flex gap-4 text-xs opacity-60">
                  {toolCall.startTime && (
                    <span>开始: {new Date(toolCall.startTime).toLocaleTimeString()}</span>
                  )}
                  {toolCall.endTime && (
                    <span>结束: {new Date(toolCall.endTime).toLocaleTimeString()}</span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const ToolCallTimeline: React.FC<ToolCallTimelineProps> = ({
  toolCalls,
  className,
  showTimeline = true,
  maxHeight = '300px',
}) => {
  if (!toolCalls || toolCalls.length === 0) {
    return null;
  }

  // 按时间排序
  const sortedCalls = [...toolCalls].sort((a, b) => {
    const timeA = a.startTime || 0;
    const timeB = b.startTime || 0;
    return timeA - timeB;
  });

  const runningCount = sortedCalls.filter((t) => t.status === 'running').length;
  const completedCount = sortedCalls.filter((t) => t.status === 'completed').length;
  const errorCount = sortedCalls.filter((t) => t.status === 'error').length;

  return (
    <div className={cn('bg-muted/30 rounded-lg p-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">工具调用</span>
          <span className="text-xs text-muted-foreground">
            ({sortedCalls.length} 个)
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {runningCount > 0 && (
            <span className="flex items-center gap-1 text-blue-600">
              <Loader2 className="w-3 h-3 animate-spin" />
              {runningCount} 运行中
            </span>
          )}
          {completedCount > 0 && (
            <span className="flex items-center gap-1 text-green-600">
              <CheckCircle2 className="w-3 h-3" />
              {completedCount} 完成
            </span>
          )}
          {errorCount > 0 && (
            <span className="flex items-center gap-1 text-red-600">
              <AlertCircle className="w-3 h-3" />
              {errorCount} 错误
            </span>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div
        className="space-y-0 overflow-y-auto pr-2"
        style={{ maxHeight }}
      >
        {sortedCalls.map((toolCall, index) => (
          <ToolCallCard
            key={toolCall.id}
            toolCall={toolCall}
            isLast={index === sortedCalls.length - 1}
            index={index}
          />
        ))}
      </div>
    </div>
  );
};

export default ToolCallTimeline;
