/**
 * 工具权限管理器
 * 管理工具调用的权限控制
 */

export interface ToolPermission {
  toolName: string;
  allowed: boolean;
  maxCallsPerTask?: number;
  requiresConfirmation?: boolean;
  allowedFilePatterns?: string[];
  deniedFilePatterns?: string[];
  allowedCommands?: string[];
  deniedCommands?: string[];
  description?: string;
}

export interface ToolCallContext {
  toolName: string;
  params: Record<string, any>;
  workspacePath: string;
  userApproved?: boolean;
  taskId?: string;
}

export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  requiresConfirmation?: boolean;
}

export class ToolPermissionManager {
  private permissions: Map<string, ToolPermission> = new Map();
  private callCounters: Map<string, Map<string, number>> = new Map();
  private confirmationCallbacks: Map<string, (approved: boolean) => void> = new Map();

  constructor() {
    this.initializeDefaultPermissions();
  }

  private initializeDefaultPermissions(): void {
    const defaultPermissions: ToolPermission[] = [
      {
        toolName: 'read_file',
        allowed: true,
        description: 'Read file contents',
      },
      {
        toolName: 'write_file',
        allowed: true,
        requiresConfirmation: true,
        description: 'Write or create files',
      },
      {
        toolName: 'edit_file',
        allowed: true,
        requiresConfirmation: true,
        description: 'Edit existing files',
      },
      {
        toolName: 'delete_file',
        allowed: false,
        requiresConfirmation: true,
        description: 'Delete files',
      },
      {
        toolName: 'create_directory',
        allowed: true,
        description: 'Create directories',
      },
      {
        toolName: 'delete_directory',
        allowed: false,
        requiresConfirmation: true,
        description: 'Delete directories',
      },
      {
        toolName: 'list_files',
        allowed: true,
        description: 'List files in directory',
      },
      {
        toolName: 'execute_command',
        allowed: false,
        requiresConfirmation: true,
        allowedCommands: ['npm install', 'npm run', 'git status', 'git diff'],
        description: 'Execute terminal commands',
      },
      {
        toolName: 'search_files',
        allowed: true,
        description: 'Search files by content',
      },
      {
        toolName: 'grep',
        allowed: true,
        description: 'Grep search',
      },
      {
        toolName: 'read_multiple_files',
        allowed: true,
        description: 'Read multiple files',
      },
      {
        toolName: 'web_search',
        allowed: true,
        description: 'Search the web',
      },
      {
        toolName: 'web_fetch',
        allowed: true,
        description: 'Fetch web pages',
      },
    ];

    for (const permission of defaultPermissions) {
      this.permissions.set(permission.toolName, permission);
    }
  }

  setPermission(permission: ToolPermission): void {
    this.permissions.set(permission.toolName, permission);
  }

  getPermission(toolName: string): ToolPermission | undefined {
    return this.permissions.get(toolName);
  }

  removePermission(toolName: string): boolean {
    return this.permissions.delete(toolName);
  }

  checkPermission(context: ToolCallContext): PermissionCheckResult {
    const permission = this.permissions.get(context.toolName);

    if (!permission) {
      return {
        allowed: false,
        reason: `Unknown tool: ${context.toolName}`,
      };
    }

    if (!permission.allowed) {
      return {
        allowed: false,
        reason: `Tool ${context.toolName} is not allowed`,
        requiresConfirmation: false,
      };
    }

    if (permission.requiresConfirmation && !context.userApproved) {
      return {
        allowed: true,
        reason: `Tool ${context.toolName} requires confirmation`,
        requiresConfirmation: true,
      };
    }

    if (permission.maxCallsPerTask && context.taskId) {
      const taskCounter = this.callCounters.get(context.taskId) || new Map();
      const currentCount = taskCounter.get(context.toolName) || 0;

      if (currentCount >= permission.maxCallsPerTask) {
        return {
          allowed: false,
          reason: `Tool ${context.toolName} has reached maximum call limit (${permission.maxCallsPerTask})`,
        };
      }

      taskCounter.set(context.toolName, currentCount + 1);
      this.callCounters.set(context.taskId, taskCounter);
    }

    const filePath = this.extractFilePath(context.params);
    if (filePath && permission.allowedFilePatterns) {
      const matches = permission.allowedFilePatterns.some((pattern) =>
        this.matchPattern(filePath, pattern)
      );

      if (!matches) {
        return {
          allowed: false,
          reason: `File ${filePath} does not match allowed patterns`,
        };
      }
    }

    if (filePath && permission.deniedFilePatterns) {
      const matches = permission.deniedFilePatterns.some((pattern) =>
        this.matchPattern(filePath, pattern)
      );

      if (matches) {
        return {
          allowed: false,
          reason: `File ${filePath} matches denied patterns`,
        };
      }
    }

    const command = this.extractCommand(context.params);
    if (command && permission.allowedCommands) {
      const matches = permission.allowedCommands.some((allowed) =>
        command.startsWith(allowed)
      );

      if (!matches) {
        return {
          allowed: false,
          reason: `Command "${command}" is not in the allowed list`,
        };
      }
    }

    return {
      allowed: true,
    };
  }

  async requestConfirmation(
    toolName: string,
    params: Record<string, any>
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const callbackId = `${toolName}-${Date.now()}`;
      this.confirmationCallbacks.set(callbackId, resolve);

      try {
        const win = globalThis as any;
        if (win?.electronAPI?.ipcRenderer) {
          win.electronAPI.ipcRenderer.send('tool-permission-request', {
            callbackId,
            toolName,
            params,
          });

          win.electronAPI.ipcRenderer.once(
            `tool-permission-response-${callbackId}`,
            (_event: any, approved: boolean) => {
              this.confirmationCallbacks.delete(callbackId);
              resolve(approved);
            }
          );
        } else {
          setTimeout(() => {
            this.confirmationCallbacks.delete(callbackId);
            resolve(false);
          }, 30000);
        }
      } catch {
        setTimeout(() => {
          this.confirmationCallbacks.delete(callbackId);
          resolve(false);
        }, 30000);
      }
    });
  }

  approveConfirmation(callbackId: string): void {
    const callback = this.confirmationCallbacks.get(callbackId);
    if (callback) {
      callback(true);
      this.confirmationCallbacks.delete(callbackId);
    }
  }

  denyConfirmation(callbackId: string): void {
    const callback = this.confirmationCallbacks.get(callbackId);
    if (callback) {
      callback(false);
      this.confirmationCallbacks.delete(callbackId);
    }
  }

  private extractFilePath(params: Record<string, any>): string | null {
    if (params.file_path) return params.file_path;
    if (params.path) return params.path;
    if (params.filePath) return params.filePath;
    if (params.dir_path) return params.dir_path;
    return null;
  }

  private extractCommand(params: Record<string, any>): string | null {
    if (params.command) return params.command;
    if (params.cmd) return params.cmd;
    if (params.shell) return params.shell;
    return null;
  }

  private matchPattern(path: string, pattern: string): boolean {
    const normalizedPath = path.replace(/\\/g, '/');
    const normalizedPattern = pattern.replace(/\\/g, '/');

    if (normalizedPattern.includes('*')) {
      const regexPattern = normalizedPattern
        .replace(/\./g, '\\.')
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*');

      try {
        return new RegExp(`^${regexPattern}$`).test(normalizedPath);
      } catch (error) {
        console.error('Invalid pattern:', pattern, error);
        return false;
      }
    }

    return normalizedPath.includes(normalizedPattern);
  }

  resetCallCounter(taskId: string): void {
    this.callCounters.delete(taskId);
  }

  getCallCount(taskId: string, toolName: string): number {
    const taskCounter = this.callCounters.get(taskId);
    return taskCounter?.get(toolName) || 0;
  }

  getAllPermissions(): ToolPermission[] {
    return Array.from(this.permissions.values());
  }

  getAllowedTools(): string[] {
    return Array.from(this.permissions.entries())
      .filter(([_, permission]) => permission.allowed)
      .map(([name]) => name);
  }

  getDangerousTools(): string[] {
    return Array.from(this.permissions.entries())
      .filter(([_, permission]) => permission.requiresConfirmation)
      .map(([name]) => name);
  }

  serialize(): string {
    return JSON.stringify(Array.from(this.permissions.entries()));
  }

  static deserialize(data: string): ToolPermissionManager {
    const manager = new ToolPermissionManager();
    const permissions = JSON.parse(data);

    manager.permissions.clear();
    for (const [name, permission] of permissions) {
      manager.permissions.set(name, permission);
    }

    return manager;
  }

  clear(): void {
    this.permissions.clear();
    this.callCounters.clear();
    this.confirmationCallbacks.clear();
  }
}

export const globalPermissionManager = new ToolPermissionManager();
