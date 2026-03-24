import OpenAI from 'openai';
import * as fs from 'fs/promises';
import * as path from 'path';
import { AIProviderConfig } from '../../shared/types';
import { PREDEFINED_PROVIDERS } from './aiProvider';
import {
  AICommand,
  CodeEditOperation,
  ToolType,
  BUILTIN_COMMANDS,
  buildUserPrompt,
  parseCodeEdits,
  getCommand,
} from '../../shared/aiCommands';

export interface ProjectContext {
  workspacePath: string;
  fileTree: string;
  openFiles: Array<{ path: string; content: string }>;
  currentFile?: string;
}

export interface CodeSelection {
  filePath: string;
  code: string;
  startLine: number;
  endLine: number;
  language: string;
}

/**
 * 工具执行结果
 */
export interface ToolResult {
  tool: ToolType;
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * AI 执行结果
 */
export interface AIExecutionResult {
  message: string;
  codeEdits: CodeEditOperation[];
  toolResults: ToolResult[];
}

/**
 * AI Skill Service - 支持工具调用的智能代码助手
 * 参考 Claude Code 设计，实现真正的代码编辑能力
 */
export class AISkillService {
  private clients: Map<string, OpenAI> = new Map();

  private getClient(config: AIProviderConfig): OpenAI {
    if (this.clients.has(config.id)) {
      return this.clients.get(config.id)!;
    }

    const providerInfo = PREDEFINED_PROVIDERS[config.provider];
    const baseURL = config.baseUrl || providerInfo?.defaultBaseUrl || 'https://api.openai.com/v1';

    const client = new OpenAI({
      apiKey: config.apiKey,
      baseURL,
      timeout: 120000,
    });

    this.clients.set(config.id, client);
    return client;
  }

  private getModel(config: AIProviderConfig): string {
    const providerInfo = PREDEFINED_PROVIDERS[config.provider];
    return config.model || providerInfo?.defaultModel || 'gpt-4o';
  }

  clearCache(configId?: string): void {
    if (configId) {
      this.clients.delete(configId);
    } else {
      this.clients.clear();
    }
  }

  /**
   * 获取项目上下文
   */
  async getProjectContext(
    workspacePath: string,
    openFilePaths: string[] = []
  ): Promise<ProjectContext> {
    const fileTree = await this.buildFileTree(workspacePath);
    const openFiles: Array<{ path: string; content: string }> = [];

    for (const filePath of openFilePaths.slice(0, 5)) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        openFiles.push({ path: filePath, content });
      } catch (e) {
        // Skip files that can't be read
      }
    }

    return {
      workspacePath,
      fileTree,
      openFiles,
    };
  }

  /**
   * 构建文件树
   */
  private async buildFileTree(
    dirPath: string,
    maxDepth: number = 3,
    currentDepth: number = 0
  ): Promise<string> {
    if (currentDepth >= maxDepth) {
      return '';
    }

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const lines: string[] = [];

      for (const entry of entries) {
        if (
          entry.name.startsWith('.') ||
          entry.name === 'node_modules' ||
          entry.name === 'dist' ||
          entry.name === 'build' ||
          entry.name === '__pycache__'
        ) {
          continue;
        }

        const indent = '  '.repeat(currentDepth);
        if (entry.isDirectory()) {
          lines.push(`${indent}${entry.name}/`);
          const subTree = await this.buildFileTree(
            path.join(dirPath, entry.name),
            maxDepth,
            currentDepth + 1
          );
          if (subTree) {
            lines.push(subTree);
          }
        } else {
          lines.push(`${indent}${entry.name}`);
        }
      }

      return lines.join('\n');
    } catch (e) {
      return '';
    }
  }

  /**
   * 格式化上下文为提示词
   */
  formatContext(context: ProjectContext): string {
    let prompt = `## 项目结构\n\`\`\`\n${context.fileTree}\n\`\`\`\n\n`;

    if (context.openFiles.length > 0) {
      prompt += `## 打开的文件\n`;
      for (const file of context.openFiles) {
        const relativePath = path.relative(context.workspacePath, file.path);
        prompt += `\n### ${relativePath}\n\`\`\`${this.getLanguage(file.path)}\n${file.content.slice(0, 3000)}\n\`\`\`\n`;
      }
    }

    return prompt;
  }

  /**
   * 获取文件语言
   */
  private getLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const languageMap: Record<string, string> = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.go': 'go',
      '.rs': 'rust',
      '.rb': 'ruby',
      '.php': 'php',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.json': 'json',
      '.md': 'markdown',
      '.sql': 'sql',
      '.sh': 'shell',
    };
    return languageMap[ext] || 'plaintext';
  }

  /**
   * 执行工具
   */
  async executeTool(
    tool: ToolType,
    params: Record<string, any>,
    workspacePath: string
  ): Promise<ToolResult> {
    try {
      switch (tool) {
        case 'Read':
          return await this.toolRead(params.filePath, workspacePath);
        case 'Write':
          return await this.toolWrite(params.filePath, params.content, workspacePath);
        case 'Edit':
          return await this.toolEdit(
            params.filePath,
            params.originalCode,
            params.newCode,
            workspacePath
          );
        case 'Grep':
          return await this.toolGrep(params.pattern, workspacePath, params.glob);
        case 'Glob':
          return await this.toolGlob(params.pattern, workspacePath);
        default:
          return { tool, success: false, error: `未知工具: ${tool}` };
      }
    } catch (error) {
      return { tool, success: false, error: String(error) };
    }
  }

  /**
   * 工具: 读取文件
   */
  private async toolRead(
    filePath: string,
    workspacePath: string
  ): Promise<ToolResult> {
    try {
      const fullPath = path.isAbsolute(filePath)
        ? filePath
        : path.join(workspacePath, filePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      return {
        tool: 'Read',
        success: true,
        data: { filePath, content, exists: true },
      };
    } catch (error) {
      return {
        tool: 'Read',
        success: false,
        error: `无法读取文件 ${filePath}: ${error}`,
      };
    }
  }

  /**
   * 工具: 写入文件
   */
  private async toolWrite(
    filePath: string,
    content: string,
    workspacePath: string
  ): Promise<ToolResult> {
    try {
      const fullPath = path.isAbsolute(filePath)
        ? filePath
        : path.join(workspacePath, filePath);

      // 确保目录存在
      const dir = path.dirname(fullPath);
      await fs.mkdir(dir, { recursive: true });

      await fs.writeFile(fullPath, content, 'utf-8');
      return {
        tool: 'Write',
        success: true,
        data: { filePath, created: true },
      };
    } catch (error) {
      return {
        tool: 'Write',
        success: false,
        error: `无法写入文件 ${filePath}: ${error}`,
      };
    }
  }

  /**
   * 工具: 编辑文件
   */
  private async toolEdit(
    filePath: string,
    originalCode: string,
    newCode: string,
    workspacePath: string
  ): Promise<ToolResult> {
    try {
      const fullPath = path.isAbsolute(filePath)
        ? filePath
        : path.join(workspacePath, filePath);

      const content = await fs.readFile(fullPath, 'utf-8');

      if (!content.includes(originalCode)) {
        return {
          tool: 'Edit',
          success: false,
          error: '找不到要替换的原始代码',
        };
      }

      const newContent = content.replace(originalCode, newCode);
      await fs.writeFile(fullPath, newContent, 'utf-8');

      return {
        tool: 'Edit',
        success: true,
        data: { filePath, modified: true },
      };
    } catch (error) {
      return {
        tool: 'Edit',
        success: false,
        error: `无法编辑文件 ${filePath}: ${error}`,
      };
    }
  }

  /**
   * 工具: 搜索代码
   */
  private async toolGrep(
    pattern: string,
    workspacePath: string,
    glob?: string
  ): Promise<ToolResult> {
    try {
      const results: Array<{ file: string; line: number; content: string }> = [];

      // 简化的递归搜索实现
      const searchDir = async (dir: string) => {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          if (
            entry.name.startsWith('.') ||
            entry.name === 'node_modules' ||
            entry.name === 'dist' ||
            entry.name === 'build'
          ) {
            continue;
          }

          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            await searchDir(fullPath);
          } else {
            // 检查文件扩展名
            if (glob && !entry.name.match(glob.replace('*', '.*'))) {
              continue;
            }

            try {
              const content = await fs.readFile(fullPath, 'utf-8');
              const lines = content.split('\n');

              lines.forEach((line, index) => {
                if (line.includes(pattern)) {
                  results.push({
                    file: path.relative(workspacePath, fullPath),
                    line: index + 1,
                    content: line.trim(),
                  });
                }
              });
            } catch (e) {
              // Skip binary or unreadable files
            }
          }
        }
      };

      await searchDir(workspacePath);

      return {
        tool: 'Grep',
        success: true,
        data: { pattern, results: results.slice(0, 50) },
      };
    } catch (error) {
      return {
        tool: 'Grep',
        success: false,
        error: `搜索失败: ${error}`,
      };
    }
  }

  /**
   * 工具: 查找文件
   */
  private async toolGlob(
    pattern: string,
    workspacePath: string
  ): Promise<ToolResult> {
    try {
      const files: string[] = [];
      const regex = new RegExp(pattern.replace('*', '.*').replace('?', '.'));

      const searchDir = async (dir: string) => {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          if (
            entry.name.startsWith('.') ||
            entry.name === 'node_modules' ||
            entry.name === 'dist' ||
            entry.name === 'build'
          ) {
            continue;
          }

          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            await searchDir(fullPath);
          } else if (regex.test(entry.name)) {
            files.push(path.relative(workspacePath, fullPath));
          }
        }
      };

      await searchDir(workspacePath);

      return {
        tool: 'Glob',
        success: true,
        data: { pattern, files: files.slice(0, 50) },
      };
    } catch (error) {
      return {
        tool: 'Glob',
        success: false,
        error: `查找失败: ${error}`,
      };
    }
  }

  /**
   * 执行 AI 命令
   * 核心方法：解析命令、调用 AI、解析响应、执行代码编辑
   */
  async executeCommand(
    input: string,
    workspacePath: string,
    config: AIProviderConfig,
    context: {
      openFilePaths?: string[];
      selection?: CodeSelection;
    } = {}
  ): Promise<AIExecutionResult> {
    const client = this.getClient(config);
    const model = this.getModel(config);

    // 1. 解析命令
    const { commandId, args } = this.parseInput(input);
    const command = getCommand(commandId);

    if (!command) {
      return {
        message: `未知命令: ${commandId}。可用命令: ${BUILTIN_COMMANDS.map((c) => c.id).join(', ')}`,
        codeEdits: [],
        toolResults: [],
      };
    }

    // 2. 检查是否需要选中的代码
    if (command.requiresSelection && !context.selection) {
      return {
        message: `命令 /${command.id} 需要选中的代码。请先选择一段代码。`,
        codeEdits: [],
        toolResults: [],
      };
    }

    // 3. 获取项目上下文
    const projectContext = await this.getProjectContext(
      workspacePath,
      context.openFilePaths
    );

    // 4. 构建提示词
    const fileContext = this.formatContext(projectContext);
    const selectionContext = context.selection
      ? `## 选中的代码\n文件: ${context.selection.filePath}\n行: ${context.selection.startLine}-${context.selection.endLine}\n\`\`\`${context.selection.language}\n${context.selection.code}\n\`\`\``
      : '';

    const userPrompt = buildUserPrompt(command, args, {
      fileContext,
      selectionContext,
      filePath: context.selection?.filePath,
      language: context.selection?.language,
      selectedCode: context.selection?.code,
    });

    // 5. 调用 AI
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: command.systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 4000,
    });

    const aiMessage = response.choices[0]?.message?.content || '';

    // 6. 解析代码编辑操作
    const codeEdits = parseCodeEdits(aiMessage);

    // 7. 执行代码编辑（自动执行或返回待确认）
    const toolResults: ToolResult[] = [];

    // 对于某些命令（如 edit, fix, refactor），我们返回编辑操作供用户确认
    // 对于其他命令（如 chat, explain），我们只返回消息

    return {
      message: aiMessage,
      codeEdits,
      toolResults,
    };
  }

  /**
   * 应用代码编辑
   */
  async applyCodeEdit(
    edit: CodeEditOperation,
    workspacePath: string
  ): Promise<ToolResult> {
    switch (edit.type) {
      case 'write':
      case 'create':
        return await this.toolWrite(edit.filePath, edit.newCode, workspacePath);
      case 'edit':
        if (!edit.originalCode) {
          return {
            tool: 'Edit',
            success: false,
            error: '编辑操作需要提供原始代码',
          };
        }
        return await this.toolEdit(
          edit.filePath,
          edit.originalCode,
          edit.newCode,
          workspacePath
        );
      case 'delete':
        if (!edit.originalCode) {
          return {
            tool: 'Edit',
            success: false,
            error: '删除操作需要提供要删除的代码',
          };
        }
        return await this.toolEdit(
          edit.filePath,
          edit.originalCode,
          '',
          workspacePath
        );
      default:
        return { tool: 'Edit', success: false, error: `未知操作类型: ${edit.type}` };
    }
  }

  /**
   * 解析用户输入
   */
  private parseInput(input: string): { commandId: string; args: string } {
    const trimmed = input.trim();

    if (trimmed.startsWith('/')) {
      const spaceIndex = trimmed.indexOf(' ');
      if (spaceIndex === -1) {
        return { commandId: trimmed.slice(1), args: '' };
      }
      return {
        commandId: trimmed.slice(1, spaceIndex),
        args: trimmed.slice(spaceIndex + 1).trim(),
      };
    }

    return { commandId: 'chat', args: trimmed };
  }

  /**
   * 自由对话
   */
  async chat(
    messages: Array<{ role: string; content: string }>,
    workspacePath: string,
    openFilePaths: string[],
    config: AIProviderConfig
  ): Promise<string> {
    const client = this.getClient(config);
    const model = this.getModel(config);

    const context = await this.getProjectContext(workspacePath, openFilePaths);

    const systemMessages: Array<{ role: string; content: string }> = [
      {
        role: 'system',
        content: `你是 AI 编程助手，集成在代码编辑器中。

## 你的能力
- 理解和生成多种编程语言的代码
- 解释代码功能
- 审查和改进代码
- 帮助调试
- 根据需求生成新代码

## 项目上下文
${this.formatContext(context)}

## 指南
1. 提供准确、可运行的代码解决方案
2. 解释你的推理过程
3. 考虑项目的现有模式和规范
4. 生成代码时使用 markdown 代码块
5. 简洁但全面`,
      },
    ];

    const allMessages = [...systemMessages, ...messages];

    const response = await client.chat.completions.create({
      model,
      messages: allMessages as any,
      temperature: 0.7,
      max_tokens: 4000,
    });

    return response.choices[0]?.message?.content || '';
  }
}

// 导出单例
export const aiSkillService = new AISkillService();
