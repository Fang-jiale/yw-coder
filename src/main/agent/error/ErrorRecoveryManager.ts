/**
 * 错误恢复管理器
 * 管理 Agent 的错误分类和恢复策略
 */

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export type ErrorCategory =
  | 'network'
  | 'authentication'
  | 'authorization'
  | 'validation'
  | 'execution'
  | 'timeout'
  | 'resource'
  | 'unknown';

export interface ClassifiedError {
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  originalError: string;
  recoverable: boolean;
  suggestedAction?: string;
}

export interface RecoveryStrategy {
  name: string;
  description: string;
  canHandle(error: ClassifiedError): boolean;
  execute(error: ClassifiedError, context: RecoveryContext): Promise<RecoveryResult>;
}

export interface RecoveryContext {
  taskId: string;
  workspacePath: string;
  retryCount: number;
  maxRetries: number;
  lastCheckpointId?: string;
  errorHistory: ClassifiedError[];
}

export interface RecoveryResult {
  success: boolean;
  action?: string;
  message?: string;
  shouldRetry?: boolean;
  shouldAbort?: boolean;
  checkpointId?: string;
}

export interface ErrorLogEntry {
  timestamp: number;
  taskId: string;
  error: ClassifiedError;
  recoveryAttempted: boolean;
  recoveryResult?: RecoveryResult;
}

export class ErrorRecoveryManager {
  private strategies: RecoveryStrategy[] = [];
  private errorLogs: ErrorLogEntry[] = [];
  private maxErrorLogs: number;

  constructor(maxErrorLogs: number = 100) {
    this.maxErrorLogs = maxErrorLogs;
    this.initializeDefaultStrategies();
  }

  private initializeDefaultStrategies(): void {
    this.strategies.push({
      name: 'network_retry',
      description: 'Retry network-related errors with exponential backoff',
      canHandle: (error) => error.category === 'network',
      execute: async (error, context) => {
        if (context.retryCount >= context.maxRetries) {
          return {
            success: false,
            action: 'max_retries_exceeded',
            message: `Max retries (${context.maxRetries}) exceeded for network error`,
            shouldAbort: true,
          };
        }

        return {
          success: true,
          action: 'retry',
          message: `Retrying after ${Math.pow(2, context.retryCount)}ms`,
          shouldRetry: true,
        };
      },
    });

    this.strategies.push({
      name: 'timeout_retry',
      description: 'Retry timeout errors with increased timeout',
      canHandle: (error) => error.category === 'timeout',
      execute: async (error, context) => {
        if (context.retryCount >= context.maxRetries) {
          return {
            success: false,
            action: 'max_retries_exceeded',
            message: `Max retries (${context.maxRetries}) exceeded for timeout`,
            shouldAbort: true,
          };
        }

        return {
          success: true,
          action: 'retry_with_extended_timeout',
          message: `Retrying with extended timeout`,
          shouldRetry: true,
        };
      },
    });

    this.strategies.push({
      name: 'validation_error_abort',
      description: 'Abort on validation errors as they indicate a bug',
      canHandle: (error) => error.category === 'validation',
      execute: async (error) => {
        return {
          success: false,
          action: 'abort',
          message: `Validation error cannot be recovered automatically`,
          shouldAbort: true,
        };
      },
    });

    this.strategies.push({
      name: 'resource_error_abort',
      description: 'Abort on resource errors',
      canHandle: (error) => error.category === 'resource',
      execute: async (error) => {
        return {
          success: false,
          action: 'abort',
          message: `Resource error cannot be recovered automatically`,
          shouldAbort: true,
        };
      },
    });

    this.strategies.push({
      name: 'execution_retry',
      description: 'Retry general execution errors',
      canHandle: (error) => error.category === 'execution',
      execute: async (error, context) => {
        if (context.retryCount >= context.maxRetries) {
          return {
            success: false,
            action: 'max_retries_exceeded',
            message: `Max retries (${context.maxRetries}) exceeded for execution error`,
            shouldAbort: true,
          };
        }

        return {
          success: true,
          action: 'retry',
          message: `Retrying execution`,
          shouldRetry: true,
        };
      },
    });

    this.strategies.push({
      name: 'unknown_error_retry',
      description: 'Retry unknown errors with caution',
      canHandle: (error) => error.category === 'unknown',
      execute: async (error, context) => {
        if (context.retryCount >= 2) {
          return {
            success: false,
            action: 'max_retries_exceeded',
            message: `Too many unknown errors, aborting`,
            shouldAbort: true,
          };
        }

        return {
          success: true,
          action: 'retry',
          message: `Retrying unknown error`,
          shouldRetry: true,
        };
      },
    });
  }

  registerStrategy(strategy: RecoveryStrategy): void {
    this.strategies.push(strategy);
  }

  unregisterStrategy(name: string): boolean {
    const index = this.strategies.findIndex((s) => s.name === name);
    if (index !== -1) {
      this.strategies.splice(index, 1);
      return true;
    }
    return false;
  }

  classifyError(error: unknown): ClassifiedError {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const originalError = errorMessage;

    const normalizedError = errorMessage.toLowerCase();

    if (this.isNetworkError(normalizedError)) {
      return {
        category: 'network',
        severity: this.determineSeverity(errorMessage),
        message: errorMessage,
        originalError,
        recoverable: true,
        suggestedAction: 'Retry with exponential backoff',
      };
    }

    if (this.isAuthenticationError(normalizedError)) {
      return {
        category: 'authentication',
        severity: 'critical',
        message: errorMessage,
        originalError,
        recoverable: false,
        suggestedAction: 'Check API key or authentication credentials',
      };
    }

    if (this.isAuthorizationError(normalizedError)) {
      return {
        category: 'authorization',
        severity: 'high',
        message: errorMessage,
        originalError,
        recoverable: false,
        suggestedAction: 'Check permissions or access rights',
      };
    }

    if (this.isValidationError(normalizedError)) {
      return {
        category: 'validation',
        severity: 'high',
        message: errorMessage,
        originalError,
        recoverable: false,
        suggestedAction: 'Fix input validation or parameters',
      };
    }

    if (this.isTimeoutError(normalizedError)) {
      return {
        category: 'timeout',
        severity: 'medium',
        message: errorMessage,
        originalError,
        recoverable: true,
        suggestedAction: 'Retry with increased timeout',
      };
    }

    if (this.isResourceError(normalizedError)) {
      return {
        category: 'resource',
        severity: 'high',
        message: errorMessage,
        originalError,
        recoverable: false,
        suggestedAction: 'Free up resources or increase limits',
      };
    }

    return {
      category: 'unknown',
      severity: 'medium',
      message: errorMessage,
      originalError,
      recoverable: true,
      suggestedAction: 'Retry or investigate further',
    };
  }

  private isNetworkError(message: string): boolean {
    return (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('connection') ||
      message.includes('econnrefused') ||
      message.includes('enotfound') ||
      message.includes('socket')
    );
  }

  private isAuthenticationError(message: string): boolean {
    return (
      message.includes('auth') ||
      message.includes('unauthorized') ||
      message.includes('401') ||
      message.includes('api key') ||
      message.includes('invalid token')
    );
  }

  private isAuthorizationError(message: string): boolean {
    return (
      message.includes('forbidden') ||
      message.includes('403') ||
      message.includes('permission') ||
      message.includes('access denied')
    );
  }

  private isValidationError(message: string): boolean {
    return (
      message.includes('validation') ||
      message.includes('invalid') ||
      message.includes('schema') ||
      message.includes('malformed')
    );
  }

  private isTimeoutError(message: string): boolean {
    return (
      message.includes('timeout') ||
      message.includes('timed out') ||
      message.includes('etimedout') ||
      message.includes('request timeout')
    );
  }

  private isResourceError(message: string): boolean {
    return (
      message.includes('memory') ||
      message.includes('disk') ||
      message.includes('space') ||
      message.includes('quota') ||
      message.includes('enospc')
    );
  }

  private determineSeverity(message: string): ErrorSeverity {
    if (message.includes('fatal') || message.includes('critical')) {
      return 'critical';
    }
    if (message.includes('error') || message.includes('failed')) {
      return 'high';
    }
    if (message.includes('warn')) {
      return 'medium';
    }
    return 'low';
  }

  async recover(
    error: unknown,
    context: RecoveryContext
  ): Promise<RecoveryResult> {
    const classifiedError = this.classifyError(error);

    const logEntry: ErrorLogEntry = {
      timestamp: Date.now(),
      taskId: context.taskId,
      error: classifiedError,
      recoveryAttempted: false,
    };

    for (const strategy of this.strategies) {
      if (strategy.canHandle(classifiedError)) {
        logEntry.recoveryAttempted = true;

        try {
          const result = await strategy.execute(classifiedError, context);
          logEntry.recoveryResult = result;

          this.addErrorLog(logEntry);

          return result;
        } catch (strategyError) {
          console.error(`Strategy ${strategy.name} failed:`, strategyError);
        }
      }
    }

    this.addErrorLog(logEntry);

    return {
      success: false,
      action: 'no_strategy',
      message: 'No recovery strategy found for this error',
      shouldAbort: true,
    };
  }

  private addErrorLog(entry: ErrorLogEntry): void {
    this.errorLogs.push(entry);

    if (this.errorLogs.length > this.maxErrorLogs) {
      this.errorLogs = this.errorLogs.slice(-this.maxErrorLogs);
    }
  }

  getErrorLogs(taskId?: string): ErrorLogEntry[] {
    if (taskId) {
      return this.errorLogs.filter((log) => log.taskId === taskId);
    }
    return [...this.errorLogs];
  }

  getErrorStatistics(): {
    totalErrors: number;
    byCategory: Record<ErrorCategory, number>;
    bySeverity: Record<ErrorSeverity, number>;
    recoveryRate: number;
  } {
    const byCategory: Record<ErrorCategory, number> = {
      network: 0,
      authentication: 0,
      authorization: 0,
      validation: 0,
      execution: 0,
      timeout: 0,
      resource: 0,
      unknown: 0,
    };

    const bySeverity: Record<ErrorSeverity, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    let recoveredCount = 0;

    for (const log of this.errorLogs) {
      byCategory[log.error.category]++;
      bySeverity[log.error.severity]++;

      if (log.recoveryResult?.success) {
        recoveredCount++;
      }
    }

    return {
      totalErrors: this.errorLogs.length,
      byCategory,
      bySeverity,
      recoveryRate: this.errorLogs.length > 0
        ? (recoveredCount / this.errorLogs.length) * 100
        : 0,
    };
  }

  clearErrorLogs(taskId?: string): void {
    if (taskId) {
      this.errorLogs = this.errorLogs.filter((log) => log.taskId !== taskId);
    } else {
      this.errorLogs = [];
    }
  }

  serialize(): string {
    return JSON.stringify(this.errorLogs);
  }

  static deserialize(data: string): ErrorRecoveryManager {
    const manager = new ErrorRecoveryManager();
    const logs = JSON.parse(data);

    manager.errorLogs = logs;
    return manager;
  }
}
