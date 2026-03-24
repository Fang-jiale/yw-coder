/**
 * ChatPanel 组件 - 重构版本
 * 统一流式消息展示与历史记录保存逻辑
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useUnifiedAgentStore, setupUnifiedAgentEventListeners } from '@/store/unifiedAgentStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useChat, useAutoScroll, useTypewriter } from './hooks';
import { ChatEmptyState } from '@/components/ui/EmptyState';
import {
  MessageList,
  MessageItem,
  MessageInput,
  SlashCommandMenu,
  ErrorBanner,
} from './components';
import { StreamingIndicator } from './components/StatusBar/StreamingIndicator';
import { DiffViewer } from '../DiffViewer/DiffViewer';
import { AgentStep, AgentMessage, AgentToolCall } from '../../../shared/agentTypes';
import type { ExecutionPlan, AgentQuestion } from '@shared/types';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  thinking?: string;
  toolCalls?: AgentToolCall[];
  timestamp: number;
  steps?: AgentStep[];
  isStreaming?: boolean;
  isTyping?: boolean;
  displayContent?: string;
  // 流式内容块，用于按时间分块展示
  contentBlocks?: Array<{ type: 'text' | 'thinking' | 'question' | 'todo'; content?: string; thinking?: string; question?: any; todoItems?: any[]; timestamp: number }>;
  // 执行计划（用于 SoloCoder 模式）
  executionPlan?: ExecutionPlan;
  // agent 问题（通过 onQuestion 事件添加）
  agentQuestions?: AgentQuestion[];
}

interface FileEditInfo {
  id: string;
  filePath: string;
  status: 'editing' | 'completed' | 'error';
  content?: string;
  progress?: number;
  startTime?: number;
  endTime?: number;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

interface ChatPanelProps {
  onOpenSettings?: () => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ onOpenSettings }) => {
  const {
    tasks,
    activeTaskId,
    streamingMessage,
    streamingContentBlocks,
    streamingThinking,
    streamingToolCalls,
    isProcessing,
    setIsProcessing,
    sendMessage,
    createTask,
    stopTask,
    configs,
    activeConfigId,
    addMessage,
    clearTaskMessages,
    answerQuestion,
  } = useUnifiedAgentStore();

  const { workspacePath } = useWorkspaceStore();
  const { aiConfigs, activeConfigId: activeAIConfigId, setActiveConfigId } = useSettingsStore();

  const [input, setInput] = useState('');
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [expandedThinkingMsgs, setExpandedThinkingMsgs] = useState<Set<string>>(new Set());
  const [expandedToolCalls, setExpandedToolCalls] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [sendRetryCount, setSendRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [processingStartTime, setProcessingStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isTyping, setIsTyping] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { sendMessage: chatSendMessage, isSending } = useChat();

  // 使用增强的 useAutoScroll hook
  const {
    scrollRef,
    shouldAutoScroll,
    scrollToBottom,
    scrollToBottomWithAnimation,
    isAtBottom,
    hasNewMessages,
    scrollDirection,
    markNewMessages,
    clearNewMessages,
  } = useAutoScroll({
    threshold: 100,
    smooth: true,
    enableSmartScroll: true,
  });

  useEffect(() => {
    setupUnifiedAgentEventListeners();
  }, []);

  // 统一的消息展示逻辑：从历史记录构建展示消息列表
  const displayMessages = useMemo<DisplayMessage[]>(() => {
    const messages: DisplayMessage[] = [];
    const task = tasks.find((t) => t.id === activeTaskId);

    if (!task) return messages;

    // 从历史记录构建消息列表
    task.messages.forEach((msg) => {
      console.log('[displayMessages] Building message:', msg.id, 'agentQuestions:', msg.agentQuestions?.length);
      messages.push({
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        thinking: msg.thinking,
        toolCalls: msg.toolCalls,
        timestamp: msg.timestamp,
        steps: task.steps,
        isStreaming: false,
        isTyping: false,
        contentBlocks: msg.contentBlocks,
        executionPlan: msg.executionPlan,
        agentQuestions: msg.agentQuestions,
      });
    });

    // 如果有流式内容，更新最后一条AI消息或添加新的流式消息
    if (isProcessing) {
      const lastMessage = messages[messages.length - 1];

      // 如果最后一条是AI消息且正在流式输出，使用 streamingMessage 覆盖内容
        if (lastMessage && lastMessage.role === 'assistant') {
          // 只在 streamingMessage 有值时才覆盖内容，避免覆盖已保存的历史消息
          if (streamingMessage) {
            lastMessage.content = streamingMessage;
          }
          if (streamingThinking) {
            lastMessage.thinking = streamingThinking;
          }
          if (streamingToolCalls.length > 0) {
            lastMessage.toolCalls = streamingToolCalls;
          }
          lastMessage.isStreaming = true;
          lastMessage.isTyping = isTyping;
          // 添加流式内容块用于分块展示
          if (streamingContentBlocks.length > 0) {
            lastMessage.contentBlocks = streamingContentBlocks;
          }
          // 保留 agentQuestions（通过 onQuestion 事件添加的问题）
          // 注意：agentQuestions 已经在构建 lastMessage 时从 msg.agentQuestions 获取了
        } else if (streamingMessage || streamingThinking || streamingToolCalls.length > 0) {
        // 否则添加一个新的流式消息
        messages.push({
          id: 'streaming',
          role: 'assistant',
          content: streamingMessage || '',
          thinking: streamingThinking,
          toolCalls: streamingToolCalls,
          timestamp: Date.now(),
          steps: task.steps,
          isStreaming: true,
          isTyping: isTyping,
          contentBlocks: streamingContentBlocks.length > 0 ? streamingContentBlocks : undefined,
        });
      }
    }

    return messages;
  }, [tasks, activeTaskId, streamingMessage, streamingContentBlocks, streamingThinking, streamingToolCalls, isProcessing, isTyping]);

  // 计算流式进度（基于内容长度估算）
  const streamingProgress = useMemo(() => {
    if (!isProcessing || !streamingMessage) return 0;
    // 简单估算：假设平均响应长度为 2000 字符
    const estimatedTotal = 2000;
    const progress = Math.min((streamingMessage.length / estimatedTotal) * 100, 99);
    return progress;
  }, [isProcessing, streamingMessage]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isProcessing) {
      if (!processingStartTime) {
        setProcessingStartTime(Date.now());
      }
      interval = setInterval(() => {
        if (processingStartTime) {
          setElapsedTime(Date.now() - processingStartTime);
        }
      }, 100);
    } else {
      setProcessingStartTime(null);
      setElapsedTime(0);
      setIsTyping(false);
    }
    return () => clearInterval(interval);
  }, [isProcessing, processingStartTime]);

  // 流式状态管理：检测流式开始和结束
  useEffect(() => {
    if (isProcessing && streamingMessage) {
      // 流式开始，设置 isTyping
      setIsTyping(true);
    } else if (!isProcessing) {
      // 流式结束，清除 isTyping
      setIsTyping(false);
    }
  }, [isProcessing, streamingMessage]);

  // 新消息检测：当有新消息时标记
  useEffect(() => {
    if (displayMessages.length > 0 && isProcessing) {
      const lastMessage = displayMessages[displayMessages.length - 1];
      if (lastMessage.isStreaming && !isAtBottom) {
        markNewMessages();
      }
    }
  }, [displayMessages, isProcessing, isAtBottom, markNewMessages]);

  // 流式消息自动滚动到底部（仅在用户未手动向上滚动时）
  useEffect(() => {
    if (isProcessing && (streamingMessage || streamingContentBlocks.length > 0) && shouldAutoScroll) {
      scrollToBottom();
    }
  }, [isProcessing, streamingMessage, streamingContentBlocks, scrollToBottom, shouldAutoScroll]);

  const wasProcessingRef = useRef(false);
  useEffect(() => {
    if (wasProcessingRef.current && !isProcessing) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
    wasProcessingRef.current = isProcessing;
  }, [isProcessing]);

  const handleSlashCommand = useCallback((cmd: string) => {
    const trimmed = cmd.trim().toLowerCase();
    if (trimmed === '/clear') {
      if (activeTaskId) {
        clearTaskMessages(activeTaskId);
      }
      setInput('');
      setShowSlashMenu(false);
      return true;
    }
    return false;
  }, [activeTaskId, clearTaskMessages]);

  // 统一的消息发送逻辑
  const handleSend = async (retryContent?: string) => {
    // 如果正在处理，先停止当前任务
    if (isProcessing && !retryContent) {
      if (activeTaskId) {
        await stopTask(activeTaskId);
      }
      return;
    }

    const content = retryContent || input.trim();
    if (!content) return;

    const config = configs.find((c) => c.id === activeConfigId) || configs[0];
    const hasAIConfig = aiConfigs && aiConfigs.length > 0;
    if (!config && !hasAIConfig) {
      setError('请先配置 AI 设置');
      return;
    }

    // 获取当前选择的 AI 配置
    const currentAIConfig = aiConfigs?.find(c => c.id === activeAIConfigId) || aiConfigs?.[0];
    if (!currentAIConfig) {
      setError('请先配置 AI 设置');
      return;
    }

    // 创建或获取任务
    let taskId = activeTaskId;
    if (!taskId) {
      taskId = await createTask(content.slice(0, 20) + (content.length > 20 ? '...' : ''), content);
    }

    if (!taskId) return;

    // 清空输入框
    if (!retryContent) {
      setInput('');
      if (inputRef.current) {
        inputRef.current.style.height = '56px';
      }
    }

    // 发送消息（带重试逻辑）
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        setSendRetryCount(attempt);
        if (attempt > 0) {
          setIsRetrying(true);
        }
        await sendMessage(taskId, content, currentAIConfig);
        setSendRetryCount(0);
        setIsRetrying(false);
        return;
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`Send message attempt ${attempt + 1} failed:`, lastError);

        if (attempt < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    setIsRetrying(false);
    setSendRetryCount(0);
    
    // 显示友好的错误信息
    const errorMsg = lastError?.message || '未知错误';
    let friendlyError = '发送失败';
    if (errorMsg.includes('network') || errorMsg.includes('fetch')) {
      friendlyError = '网络错误，请检查网络连接';
    } else if (errorMsg.includes('API') || errorMsg.includes('key')) {
      friendlyError = 'API 配置错误，请检查 API Key';
    } else if (errorMsg.includes('timeout')) {
      friendlyError = '请求超时，请稍后重试';
    }
    setError(`${friendlyError}，已重试 ${maxRetries} 次`);
  };

  // 处理问题回答
  const handleAnswerQuestion = async (taskId: string | null, questionId: string, answer: string) => {
    if (!taskId) return;
    
    try {
      console.log('[handleAnswerQuestion] Answering question:', questionId, 'with:', answer);
      
      // 设置处理状态，通知 UI 任务正在运行
      setIsProcessing(true);
      
      // 调用主进程的 answerQuestion API
      await window.electronAPI?.unifiedAgent?.answerQuestion?.({
        taskId,
        questionId,
        answer,
      });
      
      console.log('[handleAnswerQuestion] Question answered successfully');
    } catch (error) {
      console.error('Failed to answer question:', error);
      setIsProcessing(false);
      setError('回答问题失败');
    }
  };

  const handleInputChange = (value: string) => {
    setInput(value);
    setShowSlashMenu(value.startsWith('/'));
  };

  // 处理带附件的消息发送
  const handleSendWithFiles = async (files?: Array<{id: string, name: string, type: 'image' | 'file', content?: string, size: number}>) => {
    const content = input.trim();
    if (!content && (!files || files.length === 0)) return;

    // 构建消息内容，包含附件信息
    let messageContent = content;
    if (files && files.length > 0) {
      const fileDescriptions = files.map(f => {
        if (f.type === 'image') {
          return `[图片: ${f.name}]`;
        } else {
          return `[文件: ${f.name}${f.content ? `\n\`\`\`\n${f.content}\n\`\`\`` : ''}]`;
        }
      }).join('\n');
      messageContent = content ? `${content}\n\n${fileDescriptions}` : fileDescriptions;
    }

    await handleSend(messageContent);
  };

  const handleAIConfigChange = async (configId: string) => {
    console.log('[ChatPanel] Switching AI config to:', configId);
    await setActiveConfigId(configId);
  };

  const handleToggleThinking = useCallback((msgId: string) => {
    setExpandedThinkingMsgs((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) {
        next.delete(msgId);
      } else {
        next.add(msgId);
      }
      return next;
    });
  }, []);

  const handleToggleToolCall = useCallback((toolCallId: string) => {
    setExpandedToolCalls((prev) => {
      const next = new Set(prev);
      if (next.has(toolCallId)) {
        next.delete(toolCallId);
      } else {
        next.add(toolCallId);
      }
      return next;
    });
  }, []);

  // 统一的消息渲染逻辑
  const renderMessageItem = useCallback((item: DisplayMessage) => {
    return (
      <MessageItem
        key={item.id}
        id={item.id}
        role={item.role}
        content={item.content}
        timestamp={item.timestamp}
        thinking={item.thinking}
        toolCalls={item.toolCalls}
        isStreaming={item.isStreaming}
        isTyping={item.isTyping}
        displayContent={item.displayContent}
        contentBlocks={item.contentBlocks}
        agentQuestions={item.agentQuestions}
        onAnswerQuestion={(questionId, answer) => handleAnswerQuestion(activeTaskId, questionId, answer)}
        onRetry={() => handleSend(item.content)}
        expandedThinking={expandedThinkingMsgs.has(item.id)}
        onToggleThinking={() => handleToggleThinking(item.id)}
        expandedToolCalls={expandedToolCalls}
        onToggleToolCall={handleToggleToolCall}
      />
    );
  }, [expandedThinkingMsgs, expandedToolCalls, handleToggleThinking, handleToggleToolCall, activeTaskId, stopTask]);

  // 获取当前配置
  const currentConfig = configs.find((c) => c.id === activeConfigId);

  // 获取当前 AI 配置的上下文长度
  const currentAIConfig = aiConfigs?.find(c => c.id === activeAIConfigId) || aiConfigs?.[0];
  const contextLength = currentAIConfig?.contextLength || 8000; // 默认 8000 tokens

  // 构建 ContextManager 需要的消息格式
  const contextMessages = useMemo(() => {
    return displayMessages.map(msg => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
    }));
  }, [displayMessages]);

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-background to-muted/5">
      <div ref={scrollRef as React.RefObject<HTMLDivElement>} className="flex-1 overflow-y-auto relative">
        {displayMessages.length === 0 ? (
          <ChatEmptyState />
        ) : (
          <MessageList
            items={displayMessages}
            renderItem={renderMessageItem}
          />
        )}



        {/* 新消息提示按钮 */}
        {hasNewMessages && (
          <button
            onClick={scrollToBottomWithAnimation}
            className={cn(
              'absolute bottom-4 left-1/2 -translate-x-1/2',
              'flex items-center gap-1 px-3 py-1.5',
              'bg-primary text-primary-foreground text-xs font-medium',
              'rounded-full shadow-lg hover:bg-primary/90',
              'transition-all duration-300 animate-in fade-in slide-in-from-bottom-2',
              'new-message-bounce'
            )}
          >
            <span>新消息</span>
            <ChevronDown className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* 流式状态指示器 - 移到底部 */}
      <StreamingIndicator
        isStreaming={isProcessing}
        isTyping={isTyping}
        isWaiting={isProcessing && !streamingMessage}
        progress={streamingProgress}
        elapsedTime={elapsedTime}
        thinkingContent={streamingThinking}
        onStop={() => activeTaskId && stopTask(activeTaskId)}
      />

      <ErrorBanner
        error={error}
        onClose={() => setError(null)}
      />

      <div className="border-t border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <SlashCommandMenu
            isOpen={showSlashMenu}
            onClose={() => setShowSlashMenu(false)}
            onSelect={(command) => {
              setInput(command.action);
              setShowSlashMenu(false);
              inputRef.current?.focus();
            }}
          />

          <MessageInput
            value={input}
            onChange={handleInputChange}
            onSend={handleSendWithFiles}
            onStop={isProcessing ? () => activeTaskId && stopTask(activeTaskId) : undefined}
            isProcessing={isProcessing}
            isSending={isSending}
            placeholder="输入消息，或输入 / 查看命令..."
            aiConfigs={aiConfigs || []}
            activeAIConfigId={activeAIConfigId}
            onAIConfigChange={handleAIConfigChange}
            onOpenSettings={onOpenSettings}
            contextMessages={contextMessages}
            contextLength={contextLength}
            systemPrompt={currentConfig?.systemPrompt || ''}
          />
        </div>
      </div>
    </div>
  );
};
