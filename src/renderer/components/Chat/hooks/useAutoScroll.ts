/**
 * useAutoScroll Hook
 * 自动滚动管理 - 增强智能滚动功能
 */

import { useRef, useCallback, useEffect, useState } from 'react';

interface UseAutoScrollOptions {
  threshold?: number;
  smooth?: boolean;
  enableSmartScroll?: boolean;
  userScrollTimeout?: number;
}

interface UseAutoScrollReturn {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  shouldAutoScroll: boolean;
  scrollToBottom: () => void;
  scrollToBottomWithAnimation: () => void;
  enableAutoScroll: () => void;
  disableAutoScroll: () => void;
  isAtBottom: boolean;
  hasNewMessages: boolean;
  scrollDirection: 'up' | 'down' | 'none';
  markNewMessages: () => void;
  clearNewMessages: () => void;
}

export function useAutoScroll(
  options: UseAutoScrollOptions = {}
): UseAutoScrollReturn {
  const {
    threshold = 100,
    smooth = true,
    enableSmartScroll = true,
    userScrollTimeout = 150,
  } = options;

  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const isUserScrollingRef = useRef(false);
  const lastScrollTopRef = useRef(0);
  const lastScrollTimeRef = useRef(0);
  const userScrollTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [isAtBottom, setIsAtBottom] = useState(true);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down' | 'none'>('none');

  const checkIsAtBottom = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return true;

    const { scrollTop, scrollHeight, clientHeight } = container;
    return scrollHeight - scrollTop - clientHeight < threshold;
  }, [threshold]);

  const scrollToBottom = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto',
    });

    shouldAutoScrollRef.current = true;
    isUserScrollingRef.current = false;
    setHasNewMessages(false);
  }, [smooth]);

  const scrollToBottomWithAnimation = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth',
    });

    shouldAutoScrollRef.current = true;
    isUserScrollingRef.current = false;
    setHasNewMessages(false);
  }, []);

  const enableAutoScroll = useCallback(() => {
    shouldAutoScrollRef.current = true;
    scrollToBottom();
  }, [scrollToBottom]);

  const disableAutoScroll = useCallback(() => {
    shouldAutoScrollRef.current = false;
  }, []);

  const markNewMessages = useCallback(() => {
    if (!isAtBottom) {
      setHasNewMessages(true);
    }
  }, [isAtBottom]);

  const clearNewMessages = useCallback(() => {
    setHasNewMessages(false);
  }, []);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const handleScroll = () => {
      const currentScrollTop = container.scrollTop;
      const currentTime = Date.now();
      const atBottom = checkIsAtBottom();

      const scrollDelta = currentScrollTop - lastScrollTopRef.current;
      const timeDelta = currentTime - lastScrollTimeRef.current;

      if (Math.abs(scrollDelta) > 5 && timeDelta > 16) {
        if (scrollDelta > 0) {
          setScrollDirection('down');
        } else if (scrollDelta < 0) {
          setScrollDirection('up');
        } else {
          setScrollDirection('none');
        }

        if (enableSmartScroll && scrollDelta < 0) {
          isUserScrollingRef.current = true;
          shouldAutoScrollRef.current = false;

          if (userScrollTimerRef.current) {
            clearTimeout(userScrollTimerRef.current);
          }

          userScrollTimerRef.current = setTimeout(() => {
            isUserScrollingRef.current = false;
          }, userScrollTimeout);
        }
      }

      setIsAtBottom(atBottom);

      if (atBottom) {
        shouldAutoScrollRef.current = true;
        isUserScrollingRef.current = false;
        setHasNewMessages(false);
        setScrollDirection('none');
      }

      lastScrollTopRef.current = currentScrollTop;
      lastScrollTimeRef.current = currentTime;
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (userScrollTimerRef.current) {
        clearTimeout(userScrollTimerRef.current);
      }
    };
  }, [checkIsAtBottom, enableSmartScroll, userScrollTimeout]);

  return {
    scrollRef,
    shouldAutoScroll: shouldAutoScrollRef.current,
    scrollToBottom,
    scrollToBottomWithAnimation,
    enableAutoScroll,
    disableAutoScroll,
    isAtBottom,
    hasNewMessages,
    scrollDirection,
    markNewMessages,
    clearNewMessages,
  };
}
