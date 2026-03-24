/**
 * MessageList 组件
 * 简洁的消息列表容器
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SCROLL_THRESHOLD } from '@/constants';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Button } from '@/components/ui/button';

export interface MessageListItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface MessageListProps {
  items: MessageListItem[];
  renderItem: (item: MessageListItem, index: number) => React.ReactNode;
  className?: string;
  externalScrollRef?: HTMLDivElement | null;
  onScroll?: (event: React.UIEvent<HTMLDivElement>) => void;
  isLoading?: boolean;
  loadingComponent?: React.ReactNode;
  emptyComponent?: React.ReactNode;
  threshold?: number;
}

export function MessageList({
  items,
  renderItem,
  className,
  externalScrollRef,
  onScroll,
  isLoading = false,
  loadingComponent,
  emptyComponent,
  threshold = SCROLL_THRESHOLD,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);
  const isUserScrolling = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  useEffect(() => {
    const container = externalScrollRef || containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceToBottom = scrollHeight - scrollTop - clientHeight;
      const isAtBottom = distanceToBottom < threshold;
      
      shouldAutoScroll.current = isAtBottom;
      setShowScrollButton(!isAtBottom && items.length > 0);
      
      if (!isAtBottom) {
        isUserScrolling.current = true;
        
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }
        
        scrollTimeoutRef.current = setTimeout(() => {
          isUserScrolling.current = false;
        }, 150);
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [threshold, externalScrollRef, items.length]);

  // 使用最后一个消息的内容作为依赖，确保内容变化时也能触发滚动
  const lastMessageContent = items.length > 0 ? items[items.length - 1]?.content : undefined;

  useEffect(() => {
    if (shouldAutoScroll.current && !isUserScrolling.current) {
      const container = externalScrollRef || containerRef.current;
      if (container) {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: 'smooth',
        });
      }
    }
  }, [items.length, lastMessageContent, externalScrollRef]);

  const scrollToBottom = useCallback(() => {
    const container = externalScrollRef || containerRef.current;
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth',
      });
      shouldAutoScroll.current = true;
      isUserScrolling.current = false;
      setShowScrollButton(false);
    }
  }, [externalScrollRef]);

  if (items.length === 0 && !isLoading) {
    return emptyComponent ? (
      <div ref={containerRef} className={cn('flex-1 overflow-auto', className)}>
        {emptyComponent}
      </div>
    ) : null;
  }

  return (
    <>
      <div
        ref={containerRef}
        className={cn(
          'flex-1 overflow-y-auto scroll-smooth',
          className
        )}
        onScroll={onScroll}
      >
        <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
          {items.map((item, index) => (
            <div key={item.id} className="w-full">
              {renderItem(item, index)}
            </div>
          ))}
          {isLoading && loadingComponent && (
            <div className="py-4">{loadingComponent}</div>
          )}
        </div>
      </div>
      
      <ScrollToBottomButton 
        onClick={scrollToBottom} 
        visible={showScrollButton} 
      />
    </>
  );
}

export function ScrollToBottomButton({
  onClick,
  visible,
}: {
  onClick: () => void;
  visible: boolean;
}) {
  if (!visible) return null;

  return (
    <Button
      onClick={onClick}
      size="icon"
      className={cn(
        'fixed bottom-20 right-4 z-50 h-9 w-9 rounded-full shadow-md',
        'bg-primary text-primary-foreground hover:bg-primary/90',
        'animate-in fade-in zoom-in-95 duration-200'
      )}
      aria-label="滚动到底部"
    >
      <ArrowDown className="w-4 h-4" />
    </Button>
  );
}
