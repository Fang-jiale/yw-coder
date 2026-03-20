/**
 * AI 命令系统 - 参考 Claude Code 和 Trae 设计
 * 支持通过 / 触发命令，每个命令可以配置允许使用的工具
 */

export interface AICommand {
  id: string;
  name: string;
  description: string;
  argumentHint?: string;
  allowedTools: ToolType[];
  requiresSelection: boolean;
  systemPrompt: string;
  userPromptTemplate: string;
}

export type ToolType =
  | 'Read'
  | 'Write'
  | 'Edit'
  | 'Bash'
  | 'Grep'
  | 'Glob'
  | 'Chat'
  | 'Generate'
  | 'Explain'
  | 'Review';

/**
 * 代码编辑工具调用结果
 */
export interface ToolCall {
  tool: ToolType;
  params: Record<string, any>;
  result?: any;
}

/**
 * AI 响应中的代码编辑操作
 */
export interface CodeEditOperation {
  type: 'edit' | 'write' | 'create' | 'delete';
  filePath: string;
  originalCode?: string;
  newCode: string;
  description: string;
  startLine?: number;
  endLine?: number;
}

/**
 * AI 响应结构
 */
export interface AIResponse {
  message: string;
  toolCalls?: ToolCall[];
  codeEdits?: CodeEditOperation[];
  suggestions?: string[];
}

/**
 * 内置命令定义
 * 参考 Claude Code 的命令设计
 */
export const BUILTIN_COMMANDS: AICommand[] = [
  {
    id: 'chat',
    name: 'Chat',
    description: '与 AI 进行自由对话，讨论代码问题',
    argumentHint: '<问题描述>',
    allowedTools: ['Chat', 'Read', 'Grep'],
    requiresSelection: false,
    systemPrompt: `你是专业的编程助手，可以帮助用户解决编程问题。
你可以：
1. 回答编程相关的问题
2. 读取项目文件来理解上下文
3. 搜索代码库中的相关内容
4. 提供代码建议和最佳实践

请用中文回答，保持简洁专业。`,
    userPromptTemplate: '$ARGUMENTS',
  },
  {
    id: 'edit',
    name: 'Edit',
    description: '根据指令编辑选中的代码或文件',
    argumentHint: '<编辑指令>',
    allowedTools: ['Read', 'Edit', 'Write', 'Grep'],
    requiresSelection: false,
    systemPrompt: `你是专业的代码编辑器。你的任务是根据用户指令精确地修改代码。

重要规则：
1. 先读取相关文件理解上下文
2. 只做必要的修改，保持代码风格一致
3. 返回具体的代码编辑操作（文件路径、原代码、新代码）
4. 如果用户选中了代码，优先编辑选中部分
5. 如果没有选中代码，根据指令找到并编辑相关文件

输出格式：
1. 先说明你的编辑计划
2. 然后返回具体的编辑操作，格式如下：

\`\`\`edit
文件路径: <relative/path/to/file>
操作: <edit|write|create>
说明: <编辑说明>
原代码:
<原始代码片段>
新代码:
<新代码片段>
\`\`\``,    userPromptTemplate: `请编辑以下代码：

$FILE_CONTEXT

$SELECTION_CONTEXT

编辑指令：$ARGUMENTS`,
  },
  {
    id: 'generate',
    name: 'Generate',
    description: '根据描述生成新代码',
    argumentHint: '<功能描述>',
    allowedTools: ['Read', 'Write', 'Grep', 'Glob'],
    requiresSelection: false,
    systemPrompt: `你是专业的代码生成器。根据用户描述生成高质量的代码。

规则：
1. 先分析项目结构和现有代码风格
2. 生成符合项目规范的代码
3. 如果需要在现有文件中添加代码，返回 Edit 操作
4. 如果是新文件，返回 Write 操作

输出格式：
1. 说明生成的代码功能
2. 返回具体的代码操作：

\`\`\`edit
文件路径: <relative/path/to/file>
操作: <write|create>
说明: <说明>
新代码:
<完整代码>
\`\`\``,    userPromptTemplate: `请生成代码：

$FILE_CONTEXT

需求描述：$ARGUMENTS`,
  },
  {
    id: 'explain',
    name: 'Explain',
    description: '解释代码的功能和实现原理',
    argumentHint: '',
    allowedTools: ['Read', 'Grep'],
    requiresSelection: true,
    systemPrompt: `你是代码解释专家。清晰地解释代码的功能、实现原理和设计思路。

解释维度：
1. 代码整体功能概述
2. 关键逻辑和算法解释
3. 设计模式和架构思路
4. 潜在问题和改进建议

请用中文回答，结构清晰。`,
    userPromptTemplate: `请解释以下代码：

文件：$FILE_PATH

\`\`\`$LANGUAGE
$SELECTED_CODE
\`\`\`

$FILE_CONTEXT`,
  },
  {
    id: 'review',
    name: 'Review',
    description: '审查代码质量，找出潜在问题',
    argumentHint: '',
    allowedTools: ['Read', 'Grep'],
    requiresSelection: true,
    systemPrompt: `你是资深代码审查员。仔细审查代码，找出潜在问题和改进空间。

审查维度：
1. 代码正确性 - 是否有 Bug 或逻辑错误
2. 安全性 - 是否有安全漏洞（SQL注入、XSS等）
3. 性能 - 是否有性能瓶颈
4. 可读性 - 命名、结构是否清晰
5. 最佳实践 - 是否遵循语言/框架规范

输出格式：
- 评分（1-10分）
- 主要问题（按严重程度排序）
- 具体改进建议`,
    userPromptTemplate: `请审查以下代码：

文件：$FILE_PATH

\`\`\`$LANGUAGE
$SELECTED_CODE
\`\`\`

$FILE_CONTEXT`,
  },
  {
    id: 'fix',
    name: 'Fix',
    description: '自动修复代码中的问题',
    argumentHint: '[问题描述]',
    allowedTools: ['Read', 'Edit', 'Write', 'Grep'],
    requiresSelection: false,
    systemPrompt: `你是 Bug 修复专家。分析代码问题并自动修复。

修复流程：
1. 分析问题或错误信息
2. 定位问题根源
3. 实施最小化修复
4. 确保修复不会引入新问题

输出格式：
1. 问题分析
2. 修复方案
3. 具体编辑操作：

\`\`\`edit
文件路径: <path>
操作: edit
说明: <修复说明>
原代码:
<原代码>
新代码:
<修复后的代码>
\`\`\``,    userPromptTemplate: `请修复代码中的问题：

$FILE_CONTEXT

$SELECTION_CONTEXT

$ARGUMENTS`,
  },
  {
    id: 'refactor',
    name: 'Refactor',
    description: '重构代码以提高质量和可维护性',
    argumentHint: '[重构目标]',
    allowedTools: ['Read', 'Edit', 'Write', 'Grep'],
    requiresSelection: true,
    systemPrompt: `你是代码重构专家。安全地重构代码，提高代码质量和可维护性。

重构原则：
1. 保持功能不变
2. 提高可读性和可维护性
3. 消除代码异味
4. 遵循设计模式

输出格式：
1. 重构计划
2. 具体重构操作：

\`\`\`edit
文件路径: <path>
操作: edit
说明: <重构说明>
原代码:
<原代码>
新代码:
<重构后的代码>
\`\`\``,    userPromptTemplate: `请重构以下代码：

文件：$FILE_PATH

\`\`\`$LANGUAGE
$SELECTED_CODE
\`\`\`

$FILE_CONTEXT

重构目标：$ARGUMENTS`,
  },
  {
    id: 'test',
    name: 'Test',
    description: '为代码生成单元测试',
    argumentHint: '',
    allowedTools: ['Read', 'Write', 'Grep'],
    requiresSelection: true,
    systemPrompt: `你是测试专家。为代码生成全面的单元测试。

测试要求：
1. 覆盖正常流程
2. 覆盖边界条件
3. 覆盖异常情况
4. 使用项目现有的测试框架
5. 测试命名清晰

输出格式：
1. 测试策略说明
2. 生成的测试代码：

\`\`\`edit
文件路径: <test-file-path>
操作: write
说明: <说明>
新代码:
<测试代码>
\`\`\``,    userPromptTemplate: `请为以下代码生成单元测试：

文件：$FILE_PATH

\`\`\`$LANGUAGE
$SELECTED_CODE
\`\`\`

$FILE_CONTEXT`,
  },
  {
    id: 'doc',
    name: 'Doc',
    description: '为代码生成文档注释',
    argumentHint: '',
    allowedTools: ['Read', 'Edit'],
    requiresSelection: true,
    systemPrompt: `你是技术文档专家。为代码生成清晰、专业的文档注释。

文档要求：
1. 说明函数/类的用途
2. 说明参数和返回值
3. 说明异常和边界情况
4. 提供使用示例（如适用）
5. 遵循项目文档规范

输出格式：
返回具体的编辑操作，添加文档注释。`,
    userPromptTemplate: `请为以下代码生成文档注释：

文件：$FILE_PATH

\`\`\`$LANGUAGE
$SELECTED_CODE
\`\`\`

$FILE_CONTEXT`,
  },
  {
    id: 'find',
    name: 'Find',
    description: '在项目中搜索代码',
    argumentHint: '<搜索内容>',
    allowedTools: ['Grep', 'Glob', 'Read'],
    requiresSelection: false,
    systemPrompt: `你是代码搜索专家。帮助用户在项目中找到相关代码。

可以搜索：
1. 函数定义
2. 变量使用
3. 特定模式
4. 文件内容

返回搜索结果和相关代码片段。`,
    userPromptTemplate: `请在项目中搜索：$ARGUMENTS

$FILE_CONTEXT`,
  },
];

/**
 * 获取命令配置
 */
export function getCommand(commandId: string): AICommand | undefined {
  return BUILTIN_COMMANDS.find(cmd => cmd.id === commandId);
}

/**
 * 解析用户输入，提取命令和参数
 */
export function parseCommand(input: string): { commandId: string; args: string } {
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

  // 默认使用 chat 命令
  return { commandId: 'chat', args: trimmed };
}

/**
 * 构建用户提示词
 */
export function buildUserPrompt(
  command: AICommand,
  args: string,
  context: {
    fileContext?: string;
    selectionContext?: string;
    filePath?: string;
    language?: string;
    selectedCode?: string;
  }
): string {
  let prompt = command.userPromptTemplate;

  // 替换变量
  prompt = prompt.replace(/\$ARGUMENTS/g, args || '无');
  prompt = prompt.replace(/\$FILE_CONTEXT/g, context.fileContext || '无文件上下文');
  prompt = prompt.replace(/\$SELECTION_CONTEXT/g, context.selectionContext || '无选中代码');
  prompt = prompt.replace(/\$FILE_PATH/g, context.filePath || '未知文件');
  prompt = prompt.replace(/\$LANGUAGE/g, context.language || 'plaintext');
  prompt = prompt.replace(/\$SELECTED_CODE/g, context.selectedCode || '');

  return prompt;
}

/**
 * 从 AI 响应中解析代码编辑操作
 */
export function parseCodeEdits(response: string): CodeEditOperation[] {
  const edits: CodeEditOperation[] = [];

  // 匹配 edit 代码块
  const editRegex = /```edit\s*\n([\s\S]*?)\n```/g;
  let match;

  while ((match = editRegex.exec(response)) !== null) {
    const block = match[1];

    const filePathMatch = block.match(/文件路径:\s*(.+)/);
    const operationMatch = block.match(/操作:\s*(\w+)/);
    const descriptionMatch = block.match(/说明:\s*(.+)/);
    const originalCodeMatch = block.match(/原代码:\s*\n([\s\S]*?)(?=\n新代码:|$)/);
    const newCodeMatch = block.match(/新代码:\s*\n([\s\S]*?)$/);

    if (filePathMatch && newCodeMatch) {
      edits.push({
        type: (operationMatch?.[1] as any) || 'edit',
        filePath: filePathMatch[1].trim(),
        originalCode: originalCodeMatch?.[1]?.trim(),
        newCode: newCodeMatch[1].trim(),
        description: descriptionMatch?.[1] || '代码编辑',
      });
    }
  }

  return edits;
}
