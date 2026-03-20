import React from 'react';
import {
  FileText,
  Terminal,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  FilePlus,
  FileEdit,
  FileX,
  ExternalLink,
  Code,
} from 'lucide-react';
import {
  FileResultCard as FileResultCardType,
  CommandResultCard as CommandResultCardType,
  EnvCheckResultCard as EnvCheckResultCardType,
} from '../../../../shared/types';
import { cn } from '@/lib/utils';

interface BaseCardProps {
  title: string;
  status: 'success' | 'error' | 'pending';
  description: string;
  timestamp?: number;
  children?: React.ReactNode;
  className?: string;
}

const statusConfig = {
  success: {
    icon: CheckCircle,
    iconClass: 'text-green-500',
    bgClass: 'bg-green-500/10',
    borderClass: 'border-green-500/30',
  },
  error: {
    icon: XCircle,
    iconClass: 'text-red-500',
    bgClass: 'bg-red-500/10',
    borderClass: 'border-red-500/30',
  },
  pending: {
    icon: Clock,
    iconClass: 'text-gray-400',
    bgClass: 'bg-gray-500/10',
    borderClass: 'border-gray-500/30',
  },
};

export const ResultCard: React.FC<BaseCardProps> = ({
  title,
  status,
  description,
  timestamp,
  children,
  className,
}) => {
  const config = statusConfig[status];
  const Icon = config.icon;

  const formatTime = (ts: number) => {
    const date = new Date(ts);
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div
      className={cn(
        'border rounded-lg p-4 bg-white shadow-sm transition-all',
        config.borderClass,
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn('p-1.5 rounded-full', config.bgClass)}>
          <Icon className={cn('w-4 h-4', config.iconClass)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-sm">{title}</h4>
            {timestamp && (
              <span className="text-xs text-gray-400">{formatTime(timestamp)}</span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{description}</p>
          {children && <div className="mt-3">{children}</div>}
        </div>
      </div>
    </div>
  );
};

interface FileResultCardProps {
  card: FileResultCardType;
  onOpenFile?: (filePath: string) => void;
  onViewCode?: (filePath: string) => void;
}

const operationConfig = {
  create: {
    icon: FilePlus,
    label: '创建',
    colorClass: 'text-blue-500',
    bgClass: 'bg-blue-500/10',
  },
  edit: {
    icon: FileEdit,
    label: '修改',
    colorClass: 'text-amber-500',
    bgClass: 'bg-amber-500/10',
  },
  delete: {
    icon: FileX,
    label: '删除',
    colorClass: 'text-red-500',
    bgClass: 'bg-red-500/10',
  },
};

export const FileResultCard: React.FC<FileResultCardProps> = ({
  card,
  onOpenFile,
  onViewCode,
}) => {
  const opConfig = operationConfig[card.operation];
  const OpIcon = opConfig.icon;

  return (
    <ResultCard
      title={card.title}
      status={card.status}
      description={card.description}
      timestamp={card.timestamp}
    >
      <div className="space-y-3">
        <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-md">
          <div className={cn('p-1.5 rounded', opConfig.bgClass)}>
            <OpIcon className={cn('w-3.5 h-3.5', opConfig.colorClass)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-xs font-mono text-gray-600 truncate">
                {card.filePath}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={cn(
                  'text-xs px-1.5 py-0.5 rounded',
                  opConfig.bgClass,
                  opConfig.colorClass
                )}
              >
                {opConfig.label}
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => onOpenFile?.(card.filePath)}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 hover:underline"
          >
            <ExternalLink className="w-3 h-3" />
            打开文件
          </button>
          <button
            onClick={() => onViewCode?.(card.filePath)}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 hover:underline"
          >
            <Code className="w-3 h-3" />
            查看代码
          </button>
        </div>
      </div>
    </ResultCard>
  );
};

interface CommandResultCardProps {
  card: CommandResultCardType;
  onViewOutput?: (command: string) => void;
}

export const CommandResultCard: React.FC<CommandResultCardProps> = ({
  card,
  onViewOutput,
}) => {
  const statusIcon =
    card.status === 'success' ? (
      <CheckCircle className="w-3.5 h-3.5 text-green-500" />
    ) : card.status === 'error' ? (
      <XCircle className="w-3.5 h-3.5 text-red-500" />
    ) : (
      <AlertCircle className="w-3.5 h-3.5 text-gray-400" />
    );

  return (
    <ResultCard
      title={card.title}
      status={card.status}
      description={card.description}
      timestamp={card.timestamp}
    >
      <div className="space-y-3">
        <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-md font-mono text-xs">
          <Terminal className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <span className="text-gray-700 truncate">{card.command}</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            {statusIcon}
            <span
              className={cn(
                'text-xs font-medium',
                card.status === 'success'
                  ? 'text-green-600'
                  : card.status === 'error'
                  ? 'text-red-600'
                  : 'text-gray-500'
              )}
            >
              {card.status === 'success' ? '执行成功' : card.status === 'error' ? '执行失败' : '执行中'}
            </span>
          </div>

          {card.exitCode !== undefined && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400">退出码:</span>
              <span
                className={cn(
                  'text-xs font-mono px-1.5 py-0.5 rounded',
                  card.exitCode === 0
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                )}
              >
                {card.exitCode}
              </span>
            </div>
          )}
        </div>

        {card.outputSummary && (
          <div className="text-xs text-gray-500 p-2 bg-gray-50 rounded border border-gray-200">
            <span className="text-gray-400">输出摘要:</span>
            <span className="ml-1 text-gray-600">{card.outputSummary}</span>
          </div>
        )}

        {card.output && onViewOutput && (
          <button
            onClick={() => onViewOutput(card.command)}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 hover:underline"
          >
            <Terminal className="w-3 h-3" />
            查看完整输出
          </button>
        )}
      </div>
    </ResultCard>
  );
};

interface EnvCheckResultCardProps {
  card: EnvCheckResultCardType;
}

type CheckStatus = 'installed' | 'not_installed' | 'version_mismatch' | 'unknown';

const getCheckStatus = (card: EnvCheckResultCardType): CheckStatus => {
  if (card.status === 'success') {
    return 'installed';
  }
  if (card.status === 'error') {
    if (card.detectedValue && card.expectedValue) {
      return 'version_mismatch';
    }
    return 'not_installed';
  }
  return 'unknown';
};

export const EnvCheckResultCard: React.FC<EnvCheckResultCardProps> = ({
  card,
}) => {
  const checkStatus = getCheckStatus(card);

  const statusLabel = {
    installed: '已安装',
    not_installed: '未安装',
    version_mismatch: '版本不匹配',
    unknown: '检查中',
  };

  const statusColor = {
    installed: {
      text: 'text-green-600',
      bg: 'bg-green-100',
      border: 'border-green-300',
    },
    not_installed: {
      text: 'text-red-600',
      bg: 'bg-red-100',
      border: 'border-red-300',
    },
    version_mismatch: {
      text: 'text-amber-600',
      bg: 'bg-amber-100',
      border: 'border-amber-300',
    },
    unknown: {
      text: 'text-gray-600',
      bg: 'bg-gray-100',
      border: 'border-gray-300',
    },
  };

  const colors = statusColor[checkStatus];

  return (
    <ResultCard
      title={card.title}
      status={card.status}
      description={card.description}
      timestamp={card.timestamp}
    >
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">检查项:</span>
          <span className="text-xs font-medium text-gray-700">{card.checkItem}</span>
        </div>

        {card.detectedValue && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">检测值:</span>
            <code className="text-xs px-1.5 py-0.5 bg-gray-100 rounded text-gray-700">
              {card.detectedValue}
            </code>
          </div>
        )}

        {card.expectedValue && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">期望值:</span>
            <code className="text-xs px-1.5 py-0.5 bg-gray-100 rounded text-gray-700">
              {card.expectedValue}
            </code>
          </div>
        )}

        <div className="pt-2 border-t border-gray-100">
          <span
            className={cn(
              'inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border',
              colors.bg,
              colors.text,
              colors.border
            )}
          >
            {checkStatus === 'installed' && <CheckCircle className="w-3 h-3" />}
            {checkStatus === 'not_installed' && <XCircle className="w-3 h-3" />}
            {checkStatus === 'version_mismatch' && <AlertCircle className="w-3 h-3" />}
            {checkStatus === 'unknown' && <Clock className="w-3 h-3" />}
            {statusLabel[checkStatus]}
          </span>
        </div>
      </div>
    </ResultCard>
  );
};

export type { FileResultCardProps, CommandResultCardProps, EnvCheckResultCardProps };
