/**
 * MessageItem 组件
 * 简洁的消息展示，支持打字机效果和流式优化
 * 按时间顺序渲染内容块
 */

import React, { useMemo } from 'react';
import { Copy, Check, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { MarkdownRenderer } from '../Content/MarkdownRenderer';
import { ThinkingBlock } from '../Content/ThinkingBlock';
import { ToolCallCard } from '../Content/ToolCallCard';
import { TodoList } from '../Content/TodoList';
import { QuestionCard } from '../Content/QuestionCard';
import { parseMessage, parseContentBlocks, ContentBlock, TimestampedToolCall } from '../../utils/messageParser';
import type { AgentToolCall, TodoItem } from '@shared/agentTypes';
import type { AgentQuestion } from '@shared/types';

interface MessageItemProps {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  thinking?: string;
  toolCalls?: AgentToolCall[];
  isStreaming?: boolean;
  isTyping?: boolean;
  displayContent?: string;
  onCopy?: (code: string) => void;
  onRetry?: () => void;
  showActions?: boolean;
  expandedThinking?: boolean;
  onToggleThinking?: () => void;
  expandedToolCalls?: Set<string>;
  onToggleToolCall?: (toolCallId: string) => void;
  // 流式内容块，用于按时间分块展示
  contentBlocks?: Array<{ type: 'text' | 'thinking' | 'question' | 'todo'; content?: string; timestamp: number; todoItems?: TodoItem[]; question?: AgentQuestion }>;
  // agent 问题（通过 onQuestion 事件添加）
  agentQuestions?: Array<AgentQuestion & { timestamp?: number }>;
  // 回答问题的回调
  onAnswerQuestion?: (questionId: string, answer: string) => void;
}

/**
 * 打字机光标组件
 * 显示闪烁光标效果
 */
const TypewriterCursor: React.FC = () => {
  return (
    <span
      className="inline-block w-[2px] h-[1.2em] bg-primary ml-0.5 align-middle"
      style={{
        animation: 'cursor-blink 1s step-end infinite',
      }}
    />
  );
};

/**
 * 流式完成状态指示器
 * 显示小勾图标表示流式传输完成
 */
const StreamingCompleteIndicator: React.FC = () => {
  return (
    <span className="inline-flex items-center gap-1 ml-2 text-xs text-green-500 animate-in fade-in duration-300">
      <Check className="w-3 h-3" />
      <span>完成</span>
    </span>
  );
};

export const MessageItem: React.FC<MessageItemProps> = ({
  id,
  role,
  content,
  thinking,
  toolCalls,
  isStreaming = false,
  isTyping = false,
  displayContent,
  onCopy,
  onRetry,
  showActions = true,
  expandedThinking = false,
  onToggleThinking,
  expandedToolCalls = new Set(),
  onToggleToolCall,
  contentBlocks,
  agentQuestions = [],
  onAnswerQuestion,
}) => {
  const [copiedCode, setCopiedCode] = React.useState<string | null>(null);

  const parsedContent = useMemo(() => parseMessage(content), [content]);

  // 打字机效果显示的内容
  const displayParsedContent = useMemo(() => {
    if (displayContent) {
      return parseMessage(displayContent);
    }
    return parsedContent;
  }, [displayContent, parsedContent]);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCode(text);
      setTimeout(() => setCopiedCode(null), 2000);
      onCopy?.(text);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const isUser = role === 'user';

  // 判断是否显示打字机效果
  const showTypewriter = isStreaming && isTyping;

  // 构建渲染项：按时间戳排序
  const renderItems = useMemo(() => {
    const allItems: Array<{
      type: 'content' | 'tool_call';
      block?: ContentBlock;
      call?: AgentToolCall;
      key: string;
      timestamp: number;
    }> = [];

    // 1. 如果有保存的 contentBlocks（包含实际时间戳），直接使用
    if (contentBlocks && contentBlocks.length > 0) {
      contentBlocks.forEach((block, index) => {
        if (block.type === 'thinking') return; // 跳过思考内容

        // 处理 todo 类型
        if (block.type === 'todo' && block.todoItems) {
          allItems.push({
            type: 'content',
            block: {
              type: 'todo',
              todoItems: block.todoItems,
              timestamp: block.timestamp,
            } as ContentBlock,
            key: `content-block-todo-${index}`,
            timestamp: block.timestamp,
          });
          return;
        }

        allItems.push({
          type: 'content',
          block: {
            type: block.type,
            content: block.content,
            timestamp: block.timestamp,
          } as ContentBlock,
          key: `content-block-${index}`,
          timestamp: block.timestamp,
        });
      });
    } else {
      // 2. 否则从 content 解析（用于兼容旧数据）
      const rawContent = displayContent || content;
      if (rawContent) {
        const blocks = parseContentBlocks(rawContent).filter(block => block.type !== 'thinking');
        blocks.forEach((block, index) => {
          allItems.push({
            type: 'content',
            block,
            key: `content-${index}`,
            timestamp: block.timestamp || 0,
          });
        });
      }
    }

    // 3. 添加工具调用
    const toolCallList = toolCalls || [];
    toolCallList.forEach((call, index) => {
      allItems.push({
        type: 'tool_call',
        call,
        key: `tool-${call.id || index}`,
        timestamp: (call as TimestampedToolCall).timestamp || 0,
      });
    });

    // 4. 添加 agent 问题
    console.log('[MessageItem] agentQuestions:', agentQuestions?.length, agentQuestions);
    agentQuestions.forEach((question, index) => {
      console.log('[MessageItem] Adding question:', question.id, question.question);
      allItems.push({
        type: 'content',
        block: {
          type: 'question',
          question,
          timestamp: question.timestamp || Date.now() + index,
        } as ContentBlock,
        key: `agent-question-${question.id || index}`,
        timestamp: question.timestamp || Date.now() + index,
      });
    });

    // 5. 按时间戳排序
    allItems.sort((a, b) => a.timestamp - b.timestamp);

    return allItems;
  }, [isStreaming, content, displayContent, toolCalls, contentBlocks, agentQuestions]);

  return (
    <div
      className={cn(
        'group animate-in fade-in slide-in-from-bottom-2 duration-300 w-full py-1',
        isUser ? 'flex justify-end' : 'flex justify-start'
      )}
    >
      <div className={cn(
        'w-full max-w-[85%] md:max-w-[75%]',
        isUser ? 'flex flex-col items-end' : ''
      )}>
        {/* AI消息 */}
        {!isUser && (
          <div className="space-y-1 w-full">
            <div className={cn(
              "text-sm text-foreground leading-relaxed space-y-3",
              showTypewriter && "transition-opacity duration-150"
            )}>
              {/* 统一渲染逻辑：内容块在前，工具调用在后 */}
              {renderItems.map((item) => {
                // 处理工具调用
                if (item.type === 'tool_call' && item.call) {
                  const toolName = item.call.toolName || (item.call as any).name;

                  // attempt_completion 的 result 包含正文内容，应该作为文本渲染
                  if (toolName === 'attempt_completion' && item.call.result) {
                    const resultText = typeof item.call.result === 'string'
                      ? item.call.result
                      : (item.call.result as any)?.result || JSON.stringify(item.call.result);
                    if (resultText) {
                      return (
                        <div key={item.key} className="prose prose-sm dark:prose-invert max-w-none">
                          <MarkdownRenderer
                            content={resultText}
                            onCopy={handleCopy}
                            copiedCode={copiedCode}
                            isStreaming={false}
                          />
                        </div>
                      );
                    }
                    return null;
                  }

                  const toolCall = item.call!;
                  return (
                    <div key={item.key} className="mb-3">
                      <ToolCallCard
                        toolCall={toolCall}
                        isExpanded={expandedToolCalls.has(toolCall.id)}
                        onToggle={() => onToggleToolCall?.(toolCall.id)}
                      />
                    </div>
                  );
                }

                // 处理内容块
                const contentBlock = item.block;
                if (!contentBlock) {
                  return null;
                }
                switch (contentBlock.type) {
                  case 'thinking':
                    // 思考内容不在这里渲染，只在底部计时组件展示
                    return null;
                  case 'todo':
                    return contentBlock.todoItems && contentBlock.todoItems.length > 0 ? (
                      <div key={item.key} className="mb-3">
                        <TodoList items={contentBlock.todoItems} />
                      </div>
                    ) : null;
                  case 'question':
                    return contentBlock.question ? (
                      <div key={item.key} className="mb-3">
                        <QuestionCard
                          question={contentBlock.question}
                          onAnswer={(value) => onAnswerQuestion?.(contentBlock.question!.id, value)}
                        />
                      </div>
                    ) : null;
                  case 'text':
                  default:
                    return contentBlock.content ? (
                      <div key={item.key} className={cn(
                        "prose prose-sm dark:prose-invert max-w-none",
                        showTypewriter && "animate-in fade-in duration-100"
                      )}>
                        <MarkdownRenderer
                          content={contentBlock.content}
                          onCopy={handleCopy}
                          copiedCode={copiedCode}
                          isStreaming={isStreaming}
                        />
                      </div>
                    ) : null;
                }
              })}

              {/* 打字机光标 */}
              {showTypewriter && <TypewriterCursor />}

              {/* 流式完成指示器 */}
              {!isStreaming && content && (
                <StreamingCompleteIndicator />
              )}
            </div>

            {/* 操作按钮 */}
            {showActions && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground gap-1"
                  onClick={() => handleCopy(content)}
                >
                  {copiedCode ? (
                    <>
                      <Check className="w-3 h-3 text-green-500" />
                      <span>已复制</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>复制</span>
                    </>
                  )}
                </Button>

                {onRetry && !isStreaming && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground gap-1"
                    onClick={onRetry}
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>重试</span>
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {/* 用户消息 */}
        {isUser && (
          <div className="rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 px-4 py-2.5 shadow-sm">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <MarkdownRenderer
                content={parsedContent.cleanedContent || content}
                onCopy={handleCopy}
                copiedCode={copiedCode}
                isStreaming={false}
              />
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

export default MessageItem;
