/**
 * SOLO Progress Panel Component
 * 参考 Trae 的 SOLO 模式设计，提供丰富的任务进度可视化
 */

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Brain,
  Code2,
  Sparkles,
  Terminal,
  Eye,
  ChevronDown,
  ChevronRight,
  FileCode,
  Check,
  X,
  Clock,
  Zap,
  Play,
  Pause,
  RotateCcw,
  Timer,
  BarChart3,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface SOLOStep {
  id: string;
  type: 'planning' | 'analysis' | 'coding' | 'testing' | 'deployment' | 'verification';
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: string;
  details?: string;
  startTime?: number;
  endTime?: number;
  progress?: number;
  artifacts?: StepArtifact[];
}

export interface StepArtifact {
  type: 'file' | 'command' | 'test' | 'log';
  name: string;
  content?: string;
  path?: string;
  status: 'success' | 'error' | 'warning';
}

export interface TodoItem {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  priority?: 'high' | 'medium' | 'low';
  dependsOn?: string[];
}

interface SOLOProgressPanelProps {
  steps: SOLOStep[];
  todoItems: TodoItem[];
  currentStepIndex: number;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  progressMessage?: string;
  thinking?: string;
  metadata?: {
    totalFilesGenerated: number;
    totalCommandsExecuted: number;
    estimatedTokensUsed: number;
    startTime?: number;
    endTime?: number;
    duration?: number;
  };
  onStepClick?: (step: SOLOStep) => void;
  className?: string;
}

const stepIcons: Record<string, React.ElementType> = {
  analysis: Brain,
  planning: Sparkles,
  coding: Code2,
  testing: CheckCircle2,
  verification: Eye,
  deployment: Terminal,
};

const stepLabels: Record<string, string> = {
  analysis: '需求分析',
  planning: '任务规划',
  coding: '代码生成',
  testing: '测试验证',
  verification: '结果验证',
  deployment: '部署发布',
};

const StepCard: React.FC<{
  step: SOLOStep;
  isActive: boolean;
  isLast: boolean;
  onClick: () => void;
}> = ({ step, isActive, isLast, onClick }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const Icon = stepIcons[step.type] || Code2;

  const getStatusColor = () => {
    switch (step.status) {
      case 'in_progress':
        return 'border-blue-500 bg-blue-500/5';
      case 'completed':
        return 'border-green-500/50 bg-green-500/5';
      case 'failed':
        return 'border-red-500/50 bg-red-500/5';
      default:
        return 'border-border bg-muted/30';
    }
  };

  const getStatusIcon = () => {
    switch (step.status) {
      case 'in_progress':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30" />;
    }
  };

  const formatDuration = () => {
    if (!step.startTime) return '';
    const end = step.endTime || Date.now();
    const duration = end - step.startTime;
    if (duration < 1000) return `${duration}ms`;
    if (duration < 60000) return `${Math.floor(duration / 1000)}s`;
    return `${Math.floor(duration / 60000)}m ${Math.floor((duration % 60000) / 1000)}s`;
  };

  return (
    <div className="relative">
      {/* Timeline connector */}
      {!isLast && (
        <div
          className={cn(
            'absolute left-5 top-10 w-0.5 h-full -mb-4',
            step.status === 'completed' ? 'bg-green-500/30' : 'bg-border'
          )}
        />
      )}

      <div
        className={cn(
          'relative flex gap-4 p-4 rounded-xl border-2 transition-all cursor-pointer',
          getStatusColor(),
          isActive && 'ring-2 ring-primary/20',
          'hover:shadow-md'
        )}
        onClick={() => {
          onClick();
          setIsExpanded(!isExpanded);
        }}
      >
        {/* Status indicator */}
        <div className="flex-shrink-0">
          <div
            className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center',
              step.status === 'in_progress' && 'bg-blue-500/20',
              step.status === 'completed' && 'bg-green-500/20',
              step.status === 'failed' && 'bg-red-500/20',
              step.status === 'pending' && 'bg-muted'
            )}
          >
            {getStatusIcon()}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-sm">{stepLabels[step.type] || step.type}</h4>
              <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
            </div>
            <div className="flex items-center gap-2">
              {step.startTime && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Timer className="w-3 h-3" />
                  {formatDuration()}
                </span>
              )}
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
          </div>

          {/* Progress bar for in-progress step */}
          {step.status === 'in_progress' && step.progress !== undefined && (
            <div className="mt-3">
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${step.progress}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground mt-1">{step.progress}%</span>
            </div>
          )}

          {/* Expanded details */}
          {isExpanded && (step.result || step.details || step.artifacts) && (
            <div className="mt-4 pt-4 border-t border-border/50 space-y-3">
              {step.result && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">执行结果</div>
                  <div className="text-sm bg-muted/50 p-3 rounded-lg whitespace-pre-wrap">
                    {step.result}
                  </div>
                </div>
              )}

              {step.details && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">详细信息</div>
                  <div className="text-sm bg-muted/50 p-3 rounded-lg whitespace-pre-wrap">
                    {step.details}
                  </div>
                </div>
              )}

              {step.artifacts && step.artifacts.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-2">产出物</div>
                  <div className="space-y-1">
                    {step.artifacts.map((artifact, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          'flex items-center gap-2 text-sm p-2 rounded',
                          artifact.status === 'success' && 'bg-green-500/10 text-green-700',
                          artifact.status === 'error' && 'bg-red-500/10 text-red-700',
                          artifact.status === 'warning' && 'bg-amber-500/10 text-amber-700'
                        )}
                      >
                        {artifact.type === 'file' && <FileCode className="w-4 h-4" />}
                        {artifact.type === 'command' && <Terminal className="w-4 h-4" />}
                        {artifact.type === 'test' && <CheckCircle2 className="w-4 h-4" />}
                        {artifact.type === 'log' && <Terminal className="w-4 h-4" />}
                        <span className="flex-1 truncate">{artifact.name}</span>
                        {artifact.path && (
                          <span className="text-xs text-muted-foreground">{artifact.path}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const TodoList: React.FC<{ items: TodoItem[] }> = ({ items }) => {
  if (!items || items.length === 0) return null;

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-500';
      case 'medium':
        return 'text-amber-500';
      case 'low':
        return 'text-blue-500';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <div className="bg-muted/30 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium text-sm">任务清单</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {items.filter((i) => i.status === 'completed').length}/{items.length}
        </span>
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              'flex items-center gap-3 p-2 rounded-lg transition-colors',
              item.status === 'in_progress' && 'bg-blue-500/5',
              item.status === 'completed' && 'opacity-60'
            )}
          >
            <div className="flex-shrink-0">
              {item.status === 'completed' ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : item.status === 'in_progress' ? (
                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
              ) : item.status === 'failed' ? (
                <X className="w-4 h-4 text-red-500" />
              ) : (
                <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30" />
              )}
            </div>
            <span
              className={cn(
                'flex-1 text-sm',
                item.status === 'completed' && 'line-through text-muted-foreground'
              )}
            >
              {item.content}
            </span>
            {item.priority && (
              <span className={cn('text-xs', getPriorityColor(item.priority))}>
                {item.priority === 'high' && '高'}
                {item.priority === 'medium' && '中'}
                {item.priority === 'low' && '低'}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const StatsPanel: React.FC<{ metadata?: SOLOProgressPanelProps['metadata'] }> = ({ metadata }) => {
  if (!metadata) return null;

  const formatDuration = (ms?: number) => {
    if (!ms) return '-';
    if (ms < 60000) return `${Math.floor(ms / 1000)}s`;
    if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
    return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toString();
  };

  return (
    <div className="grid grid-cols-4 gap-3">
      <div className="bg-muted/30 rounded-lg p-3 text-center">
        <div className="text-lg font-semibold">{metadata.totalFilesGenerated}</div>
        <div className="text-xs text-muted-foreground">生成文件</div>
      </div>
      <div className="bg-muted/30 rounded-lg p-3 text-center">
        <div className="text-lg font-semibold">{metadata.totalCommandsExecuted}</div>
        <div className="text-xs text-muted-foreground">执行命令</div>
      </div>
      <div className="bg-muted/30 rounded-lg p-3 text-center">
        <div className="text-lg font-semibold">{formatNumber(metadata.estimatedTokensUsed)}</div>
        <div className="text-xs text-muted-foreground">Token 消耗</div>
      </div>
      <div className="bg-muted/30 rounded-lg p-3 text-center">
        <div className="text-lg font-semibold">{formatDuration(metadata.duration)}</div>
        <div className="text-xs text-muted-foreground">运行时间</div>
      </div>
    </div>
  );
};

export const SOLOProgressPanel: React.FC<SOLOProgressPanelProps> = ({
  steps,
  todoItems,
  currentStepIndex,
  status,
  progressMessage,
  thinking,
  metadata,
  onStepClick,
  className,
}) => {
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

  const completedSteps = steps.filter((s) => s.status === 'completed').length;
  const totalSteps = steps.length;
  const overallProgress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  const getStatusDisplay = () => {
    switch (status) {
      case 'running':
        return { icon: Play, text: '运行中', color: 'text-blue-600 bg-blue-500/10' };
      case 'paused':
        return { icon: Pause, text: '已暂停', color: 'text-amber-600 bg-amber-500/10' };
      case 'completed':
        return { icon: CheckCircle2, text: '已完成', color: 'text-green-600 bg-green-500/10' };
      case 'failed':
        return { icon: AlertCircle, text: '失败', color: 'text-red-600 bg-red-500/10' };
      default:
        return { icon: Clock, text: '等待中', color: 'text-muted-foreground bg-muted' };
    }
  };

  const statusDisplay = getStatusDisplay();
  const StatusIcon = statusDisplay.icon;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Overall Progress */}
      <div className="bg-muted/30 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', statusDisplay.color)}>
              <StatusIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="font-medium">{statusDisplay.text}</div>
              <div className="text-xs text-muted-foreground">
                {completedSteps}/{totalSteps} 步骤完成
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{Math.round(overallProgress)}%</div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              status === 'running' && 'bg-blue-500',
              status === 'completed' && 'bg-green-500',
              status === 'failed' && 'bg-red-500',
              status === 'paused' && 'bg-amber-500'
            )}
            style={{ width: `${overallProgress}%` }}
          />
        </div>

        {/* Progress message */}
        {progressMessage && (
          <div className="mt-3 flex items-center gap-2 text-sm text-blue-600 bg-blue-500/5 p-2 rounded-lg">
            <Loader2 className="w-4 h-4 animate-spin" />
            {progressMessage}
          </div>
        )}
      </div>

      {/* Thinking display */}
      {thinking && status === 'running' && (
        <div className="bg-muted/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Brain className="w-4 h-4 text-primary" />
            <span className="font-medium text-sm">思考中</span>
          </div>
          <ScrollArea className="h-24">
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{thinking}</p>
          </ScrollArea>
        </div>
      )}

      {/* Stats */}
      {metadata && <StatsPanel metadata={metadata} />}

      {/* Steps */}
      {steps.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
            执行步骤
          </div>
          <div className="space-y-3">
            {steps.map((step, index) => (
              <StepCard
                key={step.id}
                step={step}
                isActive={index === currentStepIndex}
                isLast={index === steps.length - 1}
                onClick={() => {
                  setSelectedStepId(step.id);
                  onStepClick?.(step);
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Todo List */}
      <TodoList items={todoItems} />
    </div>
  );
};

export default SOLOProgressPanel;
