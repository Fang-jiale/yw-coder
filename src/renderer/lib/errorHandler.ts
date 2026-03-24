import { toast } from '@/components/ui/use-toast';

interface ErrorHandlingOptions {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
  showToast?: boolean;
  onError?: (error: Error) => void;
}

export async function withErrorHandling<T>(
  promise: Promise<T>,
  options: ErrorHandlingOptions = {}
): Promise<T> {
  const {
    title = '操作失败',
    variant = 'destructive',
    showToast = true,
    onError,
  } = options;

  try {
    const result = await promise;
    return result;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));

    if (showToast) {
      toast({
        title,
        description: options.description || err.message || '发生未知错误',
        variant,
      });
    }

    onError?.(err);
    throw err;
  }
}

export function createErrorHandler(options: ErrorHandlingOptions = {}) {
  return (error: unknown) => {
    const err = error instanceof Error ? error : new Error(String(error));

    if (options.showToast !== false) {
      toast({
        title: options.title || '错误',
        description: options.description || err.message,
        variant: options.variant || 'destructive',
      });
    }

    options.onError?.(err);
  };
}

export class AppError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function handleError(error: unknown, context?: string): void {
  const err =
    error instanceof Error ? error : new Error(String(error));

  console.error(`[Error${context ? ` in ${context}` : ''}]:`, err);

  toast({
    title: '出错了',
    description: err.message,
    variant: 'destructive',
  });
}
