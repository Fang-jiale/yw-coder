/**
 * useTypewriter Hook
 * 打字机效果 Hook，支持逐字/逐词显示、光标闪烁、暂停/恢复等功能
 */

import { useState, useCallback, useRef, useEffect } from 'react';

export interface UseTypewriterOptions {
  content: string;
  mode?: 'char' | 'word';
  speed?: number; // chars/words per second
  cursor?: string;
  cursorBlinkSpeed?: number;
  enabled?: boolean;
  onComplete?: () => void;
}

export interface UseTypewriterReturn {
  displayContent: string;
  isTyping: boolean;
  isComplete: boolean;
  cursorVisible: boolean;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  skip: () => void;
}

export function useTypewriter(options: UseTypewriterOptions): UseTypewriterReturn {
  const {
    content,
    mode = 'char',
    speed = 20,
    cursor = '▋',
    cursorBlinkSpeed = 530,
    enabled = true,
    onComplete,
  } = options;

  const [displayContent, setDisplayContent] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [cursorVisible, setCursorVisible] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  const currentIndexRef = useRef(0);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const cursorTimerRef = useRef<NodeJS.Timeout | null>(null);
  const contentRef = useRef(content);
  const onCompleteRef = useRef(onComplete);

  // 同步 refs
  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // 将内容分割为字符或单词数组
  const splitContent = useCallback((text: string): string[] => {
    if (mode === 'char') {
      // 使用 Intl.Segmenter 来正确分割字符（包括中文字符）
      if (typeof Intl !== 'undefined' && Intl.Segmenter) {
        const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'grapheme' });
        return Array.from(segmenter.segment(text)).map(s => s.segment);
      }
      // 降级方案：使用 spread 操作符
      return [...text];
    }
    // 按单词分割，保留空格
    return text.split(/(\s+)/).filter(Boolean);
  }, [mode]);

  // 计算打字间隔（毫秒）
  const getTypingInterval = useCallback((): number => {
    return Math.max(16, Math.floor(1000 / speed));
  }, [speed]);

  // 执行打字
  const typeNext = useCallback(() => {
    const items = splitContent(contentRef.current);

    if (currentIndexRef.current >= items.length) {
      // 打字完成
      setIsTyping(false);
      setIsComplete(true);
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }
      onCompleteRef.current?.();
      return;
    }

    const nextIndex = currentIndexRef.current + 1;
    const nextContent = items.slice(0, nextIndex).join('');

    setDisplayContent(nextContent);
    currentIndexRef.current = nextIndex;

    // 继续下一次打字
    typingTimerRef.current = setTimeout(typeNext, getTypingInterval());
  }, [splitContent, getTypingInterval]);

  // 开始打字
  const startTyping = useCallback(() => {
    if (!enabled || isComplete || isPaused) return;

    setIsTyping(true);
    typingTimerRef.current = setTimeout(typeNext, getTypingInterval());
  }, [enabled, isComplete, isPaused, typeNext, getTypingInterval]);

  // 暂停打字
  const pause = useCallback(() => {
    setIsPaused(true);
    setIsTyping(false);
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
  }, []);

  // 恢复打字
  const resume = useCallback(() => {
    if (isComplete) return;

    setIsPaused(false);
    const items = splitContent(contentRef.current);

    if (currentIndexRef.current < items.length) {
      setIsTyping(true);
      typingTimerRef.current = setTimeout(typeNext, getTypingInterval());
    }
  }, [isComplete, splitContent, typeNext, getTypingInterval]);

  // 重置打字机
  const reset = useCallback(() => {
    // 清除定时器
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }

    // 重置状态
    currentIndexRef.current = 0;
    setDisplayContent('');
    setIsTyping(false);
    setIsComplete(false);
    setIsPaused(false);

    // 如果启用，重新开始
    if (enabled) {
      setTimeout(() => {
        setIsTyping(true);
        typingTimerRef.current = setTimeout(typeNext, getTypingInterval());
      }, 0);
    }
  }, [enabled, typeNext, getTypingInterval]);

  // 跳过动画，直接显示全部
  const skip = useCallback(() => {
    // 清除打字定时器
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }

    // 直接显示全部内容
    currentIndexRef.current = splitContent(contentRef.current).length;
    setDisplayContent(contentRef.current);
    setIsTyping(false);
    setIsComplete(true);
    setIsPaused(false);

    // 触发完成回调
    onCompleteRef.current?.();
  }, [splitContent]);

  // 光标闪烁效果
  useEffect(() => {
    cursorTimerRef.current = setInterval(() => {
      setCursorVisible((prev) => !prev);
    }, cursorBlinkSpeed);

    return () => {
      if (cursorTimerRef.current) {
        clearInterval(cursorTimerRef.current);
      }
    };
  }, [cursorBlinkSpeed]);

  // 初始化或内容变化时重置
  useEffect(() => {
    // 内容变化时重置
    if (content !== contentRef.current && displayContent !== '') {
      reset();
      return;
    }

    // 初始启动
    if (enabled && !isComplete && !isPaused && currentIndexRef.current === 0) {
      startTyping();
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, enabled]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }
      if (cursorTimerRef.current) {
        clearInterval(cursorTimerRef.current);
      }
    };
  }, []);

  // 流式中断处理：当内容变化且当前显示内容比新内容长时
  useEffect(() => {
    const currentDisplayLength = displayContent.length;
    const newContentLength = content.length;

    // 如果内容被截断（流式中断），直接显示当前内容
    if (currentDisplayLength > newContentLength && isTyping) {
      skip();
    }
  }, [content, displayContent, isTyping, skip]);

  return {
    displayContent,
    isTyping,
    isComplete,
    cursorVisible,
    pause,
    resume,
    reset,
    skip,
  };
}
