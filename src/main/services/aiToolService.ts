import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// 扩展工具类型
export type ToolName = 
  | 'read_file' 
  | 'edit_file'
  | 'search_files' 
  | 'list_files'
  | 'execute_command'
  | 'grep_search'
  | 'glob_search'
  | 'get_file_info'
  | 'ask_followup_question'
  | 'attempt_completion';

export interface ToolDefinition {
  name: ToolName;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
}

export interface ToolCall {
  tool: ToolName;
  params: Record<string, any>;
  id?: string; // 原始工具调用ID（来自API）
}

export interface ToolResult {
  tool: ToolName;
  success: boolean;
  data?: any;
  error?: string;
}

// 完整的工具定义列表
export const TOOLS: ToolDefinition[] = [
  {
    name: 'read_file',
    description: '读取文件内容，支持读取文本文件的内容',
    parameters: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: '要读取的文件路径（相对于工作区）',
        },
        offset: {
          type: 'number',
          description: '起始行号（可选，用于读取部分文件）',
        },
        limit: {
          type: 'number',
          description: '读取行数限制（可选）',
        },
      },
      required: ['file_path'],
    },
  },
  {
    name: 'edit_file',
    description: '编辑现有文件，使用搜索替换方式修改',
    parameters: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: '要编辑的文件路径',
        },
        old_string: {
          type: 'string',
          description: '要替换的原始字符串（必须精确匹配）',
        },
        new_string: {
          type: 'string',
          description: '替换后的新字符串',
        },
      },
      required: ['file_path', 'old_string', 'new_string'],
    },
  },
  {
    name: 'search_files',
    description: '在项目中搜索文件内容，支持正则表达式',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '搜索关键词或正则表达式',
        },
        file_pattern: {
          type: 'string',
          description: '文件匹配模式，如 "*.ts"（可选）',
        },
        path: {
          type: 'string',
          description: '搜索路径（可选，默认为根目录）',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'list_files',
    description: '列出目录中的文件和子目录',
    parameters: {
      type: 'object',
      properties: {
        dir_path: {
          type: 'string',
          description: '目录路径（相对于工作区，可选，默认为根目录）',
        },
        recursive: {
          type: 'boolean',
          description: '是否递归列出子目录',
        },
      },
      required: [],
    },
  },
  {
    name: 'execute_command',
    description: '在终端中执行命令',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: '要执行的命令',
        },
        cwd: {
          type: 'string',
          description: '工作目录（可选，默认为项目根目录）',
        },
        timeout: {
          type: 'number',
          description: '超时时间（毫秒，可选，默认60000）',
        },
      },
      required: ['command'],
    },
  },
  {
    name: 'grep_search',
    description: '使用 grep 风格的搜索（快速全文搜索）',
    parameters: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: '搜索模式',
        },
        path: {
          type: 'string',
          description: '搜索路径',
        },
        include: {
          type: 'string',
          description: '包含的文件模式',
        },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'glob_search',
    description: '使用 glob 模式搜索文件',
    parameters: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'glob 模式，如 "**/*.ts"',
        },
        cwd: {
          type: 'string',
          description: '工作目录',
        },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'get_file_info',
    description: '获取文件的详细信息（大小、修改时间等）',
    parameters: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: '文件路径',
        },
      },
      required: ['file_path'],
    },
  },
  {
    name: 'ask_followup_question',
    description: '当需要更多信息时向用户提问',
    parameters: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: '问题内容',
        },
        options: {
          type: 'array',
          description: '选项列表（如果是选择题）',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              label: { type: 'string' },
              value: { type: 'string' },
            },
          },
        },
      },
      required: ['question'],
    },
  },
  {
    name: 'attempt_completion',
    description: '完成任务并返回结果',
    parameters: {
      type: 'object',
      properties: {
        result: {
          type: 'string',
          description: '任务完成结果描述',
        },
        command: {
          type: 'string',
          description: '建议用户运行的命令（可选）',
        },
      },
      required: ['result'],
    },
  },
];

export class AIToolService {
  private workspacePath: string;

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
  }

  /**
   * 执行工具调用
   */
  async executeTool(toolCall: ToolCall): Promise<ToolResult> {
    const { tool, params } = toolCall;

    try {
      switch (tool) {
        case 'read_file':
          return await this.readFile(params.file_path, params.offset, params.limit);
        case 'edit_file':
          return await this.editFile(params.file_path, params.old_string, params.new_string);
        case 'search_files':
          return await this.searchFiles(params.query, params.file_pattern, params.path);
        case 'list_files':
          return await this.listFiles(params.dir_path || '', params.recursive || false);
        case 'execute_command':
          return await this.executeCommand(params.command, params.cwd, params.timeout);
        case 'grep_search':
          return await this.grepSearch(params.pattern, params.path, params.include);
        case 'glob_search':
          return await this.globSearch(params.pattern, params.cwd);
        case 'get_file_info':
          return await this.getFileInfo(params.file_path);
        case 'ask_followup_question':
          return {
            tool: 'ask_followup_question',
            success: true,
            data: { question: params.question, options: params.options },
          };
        case 'attempt_completion':
          return {
            tool: 'attempt_completion',
            success: true,
            data: { result: params.result, command: params.command },
          };
        default:
          return {
            tool,
            success: false,
            error: `未知工具: ${tool}`,
          };
      }
    } catch (error) {
      return {
        tool,
        success: false,
        error: String(error),
      };
    }
  }

  /**
   * 读取文件
   */
  private async readFile(filePath: string, offset?: number, limit?: number): Promise<ToolResult> {
    const fullPath = path.join(this.workspacePath, filePath);
    let content = await fs.readFile(fullPath, 'utf-8');

    // 如果指定了行范围
    if (offset !== undefined || limit !== undefined) {
      const lines = content.split('\n');
      const start = offset || 0;
      const end = limit ? start + limit : lines.length;
      content = lines.slice(start, end).join('\n');
    }

    return {
      tool: 'read_file',
      success: true,
      data: { content, file_path: filePath },
    };
  }

  /**
   * 编辑文件（搜索替换）
   */
  private async editFile(filePath: string, oldString: string, newString: string): Promise<ToolResult> {
    const fullPath = path.join(this.workspacePath, filePath);
    const content = await fs.readFile(fullPath, 'utf-8');

    if (!content.includes(oldString)) {
      return {
        tool: 'edit_file',
        success: false,
        error: `在文件中找不到指定的字符串: "${oldString.substring(0, 50)}..."`,
      };
    }

    const newContent = content.replace(oldString, newString);
    await fs.writeFile(fullPath, newContent, 'utf-8');

    // 通知前端
    this.notifyFileChange(filePath, newContent);

    return {
      tool: 'edit_file',
      success: true,
      data: { file_path: filePath, replacements: 1 },
    };
  }

  /**
   * 搜索文件
   */
  private async searchFiles(query: string, filePattern?: string, searchPath?: string): Promise<ToolResult> {
    const results: Array<{ file: string; line: number; content: string; match: string }> = [];
    const basePath = searchPath ? path.join(this.workspacePath, searchPath) : this.workspacePath;

    const searchDir = async (dir: string) => {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') {
          continue;
        }

        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          await searchDir(fullPath);
        } else {
          if (filePattern && !entry.name.match(filePattern.replace('*', '.*'))) {
            continue;
          }

          try {
            const content = await fs.readFile(fullPath, 'utf-8');
            const lines = content.split('\n');
            const relativePath = path.relative(this.workspacePath, fullPath);

            lines.forEach((line, index) => {
              if (line.includes(query)) {
                results.push({
                  file: relativePath,
                  line: index + 1,
                  content: line.trim(),
                  match: query,
                });
              }
            });
          } catch (e) {
            // Skip binary files
          }
        }
      }
    };

    await searchDir(basePath);

    return {
      tool: 'search_files',
      success: true,
      data: { 
        results: results.slice(0, 50),
        total_count: results.length,
        query,
      },
    };
  }

  /**
   * 列出文件
   */
  private async listFiles(dirPath: string, recursive: boolean): Promise<ToolResult> {
    const fullPath = path.join(this.workspacePath, dirPath);
    const files: Array<{ path: string; type: 'file' | 'directory' }> = [];

    const listDir = async (dir: string, prefix: string = '') => {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') {
          continue;
        }

        const relativePath = path.join(prefix, entry.name);

        if (entry.isDirectory()) {
          files.push({ path: relativePath, type: 'directory' });
          if (recursive) {
            await listDir(path.join(dir, entry.name), relativePath);
          }
        } else {
          files.push({ path: relativePath, type: 'file' });
        }
      }
    };

    await listDir(fullPath);

    return {
      tool: 'list_files',
      success: true,
      data: { files, count: files.length },
    };
  }

  /**
   * 执行命令
   */
  private async executeCommand(command: string, cwd?: string, timeout: number = 60000): Promise<ToolResult> {
    try {
      const workingDir = cwd ? path.join(this.workspacePath, cwd) : this.workspacePath;
      const { stdout, stderr } = await execAsync(command, {
        cwd: workingDir,
        timeout,
        maxBuffer: 10 * 1024 * 1024, // 10MB
      });

      return {
        tool: 'execute_command',
        success: true,
        data: {
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          command,
        },
      };
    } catch (error: any) {
      return {
        tool: 'execute_command',
        success: false,
        error: error.message,
        data: {
          stdout: error.stdout || '',
          stderr: error.stderr || '',
          exitCode: error.code,
        },
      };
    }
  }

  /**
   * Grep 搜索
   */
  private async grepSearch(pattern: string, searchPath?: string, include?: string): Promise<ToolResult> {
    try {
      const basePath = searchPath ? path.join(this.workspacePath, searchPath) : this.workspacePath;
      let command = `grep -r -n "${pattern}" "${basePath}"`;
      
      if (include) {
        command += ` --include="${include}"`;
      }
      
      // 排除常见目录
      command += ' --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist';

      const { stdout } = await execAsync(command, { timeout: 30000 });
      
      const results = stdout.split('\n').filter(Boolean).map(line => {
        const match = line.match(/^(.+):(\d+):(.+)$/);
        if (match) {
          return {
            file: path.relative(this.workspacePath, match[1]),
            line: parseInt(match[2]),
            content: match[3].trim(),
          };
        }
        return null;
      }).filter(Boolean);

      return {
        tool: 'grep_search',
        success: true,
        data: { results },
      };
    } catch (error: any) {
      // grep 没有找到结果时会返回 exit code 1
      if (error.code === 1) {
        return {
          tool: 'grep_search',
          success: true,
          data: { results: [] },
        };
      }
      return {
        tool: 'grep_search',
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Glob 搜索
   */
  private async globSearch(pattern: string, cwd?: string): Promise<ToolResult> {
    try {
      const { glob } = await import('glob');
      const workingDir = cwd ? path.join(this.workspacePath, cwd) : this.workspacePath;
      
      const files = await glob(pattern, {
        cwd: workingDir,
        ignore: ['node_modules/**', '.git/**', 'dist/**'],
        absolute: false,
      });

      return {
        tool: 'glob_search',
        success: true,
        data: { files, count: files.length },
      };
    } catch (error: any) {
      return {
        tool: 'glob_search',
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 获取文件信息
   */
  private async getFileInfo(filePath: string): Promise<ToolResult> {
    const fullPath = path.join(this.workspacePath, filePath);
    const stats = await fs.stat(fullPath);

    return {
      tool: 'get_file_info',
      success: true,
      data: {
        file_path: filePath,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        accessed: stats.atime,
        is_directory: stats.isDirectory(),
        is_file: stats.isFile(),
      },
    };
  }

  /**
   * 通知前端文件内容正在更新（逐步写入）
   */
  private notifyFileProgress(filePath: string, content: string, isComplete: boolean = false): void {
    const { BrowserWindow } = require('electron');
    BrowserWindow.getAllWindows().forEach((window: any) => {
      window.webContents.send('file:progress', {
        filePath,
        content,
        isComplete,
      });
    });
  }

  /**
   * 通知前端文件已变更（最终版本）
   */
  private notifyFileChange(filePath: string, content: string): void {
    const { BrowserWindow } = require('electron');
    BrowserWindow.getAllWindows().forEach((window: any) => {
      window.webContents.send('file:changed', {
        filePath,
        content,
      });
    });
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 逐步写入文件内容，模拟打字效果
   */
  private async writeFileIncremental(filePath: string, content: string): Promise<void> {
    const fullPath = path.join(this.workspacePath, filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    
    const chunkSize = 80;
    let currentContent = '';
    
    for (let i = 0; i < content.length; i += chunkSize) {
      const chunk = content.slice(i, i + chunkSize);
      currentContent += chunk;
      
      this.notifyFileProgress(filePath, currentContent, false);
      await this.delay(10);
    }
    
    await fs.writeFile(fullPath, content, 'utf-8');
    this.notifyFileProgress(filePath, content, true);
  }

  /**
   * 从 AI 响应中解析工具调用
   * 支持多种格式：<tool>、<minimax:tool_call>、<tool_call> 等
   */
  parseToolCalls(response: string): ToolCall[] {
    const toolCalls: ToolCall[] = [];

    const patterns = [
      { regex: /<tool>([\s\S]*?)<\/tool>/g, type: 'json' },
      { regex: /<minimax:tool_call>([\s\S]*?)<\/minimax:tool_call>/g, type: 'xml' },
      { regex: /<tool_call>([\s\S]*?)<\/tool_call>/g, type: 'xml' },
      { regex: /```(?:json)?\s*\n?([\s\S]*?)\n?```/g, type: 'json' },
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.regex.exec(response)) !== null) {
        try {
          const content = match[1].trim();
          let toolData: any;

          if (pattern.type === 'json') {
            toolData = JSON.parse(content);
          } else if (pattern.type === 'xml') {
            toolData = this.parseXmlToolCall(content);
          }

          if (toolData && (toolData.tool || toolData.name) && toolData.params) {
            toolCalls.push({
              tool: toolData.tool || toolData.name,
              params: toolData.params,
            });
          }
        } catch (e) {
          console.log('Failed to parse tool call:', e);
        }
      }
    }

    return toolCalls;
  }

  /**
   * 解析 XML 格式的工具调用
   */
  private parseXmlToolCall(xml: string): { tool: string; params: Record<string, any> } | null {
    try {
      const invokeMatch = xml.match(/<invoke>([\s\S]*?)<\/invoke>/);
      if (!invokeMatch) return null;

      const invokeContent = invokeMatch[1];
      const nameMatch = invokeContent.match(/name="([^"]+)"/) || xml.match(/<tool>([^<]+)<\/tool>/);
      const toolName = nameMatch ? nameMatch[1] : 'unknown';

      const params: Record<string, any> = {};
      const paramRegex = /<parameter\s+name="([^"]+)">([\s\S]*?)<\/parameter>/g;
      let paramMatch;

      while ((paramMatch = paramRegex.exec(invokeContent)) !== null) {
        const paramName = paramMatch[1];
        const paramValue = paramMatch[2].trim();
        params[paramName] = paramValue;
      }

      return { tool: toolName, params };
    } catch (e) {
      return null;
    }
  }

  /**
   * 获取工具定义的系统提示词
   */
  getToolsSystemPrompt(): string {
    const toolsDescription = TOOLS.map((tool) => {
      const params = Object.entries(tool.parameters.properties)
        .map(([key, value]: [string, any]) => {
          const required = tool.parameters.required.includes(key) ? ' (required)' : ' (optional)';
          return `    - ${key}: ${value.description}${required}`;
        })
        .join('\n');

      return `### ${tool.name}
${tool.description}
参数:
${params}`;
    }).join('\n\n');

    return `你可以使用以下工具来操作项目文件和执行命令：

${toolsDescription}

使用工具的格式（JSON格式）：
<tool>
{
  "tool": "工具名称",
  "params": {
    "参数名": "参数值"
  }
}
</tool>

或者使用 XML 格式：
<tool_call>
<invoke>
<tool>工具名称</tool>
<parameter name="参数名">参数值</parameter>
</invoke>
</tool_call>

你可以在一次响应中使用多个工具。工具会被自动执行，执行结果会返回给你。

重要规则：
1. 先使用工具了解项目结构和文件内容
2. 根据工具返回的结果进行操作
3. 修改文件前先读取文件内容
4. 使用 edit_file 时，old_string 必须精确匹配文件中的内容
5. 工具调用必须严格使用上述格式，确保可以被正确解析`;
  }

  /**
   * 获取 MCP 风格的工具定义（用于 Function Call）
   */
  getMcpTools(): any[] {
    return TOOLS.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }
}
