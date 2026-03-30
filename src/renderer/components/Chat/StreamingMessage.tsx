import React, { useMemo, useCallback, memo } from 'react';
import { useUnifiedAgentStore } from '@/store/unifiedAgentStore';
import { useShallow } from 'zustand/react/shallow';
import { cn } from '@/lib/utils';
import { Brain, ChevronDown, ListTodo, Circle, Loader2, CheckCircle2, XCircle, HelpCircle } from 'lucide-react';
import { StreamEventItem, TodoItem } from '../../../shared/types';
import { ResultCard as ResultCardComponent } from './ResultCards/ResultCard';
import { parseContentTags, ContentSegment } from '@/utils/contentParser';
import ReactMarkdown from 'react-markdown';

// 工具调用卡片组件 - 使用 memo 优化
const ToolCallCard = React.memo<{
  toolCall: {
    id: string;
    toolName: string;
    params: Record<string, any>;
    status: 'running' | 'completed' | 'error';
  };
  isExpanded: boolean;
  onToggle: () => void;
}>(({ toolCall, isExpanded, onToggle }) => {
  const statusConfig = {
    running: { color: 'bg-blue-500/5 border-blue-500/20', textColor: 'text-blue-600', label: '执行中' },
    completed: { color: 'bg-green-500/5 border-green-500/20', textColor: 'text-green-600', label: '已完成' },
    error: { color: 'bg-red-500/5 border-red-500/20', textColor: 'text-red-600', label: '失败' },
  };
  const config = statusConfig[toolCall.status] || statusConfig.running;

  return (
    <div className={cn('rounded-lg text-xs border overflow-hidden', config.color)}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-black/5 dark:hover:bg-white/5"
      >
        <div className={cn("w-5 h-5 rounded flex items-center justify-center bg-muted", config.textColor)}>
          {toolCall.status === 'running' ? <Loader2 className="w-3 h-3 animate-spin" /> :
           toolCall.status === 'completed' ? <CheckCircle2 className="w-3 h-3" /> :
           <span className="text-[10px]">!</span>}
        </div>
        <span className={cn("font-medium text-xs", config.textColor)}>{toolCall.toolName || toolCall.id}</span>
        <span className="text-[10px] text-muted-foreground ml-auto">{config.label}</span>
        <ChevronDown className={cn('w-3 h-3 transition-transform', isExpanded && 'rotate-180')} />
      </button>
      {isExpanded && (
        <div className="px-3 py-2 border-t border-border/50 bg-black/5 dark:bg-white/5">
          <pre className="text-[10px] bg-background/80 p-2 rounded overflow-x-auto">
            {JSON.stringify(toolCall.params, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
});
ToolCallCard.displayName = 'ToolCallCard';

// 思考块组件 - 使用 memo 优化
const ThinkingBlock = React.memo<{
  thinking: string;
  isStreaming?: boolean;
}>(({ thinking, isStreaming }) => {
  return (
    <div className="p-3 bg-gradient-to-r from-purple-500/5 to-blue-500/5 rounded-lg text-xs text-muted-foreground border border-purple-500/20 font-mono">
      <div className="flex items-center gap-1.5 mb-2 text-purple-600">
        <Brain className="w-3 h-3" />
        <span className="font-medium">思考中...</span>
        {isStreaming && (
          <div className="flex items-center gap-1 ml-auto">
            <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse" />
            <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
          </div>
        )}
      </div>
      <pre className="whitespace-pre-wrap max-h-48 overflow-y-auto scrollbar-thin">{thinking}</pre>
    </div>
  );
});
ThinkingBlock.displayName = 'ThinkingBlock';

// 流式内容渲染组件 - 使用 memo 优化，支持 Markdown
const StreamingContent = React.memo<{
  content: string;
}>(({ content }) => {
  return (
    <div className="relative">
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
      <span className="inline-block w-2 h-4 bg-primary ml-0.5 animate-pulse" />
    </div>
  );
});
StreamingContent.displayName = 'StreamingContent';

// Content Item 组件 - 缓存 parseContentTags 结果
const ContentItem = React.memo<{
  item: Extract<StreamEventItem, { type: 'content' }>;
  isLastItem: boolean;
  onAnswerQuestion?: (questionId: string, answer: string) => void;
}>(({ item, isLastItem, onAnswerQuestion }) => {
  // 缓存 parseContentTags 结果，只在 item.text 变化时重新解析
  const segments = useMemo(() => parseContentTags(item.text), [item.text]);
  
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      {segments.map((segment, segIndex) => {
        switch (segment.type) {
          case 'think':
            return (
              <ThinkingBlock
                key={`think-${segIndex}`}
                thinking={segment.content}
                isStreaming={isLastItem && segIndex === segments.length - 1}
              />
            );
          case 'todo':
            return <TodoList key={`todo-${segIndex}`} items={segment.items} />;
          case 'question':
            return (
              <QuestionBlock
                key={`question-${segIndex}`}
                question={segment.question}
                options={segment.options}
                questionId={segment.questionId}
                onAnswer={onAnswerQuestion}
              />
            );
          default:
            return (
              <div key={`text-${segIndex}`}>
                {isLastItem && segIndex === segments.length - 1 ? (
                  <StreamingContent content={segment.content} />
                ) : (
                  <ReactMarkdown>{segment.content}</ReactMarkdown>
                )}
              </div>
            );
        }
      })}
    </div>
  );
});
ContentItem.displayName = 'ContentItem';

// Todo 列表组件 - 使用 memo 优化
const TodoList = React.memo<{
  items: TodoItem[];
}>(({ items }) => {
  return (
    <div className="my-3 p-3 bg-muted/50 rounded-lg border">
      <div className="flex items-center gap-2 text-xs font-medium mb-2">
        <ListTodo className="w-4 h-4 text-primary" />
        <span>任务进度</span>
        <span className="text-muted-foreground/60">({items.length})</span>
      </div>
      <div className="space-y-1.5">
        {items.map((todo) => (
          <div
            key={todo.id}
            className={cn(
              "flex items-center gap-2 px-2 py-1.5 rounded-md text-xs",
              todo.status === 'pending' && "bg-muted/50 text-muted-foreground border",
              todo.status === 'in_progress' && "bg-blue-500/10 text-blue-600 border border-blue-500/20",
              todo.status === 'completed' && "bg-green-500/10 text-green-600 line-through",
              todo.status === 'failed' && "bg-red-500/10 text-red-600 border border-red-500/20"
            )}
          >
            {todo.status === 'pending' && <Circle className="w-3 h-3" />}
            {todo.status === 'in_progress' && <Loader2 className="w-3 h-3 animate-spin" />}
            {todo.status === 'completed' && <CheckCircle2 className="w-3 h-3" />}
            {todo.status === 'failed' && <XCircle className="w-3 h-3" />}
            <span className="flex-1">{todo.content}</span>
          </div>
        ))}
      </div>
    </div>
  );
});
TodoList.displayName = 'TodoList';

// Question 组件 - 使用 memo 优化
const QuestionBlock = React.memo<{
  question: string;
  options?: Array<{id: string; label: string; value: string}>;
  questionId: string;
  onAnswer?: (questionId: string, answer: string) => void;
}>(({ question, options, questionId, onAnswer }) => {
  return (
    <div className="my-3 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
      <div className="flex items-center gap-2 mb-2 text-xs font-medium text-amber-600">
        <HelpCircle className="w-3.5 h-3.5" />
        <span>需要您的回答</span>
      </div>
      <p className="text-sm text-foreground mb-3">{question}</p>
      {options && options.length > 0 && onAnswer && (
        <div className="flex flex-wrap gap-2">
          {options.map((option) => (
            <button
              key={option.id}
              onClick={() => onAnswer(questionId, option.value)}
              className="px-3 py-2 text-sm bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-lg transition-colors"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
QuestionBlock.displayName = 'QuestionBlock';

interface StreamingMessageProps {
  isSoloMode?: boolean;
  onCopy: (code: string) => void;
  copiedCode: string | null;
  expandedThinkingMsgs: Set<string>;
  expandedToolCalls: Set<string>;
  onToggleThinking: (msgId: string) => void;
  onToggleToolCall: (toolCallId: string) => void;
  onAnswerQuestion?: (questionId: string, answer: string) => void;
  messageId: string;
}

export const StreamingMessage: React.FC<StreamingMessageProps> = React.memo(({
  isSoloMode,
  expandedThinkingMsgs,
  expandedToolCalls,
  onToggleThinking,
  onToggleToolCall,
  onAnswerQuestion,
  messageId,
}) => {
  // 只订阅 streamingItems，移除对 streamingMessage 和 streamingThinking 的订阅
  // 这是关键优化：减少重复状态订阅
  const streamingItems = useUnifiedAgentStore(state => state.streamingItems);
  const resultCards = useUnifiedAgentStore(state => state.resultCards);
  const taskProgress = useUnifiedAgentStore(state => state.taskProgress);
  const collapsedThinking = useUnifiedAgentStore(state => state.collapsedThinking);

  // 缓存排序结果 - 使用更精确的依赖项避免不必要的重新排序
  const sortedItems = useMemo(() => {
    if (!streamingItems || streamingItems.length === 0) return [];
    return [...streamingItems].sort((a, b) => a.seq - b.seq);
  }, [streamingItems?.length, streamingItems?.[streamingItems.length - 1]?.id]);

  // 渲染内容 - 使用 useMemo 缓存
  const contentElements = useMemo(() => {
    return sortedItems.map((item, index) => {
      const isLastItem = index === sortedItems.length - 1;

      switch (item.type) {
        case 'thinking':
          return (
            <div key={item.id} className="mb-3">
              {!collapsedThinking && (
                <ThinkingBlock
                  thinking={item.text}
                  isStreaming={isLastItem}
                />
              )}
            </div>
          );

        case 'tool':
          return (
            <div key={item.id} className="mb-2">
              <ToolCallCard
                toolCall={item}
                isExpanded={expandedToolCalls.has(item.toolCallId)}
                onToggle={() => onToggleToolCall(item.toolCallId)}
              />
            </div>
          );

        case 'todo':
          return <TodoList key={item.id} items={item.items} />;

        case 'question':
          return (
            <QuestionBlock
              key={item.id}
              question={item.question}
              options={item.options}
              questionId={item.questionId}
              onAnswer={onAnswerQuestion}
            />
          );

        case 'content':
          return (
            <ContentItem
              key={item.id}
              item={item}
              isLastItem={isLastItem}
              onAnswerQuestion={onAnswerQuestion}
            />
          );

        default:
          return null;
      }
    });
  }, [sortedItems, collapsedThinking, expandedToolCalls, onToggleToolCall, onAnswerQuestion, messageId]);

  return (
    <div className="px-4 py-3">
      {/* AI Message Header */}
      <div className="flex items-center gap-2 mb-2">
        <div className={cn(
          'w-6 h-6 rounded-lg flex items-center justify-center ring-1',
          isSoloMode ? 'bg-gradient-to-br from-amber-500/20 to-amber-500/5 ring-amber-500/20' : 'bg-gradient-to-br from-primary/20 to-primary/5 ring-primary/20'
        )}>
          {isSoloMode ? <span className="text-amber-500 text-xs">S</span> : <span className="text-primary text-xs">AI</span>}
        </div>
        <span className="text-xs font-medium text-muted-foreground">
          {isSoloMode ? 'SOLO Coder' : 'AI 助手'}
        </span>
        <span className="text-xs text-muted-foreground/60">
          {new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* Result Cards */}
      {resultCards && resultCards.length > 0 && (
        <div className="mb-4 space-y-2">
          {resultCards.map((card, index) => (
            <ResultCardComponent
              key={`result-${index}`}
              title={card.title}
              status={card.status}
              description={card.description}
              timestamp={card.timestamp}
            />
          ))}
        </div>
      )}

      {/* Task Progress */}
      {taskProgress && (
        <div className="my-3 p-3 bg-muted/50 rounded-lg border">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs font-medium">
              <ListTodo className="w-4 h-4 text-primary" />
              <span>任务进度</span>
            </div>
            {taskProgress.currentStep !== undefined && taskProgress.totalSteps !== undefined && (
              <span className="text-xs text-muted-foreground">
                {taskProgress.currentStep}/{taskProgress.totalSteps}
              </span>
            )}
          </div>
          {taskProgress.totalSteps !== undefined && taskProgress.totalSteps > 0 && (
            <div className="w-full h-1.5 bg-muted rounded-full mb-2 overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${Math.round((taskProgress.currentStep / taskProgress.totalSteps) * 100)}%` }}
              />
            </div>
          )}
          {taskProgress.message && (
            <p className="text-xs text-muted-foreground">{taskProgress.message}</p>
          )}
        </div>
      )}

      {/* Streaming Items */}
      {contentElements.length > 0 ? (
        <div className="space-y-2">
          {contentElements}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>准备中...</span>
        </div>
      )}
    </div>
  );
});

StreamingMessage.displayName = 'StreamingMessage';
