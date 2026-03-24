/**
 * Agent 工具模块导出
 */

export {
  ToolRegistry,
  globalToolRegistry,
  type Tool,
  type ToolMetadata,
  type ToolResult,
} from './ToolRegistry';

export {
  ToolPermissionManager,
  globalPermissionManager,
  type ToolPermission,
  type ToolCallContext,
  type PermissionCheckResult,
} from './ToolPermissionManager';
