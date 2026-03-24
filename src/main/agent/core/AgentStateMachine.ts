/**
 * Agent 状态机
 * 管理 Agent 的生命周期状态转换
 */

export type AgentState =
  | 'idle'
  | 'initializing'
  | 'planning'
  | 'executing'
  | 'reviewing'
  | 'paused'
  | 'completed'
  | 'failed';

export type AgentEvent =
  | { type: 'START' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'STOP' }
  | { type: 'STEP_COMPLETE' }
  | { type: 'STEP_FAILED'; error: string }
  | { type: 'TOOL_RESULT'; result: unknown }
  | { type: 'USER_INPUT'; content: string }
  | { type: 'DONE' }
  | { type: 'ERROR'; error: string }
  | { type: 'RETRY' }
  | { type: 'APPROVED' }
  | { type: 'REJECTED' };

export interface StateTransition {
  from: AgentState;
  event: string;
  to: AgentState;
  action?: () => void | Promise<void>;
}

export interface AgentContext {
  taskId?: string;
  currentStep?: number;
  totalSteps?: number;
  isPaused?: boolean;
  error?: string;
  lastTransition?: string;
  [key: string]: unknown;
}

export interface StateHistoryEntry {
  state: AgentState;
  event: string;
  timestamp: number;
  context?: Partial<AgentContext>;
}

export class AgentStateMachine {
  private state: AgentState = 'idle';
  private context: AgentContext = {};
  private history: StateHistoryEntry[] = [];
  private listeners: Set<(state: AgentState, event: string) => void> = new Set();

  private readonly transitions: Record<AgentState, Record<string, AgentState>> = {
    idle: {
      START: 'initializing',
    },
    initializing: {
      DONE: 'planning',
      ERROR: 'failed',
    },
    planning: {
      DONE: 'executing',
      FAILED: 'failed',
      PAUSE: 'paused',
      STOP: 'idle',
    },
    executing: {
      STEP_COMPLETE: 'executing',
      DONE: 'reviewing',
      FAILED: 'failed',
      PAUSE: 'paused',
      STOP: 'idle',
    },
    reviewing: {
      APPROVED: 'completed',
      REJECTED: 'executing',
      FAILED: 'failed',
      STOP: 'idle',
    },
    paused: {
      RESUME: 'executing',
      STOP: 'idle',
    },
    completed: {
      START: 'initializing',
      STOP: 'idle',
    },
    failed: {
      RETRY: 'initializing',
      STOP: 'idle',
    },
  };

  constructor(initialContext?: Partial<AgentContext>) {
    if (initialContext) {
      this.context = { ...initialContext };
    }
    this.recordHistory('idle', 'INIT');
  }

  getState(): AgentState {
    return this.state;
  }

  getContext(): AgentContext {
    return { ...this.context };
  }

  getHistory(): StateHistoryEntry[] {
    return [...this.history];
  }

  canTransition(event: string): boolean {
    return event in this.transitions[this.state];
  }

  transition(event: AgentEvent): AgentState {
    const eventType = event.type;
    const nextState = this.transitions[this.state]?.[eventType];

    if (!nextState) {
      throw new Error(
        `Invalid transition: ${this.state} + ${eventType}. ` +
        `Available events: ${Object.keys(this.transitions[this.state] || {}).join(', ') || 'none'}`
      );
    }

    const previousState = this.state;
    this.state = nextState;

    this.context = {
      ...this.context,
      lastTransition: `${previousState} -> ${nextState} (${eventType})`,
    };

    if ('error' in event && event.error) {
      this.context.error = event.error;
    }

    if ('content' in event && event.content) {
      this.context.userInput = event.content;
    }

    if ('result' in event && event.result !== undefined) {
      this.context.lastToolResult = event.result;
    }

    this.recordHistory(this.state, eventType, this.context);

    this.notifyListeners(previousState, eventType);

    return this.state;
  }

  private recordHistory(
    state: AgentState,
    event: string,
    context?: Partial<AgentContext>
  ): void {
    this.history.push({
      state,
      event,
      timestamp: Date.now(),
      context,
    });

    if (this.history.length > 100) {
      this.history = this.history.slice(-100);
    }
  }

  subscribe(listener: (state: AgentState, event: string) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(previousState: AgentState, event: string): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.state, event);
      } catch (error) {
        console.error('Error in state change listener:', error);
      }
    });
  }

  reset(): void {
    this.state = 'idle';
    this.context = {};
    this.history = [];
    this.recordHistory('idle', 'RESET');
  }

  isFinalState(): boolean {
    return this.state === 'completed' || this.state === 'failed' || this.state === 'idle';
  }

  isRunning(): boolean {
    return (
      this.state === 'initializing' ||
      this.state === 'planning' ||
      this.state === 'executing' ||
      this.state === 'reviewing'
    );
  }

  getAvailableEvents(): string[] {
    return Object.keys(this.transitions[this.state] || {});
  }

  getStateMetadata(): {
    state: AgentState;
    context: AgentContext;
    isRunning: boolean;
    isFinal: boolean;
    availableEvents: string[];
    historyLength: number;
  } {
    return {
      state: this.state,
      context: this.getContext(),
      isRunning: this.isRunning(),
      isFinal: this.isFinalState(),
      availableEvents: this.getAvailableEvents(),
      historyLength: this.history.length,
    };
  }

  serialize(): string {
    return JSON.stringify({
      state: this.state,
      context: this.context,
      history: this.history,
    });
  }

  static deserialize(data: string): AgentStateMachine {
    const parsed = JSON.parse(data);
    const machine = new AgentStateMachine(parsed.context);
    machine.state = parsed.state;
    machine.history = parsed.history || [];
    return machine;
  }
}

export const createStateMachine = (initialContext?: Partial<AgentContext>): AgentStateMachine => {
  return new AgentStateMachine(initialContext);
};
