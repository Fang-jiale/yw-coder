/**
 * Agent Context 管理器
 * 管理 Agent 执行过程中的上下文信息
 */

import type { AgentTask, AgentMessage, AgentStep, TodoItem } from '../../../shared/agentTypes';

export interface AgentContextData {
  taskId: string;
  workspacePath: string;
  taskTitle: string;
  taskDescription: string;
  projectType?: string;
  techStack?: string[];
  dependencies?: string[];
  files?: string[];
  analyzedFiles?: Array<{
    path: string;
    purpose: string;
    dependencies: string[];
    exports: string[];
  }>;
  requirements?: Array<{
    id: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    status: 'pending' | 'in_progress' | 'completed';
  }>;
  metadata?: Record<string, unknown>;
}

export interface ContextValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class AgentContextManager {
  private context: AgentContextData;
  private validationRules: Map<string, (context: AgentContextData) => string | null> = new Map();

  constructor(initialContext: Partial<AgentContextData> & { taskId: string; workspacePath: string }) {
    this.context = {
      taskId: initialContext.taskId,
      workspacePath: initialContext.workspacePath,
      taskTitle: initialContext.taskTitle || '',
      taskDescription: initialContext.taskDescription || '',
    };

    this.initializeValidationRules();
  }

  private initializeValidationRules(): void {
    this.validationRules.set('taskId', (ctx) =>
      ctx.taskId ? null : 'Task ID is required'
    );

    this.validationRules.set('workspacePath', (ctx) =>
      ctx.workspacePath ? null : 'Workspace path is required'
    );

    this.validationRules.set('taskDescription', (ctx) => {
      if (!ctx.taskDescription) {
        return 'Task description is empty';
      }
      if (ctx.taskDescription.length < 10) {
        return 'Task description is too short';
      }
      return null;
    });
  }

  getContext(): AgentContextData {
    return { ...this.context };
  }

  updateContext(updates: Partial<AgentContextData>): void {
    this.context = {
      ...this.context,
      ...updates,
    };
  }

  setProjectInfo(projectType: string, techStack: string[], dependencies: string[]): void {
    this.context.projectType = projectType;
    this.context.techStack = techStack;
    this.context.dependencies = dependencies;
  }

  setFiles(files: string[]): void {
    this.context.files = files;
  }

  addAnalyzedFile(file: { path: string; purpose: string; dependencies: string[]; exports: string[] }): void {
    if (!this.context.analyzedFiles) {
      this.context.analyzedFiles = [];
    }
    this.context.analyzedFiles.push(file);
  }

  addRequirement(requirement: { id: string; description: string; priority: 'high' | 'medium' | 'low'; status: 'pending' | 'in_progress' | 'completed' }): void {
    if (!this.context.requirements) {
      this.context.requirements = [];
    }
    this.context.requirements.push(requirement);
  }

  updateRequirement(requirementId: string, updates: Partial<{ id: string; description: string; priority: 'high' | 'medium' | 'low'; status: 'pending' | 'in_progress' | 'completed' }>): void {
    if (!this.context.requirements) return;

    const requirement = this.context.requirements.find(r => r.id === requirementId);
    if (requirement) {
      Object.assign(requirement, updates);
    }
  }

  setMetadata(key: string, value: unknown): void {
    if (!this.context.metadata) {
      this.context.metadata = {};
    }
    this.context.metadata[key] = value;
  }

  getMetadata<T = unknown>(key: string): T | undefined {
    return this.context.metadata?.[key] as T | undefined;
  }

  validate(): ContextValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const [ruleName, validator] of this.validationRules.entries()) {
      const error = validator(this.context);
      if (error) {
        errors.push(error);
      }
    }

    if (!this.context.techStack || this.context.techStack.length === 0) {
      warnings.push('No tech stack detected');
    }

    if (!this.context.files || this.context.files.length === 0) {
      warnings.push('No files in workspace');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  toTaskContext(): {
    projectType?: string;
    techStack?: string[];
    dependencies?: string[];
    files?: string[];
    analyzedFiles?: AgentContextData['analyzedFiles'];
    requirements?: AgentContextData['requirements'];
  } {
    return {
      projectType: this.context.projectType,
      techStack: this.context.techStack,
      dependencies: this.context.dependencies,
      files: this.context.files,
      analyzedFiles: this.context.analyzedFiles,
      requirements: this.context.requirements,
    };
  }

  serialize(): string {
    return JSON.stringify(this.context);
  }

  static deserialize(data: string): AgentContextManager {
    const parsed = JSON.parse(data) as AgentContextData;
    return new AgentContextManager(parsed);
  }

  clone(): AgentContextManager {
    const cloned = new AgentContextManager({
      taskId: this.context.taskId,
      workspacePath: this.context.workspacePath,
      taskTitle: this.context.taskTitle,
      taskDescription: this.context.taskDescription,
    });

    cloned.context = JSON.parse(JSON.stringify(this.context));
    return cloned;
  }

  getSummary(): {
    taskId: string;
    projectType: string | undefined;
    fileCount: number;
    requirementCount: number;
    analyzedFileCount: number;
  } {
    return {
      taskId: this.context.taskId,
      projectType: this.context.projectType,
      fileCount: this.context.files?.length || 0,
      requirementCount: this.context.requirements?.length || 0,
      analyzedFileCount: this.context.analyzedFiles?.length || 0,
    };
  }

  clear(): void {
    this.context.files = undefined;
    this.context.analyzedFiles = undefined;
    this.context.requirements = undefined;
    this.context.metadata = undefined;
  }
}

export const createAgentContext = (
  taskId: string,
  workspacePath: string,
  taskTitle?: string,
  taskDescription?: string
): AgentContextManager => {
  return new AgentContextManager({
    taskId,
    workspacePath,
    taskTitle,
    taskDescription,
  });
};
