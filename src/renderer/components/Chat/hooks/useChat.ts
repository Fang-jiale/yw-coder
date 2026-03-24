import { useCallback, useState } from 'react';
import { useUnifiedAgentStore } from '@/store/unifiedAgentStore';

interface UseChatOptions {
  maxRetries?: number;
}

interface UseChatReturn {
  sendMessage: (taskId: string, content: string) => Promise<void>;
  retryMessage: (messageId: string, content: string) => Promise<void>;
  deleteMessage: (messageId: string) => void;
  clearConversation: () => void;
  isSending: boolean;
  error: string | null;
}

export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const { maxRetries = 3 } = options;
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { sendMessage: storeSendMessage, clearTaskMessages, deleteTaskMessage, activeTaskId } =
    useUnifiedAgentStore();

  const sendMessage = useCallback(
    async (taskId: string, content: string) => {
      setIsSending(true);
      setError(null);

      try {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          try {
            await storeSendMessage(taskId, content);
            return;
          } catch (err) {
            const error = err as Error;
            console.error(
              `Send message attempt ${attempt + 1} failed:`,
              error
            );

            if (attempt === maxRetries - 1) {
              setError(error.message || '发送消息失败');
              throw error;
            }

            await new Promise((resolve) =>
              setTimeout(resolve, Math.pow(2, attempt) * 1000)
            );
          }
        }
      } finally {
        setIsSending(false);
      }
    },
    [storeSendMessage, maxRetries]
  );

  const retryMessage = useCallback(
    async (messageId: string, content: string) => {
      setIsSending(true);
      setError(null);

      try {
        deleteMessage(messageId);
        if (activeTaskId) {
          await sendMessage(activeTaskId, content);
        }
      } catch (err) {
        const error = err as Error;
        setError(error.message || '重试失败');
        throw error;
      } finally {
        setIsSending(false);
      }
    },
    [activeTaskId, sendMessage]
  );

  const deleteMessage = useCallback(
    (messageId: string) => {
      if (!activeTaskId) return;
      deleteTaskMessage(activeTaskId, messageId);
    },
    [activeTaskId, deleteTaskMessage]
  );

  const clearConversation = useCallback(() => {
    if (!activeTaskId) return;
    clearTaskMessages(activeTaskId);
  }, [activeTaskId, clearTaskMessages]);

  return {
    sendMessage,
    retryMessage,
    deleteMessage,
    clearConversation,
    isSending,
    error,
  };
}
