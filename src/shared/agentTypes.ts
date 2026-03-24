/**
 * Agent Types Re-export Module
 * Maintained for backward compatibility
 * All types are now defined in types.ts
 */

export {
  type AgentType,
  type AgentBehaviorConfig,
  type AgentCapabilityConfig,
  type AgentConfig,
  type AgentStep,
  type AgentToolCall,
  type AgentMessage,
  type AgentTask,
  type ExecutionPlanStep,
  type ExecutionPlan,
  type TodoItem,
  type AgentQuestion,
  type BuiltInAgentType,
  type AgentContext,
  type AnalyzedFile,
  type Requirement,
  type AgentCallbacks,
  type AgentError,
  type GeneratedFile,
  DEFAULT_BEHAVIOR_CONFIG,
  DEFAULT_CAPABILITY_CONFIG,
  BUILT_IN_AGENTS,
  createAgentConfig,
  getBuiltInAgents,
  type UnifiedAgentConfig,
  type UnifiedAgentTask,
  type UnifiedAgentMessage,
} from './types';
