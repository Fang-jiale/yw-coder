/**
 * ToolCallCard 组件
 * 工具调用卡片的展示
 */

import React from 'react';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Terminal,
  FileText,
  Search,
  Code,
  FolderOpen,
  Eye,
  FileEdit,
  Play,
  Sparkles,
  Trash2,
  Info,
  FileCode,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { AgentToolCall } from '@shared/agentTypes';

interface ToolCallCardProps {
  toolCall: AgentToolCall;
  isExpanded?: boolean;
  onToggle?: () => void;
  className?: string;
}

// 工具配置：图标、标签、颜色主题、自定义渲染
const toolConfig: Record<string, {
  icon: React.ReactNode;
  label: string;
  color: 'blue' | 'green' | 'purple' | 'orange' | 'red';
  renderSummary?: (params: any) => React.ReactNode;
  renderResult?: (result: any) => React.ReactNode;
}> = {
  read_file: {
    icon: <Eye className="w-4 h-4" />,
    label: '读取文件',
    color: 'blue',
    renderSummary: (params) => (
      <div className="flex items-center gap-2">
        <code className="text-xs text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-1 rounded truncate max-w-md">
          {params.file_path || '未指定文件'}
        </code>
        {params.limit && (
          <span className="text-xs text-muted-foreground">
            (前 {params.limit} 行)
          </span>
        )}
      </div>
    ),
    renderResult: (result) => {
      if (typeof result === 'string') {
        const lines = result.split('\n').slice(0, 5);
        const preview = lines.join('\n');
        const isTruncated = result.split('\n').length > 5;
        return (
          <div>
            <div className="bg-blue-500/5 border border-blue-200 dark:border-blue-800 rounded p-2 font-mono text-xs max-h-40 overflow-y-auto">
              <pre className="whitespace-pre-wrap">{preview}</pre>
              {isTruncated && (
                <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  ... 共 {result.split('\n').length} 行
                </div>
              )}
            </div>
          </div>
        );
      }
      return null;
    },
  },
  edit_file: {
    icon: <FileEdit className="w-4 h-4" />,
    label: '写入文件',
    color: 'purple',
    renderSummary: (params) => (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <code className="text-xs text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-1 rounded truncate max-w-md">
            {params.file_path || '未指定文件'}
          </code>
        </div>
        {params.old_string && (
          <div className="text-xs text-red-600 dark:text-red-400 bg-red-500/5 border border-red-200 dark:border-red-800 rounded p-1 font-mono truncate">
            - {params.old_string.substring(0, 50)}
          </div>
        )}
        {params.new_string && (
          <div className="text-xs text-green-600 dark:text-green-400 bg-green-500/5 border border-green-200 dark:border-green-800 rounded p-1 font-mono truncate">
            + {params.new_string.substring(0, 50)}
          </div>
        )}
        {!params.old_string && !params.new_string && params.file_path && (
          <div className="text-xs text-muted-foreground">
            正在流式写入文件...
          </div>
        )}
      </div>
    ),
  },
  delete_file: {
    icon: <Trash2 className="w-4 h-4" />,
    label: '删除文件',
    color: 'red',
    renderSummary: (params) => (
      <div className="flex items-center gap-2">
        <code className="text-xs text-red-600 dark:text-red-400 bg-red-500/10 px-2 py-1 rounded truncate max-w-md">
          {params.file_path || '未指定文件'}
        </code>
      </div>
    ),
  },
  list_files: {
    icon: <FolderOpen className="w-4 h-4" />,
    label: '列出文件',
    color: 'blue',
    renderSummary: (params) => (
      <div className="flex items-center gap-2">
        <code className="text-xs text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-1 rounded">
          {params.dir_path || '根目录'}
        </code>
        {params.recursive && (
          <span className="text-xs text-muted-foreground">
            (递归)
          </span>
        )}
      </div>
    ),
    renderResult: (result) => {
      if (typeof result === 'string') {
        const files = result.split('\n').filter(line => line.trim());
        const count = files.length;
        const preview = files.slice(0, 8).join('\n');
        const isTruncated = count > 8;
        return (
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground mb-1">
              共 {count} 个文件/目录
            </div>
            <div className="bg-blue-500/5 border border-blue-200 dark:border-blue-800 rounded p-2 font-mono text-xs max-h-40 overflow-y-auto">
              <pre className="whitespace-pre-wrap">{preview}</pre>
              {isTruncated && (
                <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  ... 还有 {count - 8} 个
                </div>
              )}
            </div>
          </div>
        );
      }
      return null;
    },
  },
  execute_command: {
    icon: <Terminal className="w-4 h-4" />,
    label: '执行命令',
    color: 'orange',
    renderSummary: (params) => (
      <div className="space-y-1">
        <div className="bg-orange-500/10 border border-orange-200 dark:border-orange-800 rounded px-2 py-1">
          <code className="text-xs text-orange-600 dark:text-orange-400 font-mono">
            {params.command || params.cmd || '未指定命令'}
          </code>
        </div>
        {params.working_directory && (
          <div className="text-xs text-muted-foreground">
            目录: {params.working_directory}
          </div>
        )}
      </div>
    ),
    renderResult: (result) => {
      if (typeof result === 'string') {
        const lines = result.split('\n').slice(0, 10);
        const preview = lines.join('\n');
        const isTruncated = result.split('\n').length > 10;
        return (
          <div className="space-y-1">
            <div className="text-xs text-orange-600 dark:text-orange-400 font-semibold">
              命令输出:
            </div>
            <div className="bg-gray-900 border border-gray-700 rounded p-2 font-mono text-xs text-green-400 max-h-60 overflow-y-auto">
              <pre className="whitespace-pre-wrap">{preview}</pre>
              {isTruncated && (
                <div className="text-xs text-orange-400 mt-1">
                  ... 共 {result.split('\n').length} 行
                </div>
              )}
            </div>
          </div>
        );
      }
      return null;
    },
  },
  search_files: {
    icon: <Search className="w-4 h-4" />,
    label: '搜索文件',
    color: 'blue',
    renderSummary: (params) => (
      <div className="flex items-center gap-2">
        <code className="text-xs text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-1 rounded">
          "{params.query || ''}"
        </code>
        {params.file_pattern && (
          <span className="text-xs text-muted-foreground">
            类型: {params.file_pattern}
          </span>
        )}
      </div>
    ),
    renderResult: (result) => {
      if (typeof result === 'string') {
        const matches = result.match(/\d+/);
        const count = matches ? parseInt(matches[0]) : 0;
        return (
          <div className="bg-blue-500/5 border border-blue-200 dark:border-blue-800 rounded p-2">
            <div className="text-sm font-semibold text-blue-600 dark:text-blue-400">
              找到 {count} 个匹配
            </div>
            {count > 0 && (
              <div className="text-xs text-muted-foreground mt-1">
                点击展开查看详细信息
              </div>
            )}
          </div>
        );
      }
      return null;
    },
  },
  grep_search: {
    icon: <Search className="w-4 h-4" />,
    label: '文本搜索',
    color: 'blue',
    renderSummary: (params) => (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <code className="text-xs text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-1 rounded">
            "{params.query || params.pattern || ''}"
          </code>
        </div>
        {params.path && (
          <div className="text-xs text-muted-foreground">
            路径: {params.path}
          </div>
        )}
      </div>
    ),
  },
  glob_search: {
    icon: <Search className="w-4 h-4" />,
    label: '模式搜索',
    color: 'blue',
    renderSummary: (params) => (
      <div className="flex items-center gap-2">
        <code className="text-xs text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-1 rounded">
          {params.pattern || '未指定模式'}
        </code>
      </div>
    ),
  },
  get_file_info: {
    icon: <Info className="w-4 h-4" />,
    label: '文件信息',
    color: 'blue',
    renderSummary: (params) => (
      <div className="flex items-center gap-2">
        <code className="text-xs text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-1 rounded">
          {params.file_path || '未指定文件'}
        </code>
      </div>
    ),
    renderResult: (result) => {
      if (typeof result === 'object' && result !== null) {
        return (
          <div className="bg-blue-500/5 border border-blue-200 dark:border-blue-800 rounded p-2 space-y-1 text-xs">
            {result.size !== undefined && (
              <div>大小: {result.size} 字节</div>
            )}
            {result.modified !== undefined && (
              <div>修改时间: {new Date(result.modified).toLocaleString()}</div>
            )}
            {result.type !== undefined && (
              <div>类型: {result.type}</div>
            )}
          </div>
        );
      }
      return null;
    },
  },
  attempt_completion: {
    icon: <Sparkles className="w-4 h-4" />,
    label: '完成任务',
    color: 'green',
    renderResult: (result) => {
      if (typeof result === 'string') {
        return (
          <div className="bg-green-500/5 border border-green-200 dark:border-green-800 rounded p-3">
            <div className="text-xs font-semibold text-green-600 dark:text-green-400 mb-1">
              ✓ 任务完成
            </div>
            <div className="text-sm text-green-700 dark:text-green-300">
              {result.length > 150 ? result.substring(0, 150) + '...' : result}
            </div>
          </div>
        );
      }
      return null;
    },
  },
  default: {
    icon: <Code className="w-4 h-4" />,
    label: '工具调用',
    color: 'blue',
  },
};

const colorStyles = {
  blue: {
    border: 'border-blue-300',
    bg: 'bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-900/10',
    iconBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  },
  green: {
    border: 'border-green-300',
    bg: 'bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-900/20 dark:to-green-900/10',
    iconBg: 'bg-green-500/10 text-green-600 dark:text-green-400',
    badge: 'bg-green-500/10 text-green-600 dark:text-green-400',
  },
  purple: {
    border: 'border-purple-300',
    bg: 'bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-900/20 dark:to-purple-900/10',
    iconBg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    badge: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  },
  orange: {
    border: 'border-orange-300',
    bg: 'bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-900/20 dark:to-orange-900/10',
    iconBg: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    badge: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  },
  red: {
    border: 'border-red-300',
    bg: 'bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-900/20 dark:to-red-900/10',
    iconBg: 'bg-red-500/10 text-red-600 dark:text-red-400',
    badge: 'bg-red-500/10 text-red-600 dark:text-red-400',
  },
};

export const ToolCallCard: React.FC<ToolCallCardProps> = ({
  toolCall,
  isExpanded = false,
  onToggle,
  className = '',
}) => {
  const { toolName, params, status, result, error } = toolCall;

  const config = toolConfig[toolName] || toolConfig.default;
  const colorStyle = colorStyles[config.color];

  const icon = config.icon;
  const label = config.label;

  const isRunning = status === 'running';
  const isCompleted = status === 'completed';
  const hasError = status === 'error';

  return (
    <div
      className={cn(
        'rounded-lg border overflow-hidden transition-all shadow-sm',
        colorStyle.border,
        colorStyle.bg,
        hasError && 'border-red-300 bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-900/20 dark:to-red-900/10',
        className
      )}
    >
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-accent/30 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div
            className={cn(
              'flex-shrink-0 p-2 rounded-lg',
              colorStyle.iconBg,
              hasError && 'bg-red-500/10 text-red-600 dark:text-red-400'
            )}
          >
            {isRunning ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : hasError ? (
              <XCircle className="w-4 h-4" />
            ) : (
              icon
            )}
          </div>

          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">{label}</span>
              {isCompleted && (
                <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
              )}
              {hasError && (
                <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
              )}
            </div>
            
            {/* 显示自定义摘要 */}
            {config.renderSummary && (
              <div className="mt-1">
                {config.renderSummary(params)}
              </div>
            )}
          </div>
        </div>

        {onToggle && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs hover:bg-accent/50 flex-shrink-0 ml-2"
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>
        )}
      </div>

      {isExpanded && (
        <div className="px-4 py-3 border-t border-border/50 bg-muted/20 space-y-3">
          {params && Object.keys(params).length > 0 && (
            <div>
              <div className={cn(
                'text-xs font-semibold mb-2 flex items-center gap-1.5',
                colorStyle.badge.replace('bg-', 'text-').replace('/10', '-600 dark:text-' + config.color + '-400')
              )}>
                <span className={cn('w-1.5 h-1.5 rounded-full', colorStyle.badge.replace('bg-', '').replace('/10', '-500'))} />
                参数
              </div>
              <pre className="text-xs bg-background p-3 rounded-md border border-border/50 overflow-x-auto font-mono leading-relaxed max-h-60 overflow-y-auto">
                {JSON.stringify(params, null, 2)}
              </pre>
            </div>
          )}

          {result && (
            <div>
              <div className="text-xs font-semibold text-green-600 dark:text-green-400 mb-2 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                结果
              </div>
              {config.renderResult ? (
                config.renderResult(result)
              ) : (
                <pre className="text-xs bg-background p-3 rounded-md border border-green-200/50 dark:border-green-800/30 overflow-x-auto font-mono leading-relaxed max-h-60 overflow-y-auto">
                  {typeof result === 'string'
                    ? result
                    : JSON.stringify(result, null, 2)}
                </pre>
              )}
            </div>
          )}

          {error && (
            <div>
              <div className="text-xs font-semibold text-red-600 dark:text-red-400 mb-2 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                错误
              </div>
              <pre className="text-xs bg-background p-3 rounded-md border border-red-200/50 dark:border-red-800/30 overflow-x-auto font-mono leading-relaxed text-red-600 dark:text-red-400 max-h-60 overflow-y-auto">
                {error}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
