/**
 * useMessageActions Hook
 * 处理消息操作的 Hook
 */

import { useCallback, useState } from 'react';

export interface MessageAction {
  type: 'copy' | 'edit' | 'delete' | 'retry' | 'quote';
  messageId: string;
  timestamp: number;
}

interface UseMessageActionsOptions {
  onCopy?: (messageId: string, content: string) => void;
  onEdit?: (messageId: string, newContent: string) => void;
  onDelete?: (messageId: string) => void;
  onRetry?: (messageId: string) => void;
  onQuote?: (messageId: string) => void;
}

interface UseMessageActionsReturn {
  copiedMessageId: string | null;
  editingMessageId: string | null;
  editContent: string;
  actionHistory: MessageAction[];
  copyMessage: (messageId: string, content: string) => Promise<void>;
  startEditing: (messageId: string, content: string) => void;
  confirmEdit: () => void;
  cancelEdit: () => void;
  updateEditContent: (content: string) => void;
  deleteMessage: (messageId: string) => void;
  retryMessage: (messageId: string) => void;
  quoteMessage: (messageId: string) => void;
  clearHistory: () => void;
}

export function useMessageActions(
  options: UseMessageActionsOptions = {}
): UseMessageActionsReturn {
  const {
    onCopy,
    onEdit,
    onDelete,
    onRetry,
    onQuote,
  } = options;

  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [actionHistory, setActionHistory] = useState<MessageAction[]>([]);

  const addToHistory = useCallback((action: MessageAction) => {
    setActionHistory((prev) => [...prev.slice(-49), action]);
  }, []);

  const copyMessage = useCallback(
    async (messageId: string, content: string) => {
      try {
        await navigator.clipboard.writeText(content);
        setCopiedMessageId(messageId);
        setTimeout(() => setCopiedMessageId(null), 2000);

        addToHistory({
          type: 'copy',
          messageId,
          timestamp: Date.now(),
        });

        onCopy?.(messageId, content);
      } catch (error) {
        console.error('Failed to copy message:', error);
      }
    },
    [onCopy, addToHistory]
  );

  const startEditing = useCallback((messageId: string, content: string) => {
    setEditingMessageId(messageId);
    setEditContent(content);
  }, []);

  const confirmEdit = useCallback(() => {
    if (editingMessageId && editContent.trim()) {
      addToHistory({
        type: 'edit',
        messageId: editingMessageId,
        timestamp: Date.now(),
      });

      onEdit?.(editingMessageId, editContent);
    }

    setEditingMessageId(null);
    setEditContent('');
  }, [editingMessageId, editContent, onEdit, addToHistory]);

  const cancelEdit = useCallback(() => {
    setEditingMessageId(null);
    setEditContent('');
  }, []);

  const updateEditContent = useCallback((content: string) => {
    setEditContent(content);
  }, []);

  const deleteMessage = useCallback(
    (messageId: string) => {
      addToHistory({
        type: 'delete',
        messageId,
        timestamp: Date.now(),
      });

      onDelete?.(messageId);
    },
    [onDelete, addToHistory]
  );

  const retryMessage = useCallback(
    (messageId: string) => {
      addToHistory({
        type: 'retry',
        messageId,
        timestamp: Date.now(),
      });

      onRetry?.(messageId);
    },
    [onRetry, addToHistory]
  );

  const quoteMessage = useCallback(
    (messageId: string) => {
      addToHistory({
        type: 'quote',
        messageId,
        timestamp: Date.now(),
      });

      onQuote?.(messageId);
    },
    [onQuote, addToHistory]
  );

  const clearHistory = useCallback(() => {
    setActionHistory([]);
  }, []);

  return {
    copiedMessageId,
    editingMessageId,
    editContent,
    actionHistory,
    copyMessage,
    startEditing,
    confirmEdit,
    cancelEdit,
    updateEditContent,
    deleteMessage,
    retryMessage,
    quoteMessage,
    clearHistory,
  };
}
