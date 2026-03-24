/**
 * Chat Hooks 集成测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStreaming } from './useStreaming';
import { useMessageActions } from './useMessageActions';
import { useAutoScroll } from './useAutoScroll';

describe('useStreaming Hook', () => {
  it('应该正确初始化', () => {
    const { result } = renderHook(() => useStreaming());

    expect(result.current.content).toBe('');
    expect(result.current.thinking).toBe('');
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.toolCalls).toEqual([]);
  });

  it('应该追加内容', () => {
    const { result } = renderHook(() => useStreaming());

    act(() => {
      result.current.appendContent('Hello');
    });

    expect(result.current.content).toBe('Hello');
  });

  it('应该追加思考内容', () => {
    const { result } = renderHook(() => useStreaming());

    act(() => {
      result.current.appendThinking('Thinking...');
    });

    expect(result.current.thinking).toBe('Thinking...');
  });

  it('应该管理工具调用', () => {
    const { result } = renderHook(() => useStreaming());

    act(() => {
      result.current.startToolCall('tool-1', 'read_file', { path: '/test.txt' });
    });

    expect(result.current.toolCalls).toHaveLength(1);
    expect(result.current.toolCalls[0].status).toBe('running');

    act(() => {
      result.current.completeToolCall('tool-1', { success: true });
    });

    expect(result.current.toolCalls[0].status).toBe('completed');
  });

  it('应该重置状态', () => {
    const { result } = renderHook(() => useStreaming());

    act(() => {
      result.current.appendContent('Hello');
      result.current.appendThinking('Thinking');
      result.current.startToolCall('tool-1', 'read_file', {});
      result.current.reset();
    });

    expect(result.current.content).toBe('');
    expect(result.current.thinking).toBe('');
    expect(result.current.toolCalls).toEqual([]);
  });

  it('应该调用完成回调', () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() => useStreaming({ onComplete }));

    act(() => {
      result.current.complete();
    });

    expect(onComplete).toHaveBeenCalled();
  });
});

describe('useMessageActions Hook', () => {
  it('应该正确初始化', () => {
    const { result } = renderHook(() => useMessageActions());

    expect(result.current.copiedMessageId).toBeNull();
    expect(result.current.editingMessageId).toBeNull();
    expect(result.current.actionHistory).toEqual([]);
  });

  it('应该复制消息', async () => {
    const { result } = renderHook(() => useMessageActions());

    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    await act(async () => {
      await result.current.copyMessage('msg-1', 'Test content');
    });

    expect(result.current.copiedMessageId).toBe('msg-1');
    expect(result.current.actionHistory).toHaveLength(1);
    expect(result.current.actionHistory[0].type).toBe('copy');

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2100));
    });

    expect(result.current.copiedMessageId).toBeNull();
  });

  it('应该开始编辑消息', () => {
    const { result } = renderHook(() => useMessageActions());

    act(() => {
      result.current.startEditing('msg-1', 'Original content');
    });

    expect(result.current.editingMessageId).toBe('msg-1');
    expect(result.current.editContent).toBe('Original content');
  });

  it('应该确认编辑', () => {
    const onEdit = vi.fn();
    const { result } = renderHook(() =>
      useMessageActions({ onEdit })
    );

    act(() => {
      result.current.startEditing('msg-1', 'Original content');
      result.current.updateEditContent('Updated content');
      result.current.confirmEdit();
    });

    expect(onEdit).toHaveBeenCalledWith('msg-1', 'Updated content');
    expect(result.current.editingMessageId).toBeNull();
  });

  it('应该取消编辑', () => {
    const { result } = renderHook(() => useMessageActions());

    act(() => {
      result.current.startEditing('msg-1', 'Original content');
      result.current.cancelEdit();
    });

    expect(result.current.editingMessageId).toBeNull();
    expect(result.current.editContent).toBe('');
  });

  it('应该删除消息', () => {
    const onDelete = vi.fn();
    const { result } = renderHook(() =>
      useMessageActions({ onDelete })
    );

    act(() => {
      result.current.deleteMessage('msg-1');
    });

    expect(onDelete).toHaveBeenCalledWith('msg-1');
    expect(result.current.actionHistory[0].type).toBe('delete');
  });

  it('应该重试消息', () => {
    const onRetry = vi.fn();
    const { result } = renderHook(() =>
      useMessageActions({ onRetry })
    );

    act(() => {
      result.current.retryMessage('msg-1');
    });

    expect(onRetry).toHaveBeenCalledWith('msg-1');
    expect(result.current.actionHistory[0].type).toBe('retry');
  });

  it('应该引用消息', () => {
    const onQuote = vi.fn();
    const { result } = renderHook(() =>
      useMessageActions({ onQuote })
    );

    act(() => {
      result.current.quoteMessage('msg-1');
    });

    expect(onQuote).toHaveBeenCalledWith('msg-1');
    expect(result.current.actionHistory[0].type).toBe('quote');
  });
});

describe('useAutoScroll Hook', () => {
  it('应该正确初始化', () => {
    const { result } = renderHook(() => useAutoScroll());

    expect(result.current.scrollRef.current).toBeDefined();
    expect(result.current.shouldAutoScroll).toBe(true);
  });

  it('应该启用自动滚动', () => {
    const { result } = renderHook(() => useAutoScroll());

    act(() => {
      result.current.disableAutoScroll();
    });

    expect(result.current.shouldAutoScroll).toBe(false);

    act(() => {
      result.current.enableAutoScroll();
    });

    expect(result.current.shouldAutoScroll).toBe(true);
  });
});
