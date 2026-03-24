/**
 * 工具注册表
 * 管理 Agent 可用的所有工具
 */

export interface ToolMetadata {
  name: string;
  description: string;
  category: 'file' | 'terminal' | 'search' | 'code' | 'system';
  parameters: Array<{
    name: string;
    type: string;
    required: boolean;
    description?: string;
  }>;
  returns?: {
    type: string;
    description: string;
  };
  examples?: string[];
  dangerLevel?: 'safe' | 'warning' | 'dangerous';
}

export interface Tool {
  name: string;
  execute(params: Record<string, any>): Promise<ToolResult>;
  metadata: ToolMetadata;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  executionTime?: number;
}

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();
  private metadata: Map<string, ToolMetadata> = new Map();

  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      console.warn(`Tool ${tool.name} is already registered. Overwriting.`);
    }

    this.tools.set(tool.name, tool);
    this.metadata.set(tool.name, tool.metadata);
  }

  unregister(toolName: string): boolean {
    const deleted = this.tools.delete(toolName);
    this.metadata.delete(toolName);
    return deleted;
  }

  get(toolName: string): Tool | undefined {
    return this.tools.get(toolName);
  }

  getMetadata(toolName: string): ToolMetadata | undefined {
    return this.metadata.get(toolName);
  }

  has(toolName: string): boolean {
    return this.tools.has(toolName);
  }

  listTools(): string[] {
    return Array.from(this.tools.keys());
  }

  listToolsByCategory(category: ToolMetadata['category']): string[] {
    const tools: string[] = [];

    for (const [name, metadata] of this.metadata.entries()) {
      if (metadata.category === category) {
        tools.push(name);
      }
    }

    return tools;
  }

  getAllMetadata(): ToolMetadata[] {
    return Array.from(this.metadata.values());
  }

  getToolsByCategory(): Record<ToolMetadata['category'], ToolMetadata[]> {
    const result: Record<ToolMetadata['category'], ToolMetadata[]> = {
      file: [],
      terminal: [],
      search: [],
      code: [],
      system: [],
    };

    for (const metadata of this.metadata.values()) {
      result[metadata.category].push(metadata);
    }

    return result;
  }

  async execute(toolName: string, params: Record<string, any>): Promise<ToolResult> {
    const tool = this.tools.get(toolName);

    if (!tool) {
      return {
        success: false,
        error: `Tool ${toolName} not found`,
      };
    }

    const startTime = Date.now();

    try {
      const result = await tool.execute(params);
      result.executionTime = Date.now() - startTime;
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime,
      };
    }
  }

  getToolInfo(toolName: string): { name: string; description: string; category: string } | null {
    const metadata = this.metadata.get(toolName);

    if (!metadata) {
      return null;
    }

    return {
      name: metadata.name,
      description: metadata.description,
      category: metadata.category,
    };
  }

  searchTools(query: string): ToolMetadata[] {
    const lowerQuery = query.toLowerCase();
    const results: ToolMetadata[] = [];

    for (const metadata of this.metadata.values()) {
      if (
        metadata.name.toLowerCase().includes(lowerQuery) ||
        metadata.description.toLowerCase().includes(lowerQuery)
      ) {
        results.push(metadata);
      }
    }

    return results;
  }

  getDangerousTools(): ToolMetadata[] {
    return Array.from(this.metadata.values()).filter(
      (metadata) => metadata.dangerLevel === 'dangerous'
    );
  }

  clear(): void {
    this.tools.clear();
    this.metadata.clear();
  }

  getStats(): {
    totalTools: number;
    byCategory: Record<ToolMetadata['category'], number>;
    dangerousCount: number;
  } {
    const byCategory = this.getToolsByCategory();

    return {
      totalTools: this.tools.size,
      byCategory: {
        file: byCategory.file.length,
        terminal: byCategory.terminal.length,
        search: byCategory.search.length,
        code: byCategory.code.length,
        system: byCategory.system.length,
      },
      dangerousCount: this.getDangerousTools().length,
    };
  }

  serialize(): string {
    const tools = Array.from(this.tools.entries()).map(([name, tool]) => ({
      name,
      metadata: tool.metadata,
    }));

    return JSON.stringify(tools);
  }

  static deserialize(data: string): ToolRegistry {
    const registry = new ToolRegistry();
    const tools = JSON.parse(data);

    for (const toolData of tools) {
      const tool: Tool = {
        name: toolData.name,
        metadata: toolData.metadata,
        execute: async () => ({ success: false, error: 'Tool not implemented' }),
      };

      registry.register(tool);
    }

    return registry;
  }
}

export const globalToolRegistry = new ToolRegistry();
