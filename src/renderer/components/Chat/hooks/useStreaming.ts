/**
 * useStreaming Hook
 * 处理流式消息的优化 Hook
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useTypewriter } from './useTypewriter';

export interface StreamChunk {
  type: 'content' | 'thinking' | 'tool_start' | 'tool_end' | 'done' | 'error';
  content?: string;
  toolCallId?: string;
  toolName?: string;
  toolParams?: Record<string, any>;
  toolResult?: any;
  error?: string;
}

interface UseStreamingOptions {
  onChunk?: (chunk: StreamChunk) => void;
  onComplete?: () => void;
  onError?: (error: string) => void;
  throttleMs?: number;
  typingMode?: 'char' | 'word';
  typingSpeed?: number;
  enableTypewriter?: boolean;
}

interface UseStreamingReturn {
  content: string;
  displayContent: string;
  thinking: string;
  isStreaming: boolean;
  isTyping: boolean;
  isComplete: boolean;
  toolCalls: Array<{
    id: string;
    toolName: string;
    params: Record<string, any>;
    status: 'running' | 'completed' | 'error';
    result?: any;
  }>;
  appendContent: (text: string) => void;
  appendThinking: (text: string) => void;
  startToolCall: (id: string, toolName: string, params: Record<string, any>) => void;
  completeToolCall: (id: string, result: any, error?: string) => void;
  reset: () => void;
  complete: () => void;
}

export function useStreaming(options: UseStreamingOptions = {}): UseStreamingReturn {
  const {
    onChunk,
    onComplete,
    onError,
    throttleMs = 60,
    typingMode = 'char',
    typingSpeed = 20,
    enableTypewriter = true,
  } = options;

  const [content, setContent] = useState('');
  const [thinking, setThinking] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [toolCalls, setToolCalls] = useState<UseStreamingReturn['toolCalls']>([]);

  const contentRef = useRef('');
  const thinkingRef = useRef('');
  const lastUpdateRef = useRef(0);
  const pendingContentRef = useRef('');
  const pendingThinkingRef = useRef('');

  // 使用 typewriter hook 管理显示内容
  const {
    displayContent,
    isTyping,
    isComplete,
    skip,
  } = useTypewriter({
    content: contentRef.current,
    mode: typingMode,
    speed: typingSpeed,
    enabled: enableTypewriter,
  });

  const throttledUpdate = useCallback(
    (type: 'content' | 'thinking', value: string) => {
      const now = Date.now();
      if (now - lastUpdateRef.current >= throttleMs) {
        if (type === 'content') {
          setContent(value);
          contentRef.current = value;
        } else {
          setThinking(value);
          thinkingRef.current = value;
        }
        lastUpdateRef.current = now;
      } else {
        if (type === 'content') {
          pendingContentRef.current = value;
        } else {
          pendingThinkingRef.current = value;
        }
      }
    },
    [throttleMs]
  );

  useEffect(() => {
    if (!isStreaming) return;

    const interval = setInterval(() => {
      if (pendingContentRef.current !== contentRef.current) {
        setContent(pendingContentRef.current);
        contentRef.current = pendingContentRef.current;
      }
      if (pendingThinkingRef.current !== thinkingRef.current) {
        setThinking(pendingThinkingRef.current);
        thinkingRef.current = pendingThinkingRef.current;
      }
    }, throttleMs);

    return () => clearInterval(interval);
  }, [isStreaming, throttleMs]);

  const appendContent = useCallback(
    (text: string) => {
      const newContent = contentRef.current + text;
      throttledUpdate('content', newContent);
      onChunk?.({ type: 'content', content: text });
    },
    [throttledUpdate, onChunk]
  );

  const appendThinking = useCallback(
    (text: string) => {
      const newThinking = thinkingRef.current + text;
      throttledUpdate('thinking', newThinking);
      onChunk?.({ type: 'thinking', content: text });
    },
    [throttledUpdate, onChunk]
  );

  const startToolCall = useCallback(
    (id: string, toolName: string, params: Record<string, any>) => {
      setToolCalls((prev) => [
        ...prev,
        {
          id,
          toolName,
          params,
          status: 'running',
        },
      ]);
      onChunk?.({
        type: 'tool_start',
        toolCallId: id,
        toolName,
        toolParams: params,
      });
    },
    [onChunk]
  );

  const completeToolCall = useCallback(
    (id: string, result: any, error?: string) => {
      setToolCalls((prev) =>
        prev.map((tc) =>
          tc.id === id
            ? {
                ...tc,
                status: error ? 'error' : 'completed',
                result,
              }
            : tc
        )
      );
      onChunk?.({
        type: 'tool_end',
        toolCallId: id,
        toolResult: { success: !error, data: result, error },
      });
    },
    [onChunk]
  );

  const reset = useCallback(() => {
    setContent('');
    setThinking('');
    setToolCalls([]);
    setIsStreaming(false);
    contentRef.current = '';
    thinkingRef.current = '';
    pendingContentRef.current = '';
    pendingThinkingRef.current = '';
    lastUpdateRef.current = 0;
  }, []);

  const complete = useCallback(() => {
    setContent(contentRef.current);
    setThinking(thinkingRef.current);
    setIsStreaming(false);
    // 触发 skip 直接显示全部内容
    skip();
    onComplete?.();
    onChunk?.({ type: 'done' });
  }, [onComplete, onChunk, skip]);

  // 当内容变化时更新流式状态
  useEffect(() => {
    const hasContent = content.length > 0 || thinking.length > 0 || toolCalls.length > 0;
    if (hasContent && !isStreaming) {
      setIsStreaming(true);
    }
  }, [content, thinking, toolCalls.length, isStreaming]);

  return {
    content,
    displayContent,
    thinking,
    isStreaming,
    isTyping,
    isComplete,
    toolCalls,
    appendContent,
    appendThinking,
    startToolCall,
    completeToolCall,
    reset,
    complete,
  };
}
