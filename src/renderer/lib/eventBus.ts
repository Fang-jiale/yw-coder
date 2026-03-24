/**
 * Event Bus - 统一事件总线
 * 用于前端组件间的通信，解耦依赖
 */

type EventCallback<T = any> = (data: T) => void;

class EventBus {
  private listeners: Map<string, Set<EventCallback>> = new Map();
  private onceListeners: Map<string, Array<EventCallback>> = new Map();

  on<T = any>(event: string, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    
    this.listeners.get(event)!.add(callback);

    // 返回取消订阅函数
    return () => this.off(event, callback);
  }

  once<T = any>(event: string, callback: EventCallback<T>): void {
    if (!this.onceListeners.has(event)) {
      this.onceListeners.set(event, []);
    }
    this.onceListeners.get(event)!.push(callback);
  }

  off<T = any>(event: string, callback: EventCallback<T>): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(callback);
      if (eventListeners.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  emit<T = any>(event: string, data?: T): void {
    // 先触发一次性监听器
    const onceCallbacks = this.onceListeners.get(event);
    if (onceCallbacks && onceCallbacks.length > 0) {
      onceCallbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[EventBus] Error in once listener for ${event}:`, error);
        }
      });
      this.onceListeners.delete(event);
    }

    // 触发持久监听器
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[EventBus] Error in listener for ${event}:`, error);
        }
      });
    }
  }

  clear(event?: string): void {
    if (event) {
      this.listeners.delete(event);
      this.onceListeners.delete(event);
    } else {
      this.listeners.clear();
      this.onceListeners.clear();
    }
  }

  listenerCount(event: string): number {
    return this.listeners.get(event)?.size || 0;
  }

  hasListeners(event: string): boolean {
    return this.listenerCount(event) > 0;
  }

  eventNames(): string[] {
    return Array.from(this.listeners.keys());
  }
}

// 全局事件总线实例
export const eventBus = new EventBus();

// 预定义的事件类型
export const EVENTS = {
  // 任务事件
  TASK_CREATED: 'task:created',
  TASK_STARTED: 'task:started',
  TASK_STOPPED: 'task:stopped',
  TASK_COMPLETED: 'task:completed',
  TASK_FAILED: 'task:failed',
  TASK_UPDATED: 'task:updated',

  // 消息事件
  MESSAGE_RECEIVED: 'message:received',
  MESSAGE_SENT: 'message:sent',
  MESSAGE_STREAMING: 'message:streaming',

  // 工具调用事件
  TOOL_CALL_STARTED: 'tool:call:started',
  TOOL_CALL_COMPLETED: 'tool:call:completed',
  TOOL_CALL_FAILED: 'tool:call:failed',

  // 步骤事件
  STEP_STARTED: 'step:started',
  STEP_COMPLETED: 'step:completed',
  STEP_FAILED: 'step:failed',

  // 待办事项事件
  TODO_UPDATED: 'todo:updated',

  // 执行计划事件
  PLAN_GENERATED: 'plan:generated',
  PLAN_UPDATED: 'plan:updated',

  // 配置事件
  CONFIG_CHANGED: 'config:changed',

  // UI 事件
  SHOW_NOTIFICATION: 'ui:notification',
  SHOW_DIALOG: 'ui:dialog',

  // 文件事件
  FILE_CREATED: 'file:created',
  FILE_MODIFIED: 'file:modified',
  FILE_DELETED: 'file:deleted',
} as const;

// Type-safe event helper
export type EventName = typeof EVENTS[keyof typeof EVENTS] | string;

export function createEventBus<T extends Record<string, any>>() {
  return {
    on<K extends keyof T>(event: K, callback: EventCallback<T[K]>): () => void {
      return eventBus.on(event as string, callback as EventCallback);
    },
    once<K extends keyof T>(event: K, callback: EventCallback<T[K]>): void {
      return eventBus.once(event as string, callback as EventCallback);
    },
    off<K extends keyof T>(event: K, callback: EventCallback<T[K]>): void {
      return eventBus.off(event as string, callback as EventCallback);
    },
    emit<K extends keyof T>(event: K, data?: T[K]): void {
      return eventBus.emit(event as string, data);
    },
  };
}
