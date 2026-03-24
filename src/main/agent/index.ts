/**
 * Agent 模块统一导出
 */

// Core
export {
  AgentStateMachine,
  createStateMachine,
  AgentContextManager,
  createAgentContext,
} from './core';

export type {
  AgentState,
  AgentEvent,
  AgentContext,
  ContextValidationResult,
} from './core';

// Strategies
export {
  ChatStrategy,
  BuilderStrategy,
  SoloStrategy,
  StrategyFactory,
  createStrategy,
  getAvailableStrategies,
} from './strategies';

export type {
  AgentStrategy,
  StrategyType,
  StrategyCallbacks,
  StrategyContext,
  StrategyResult,
} from './strategies';

// Tools
export {
  ToolRegistry,
  globalToolRegistry,
  ToolPermissionManager,
  globalPermissionManager,
} from './tools';

export type {
  Tool,
  ToolMetadata,
  ToolResult,
  ToolPermission,
  ToolCallContext,
  PermissionCheckResult,
} from './tools';

// Checkpoint
export { CheckpointManager } from './checkpoint';

export type {
  Checkpoint,
  CheckpointVersion,
  CheckpointStats,
} from './checkpoint';

// Error
export { ErrorRecoveryManager } from './error';

export type {
  ClassifiedError,
  RecoveryStrategy,
  RecoveryContext,
  RecoveryResult,
  ErrorLogEntry,
} from './error';
