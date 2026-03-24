/**
 * 消息解析器
 * 解析 AI 消息中的各种内容块
 */

import type { AgentToolCall, TodoItem, AgentQuestion } from '../../../../shared/agentTypes';

export interface CodeBlock {
  language: string;
  code: string;
  startLine: number;
  endLine: number;
}

export type ContentBlockType = 'text' | 'thinking' | 'tool_call' | 'todo' | 'question';

export interface ContentBlock {
  type: ContentBlockType;
  content?: string;
  thinking?: string;
  toolCall?: AgentToolCall;
  todoItems?: TodoItem[];
  question?: AgentQuestion;
  timestamp: number; // 添加时间戳用于排序
}

// 带时间戳的工具调用
export interface TimestampedToolCall extends AgentToolCall {
  timestamp: number;
}

export interface ParsedMessage {
  content: string;
  thinking: string | null;
  toolCalls: AgentToolCall[];
  todoItems: TodoItem[];
  question: AgentQuestion | null;
  options: Array<{ id: string; label: string; value: string }>;
  codeBlocks: CodeBlock[];
  cleanedContent: string;
  contentBlocks: ContentBlock[];
}

export function parseMessage(rawContent: string): ParsedMessage {
  let cleaned = rawContent;
  let thinking: string | null = null;
  let toolCalls: AgentToolCall[] = [];
  let todoItems: TodoItem[] = [];
  let question: AgentQuestion | null = null;
  let options: Array<{ id: string; label: string; value: string }> = [];
  let codeBlocks: CodeBlock[] = [];

  thinking = extractThinking(cleaned);
  if (thinking) {
    cleaned = cleaned.replace(thinkingPattern, '');
  }

  const questionData = extractQuestion(cleaned);
  if (questionData) {
    question = questionData.question;
    options = questionData.options;
    cleaned = cleaned.replace(questionPattern, '');
  }

  todoItems = extractTodoItems(cleaned);
  if (todoItems.length > 0) {
    cleaned = cleaned.replace(todoPattern, '');
  }

  codeBlocks = extractCodeBlocks(cleaned);
  cleaned = removeCodeBlocks(cleaned);

  cleaned = cleaned.trim();

  // 按顺序解析内容块
  const contentBlocks = parseContentBlocks(rawContent);

  return {
    content: cleaned,
    thinking,
    toolCalls,
    todoItems,
    question,
    options,
    codeBlocks,
    cleanedContent: cleaned,
    contentBlocks,
  };
}

/**
 * 按顺序解析内容块
 * 按照内容在原始文本中出现的顺序解析出不同类型的块
 * @param rawContent 原始内容
 * @param baseTimestamp 基础时间戳，用于保持流式过程中的时间顺序
 */
export function parseContentBlocks(rawContent: string, baseTimestamp?: number): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  let remaining = rawContent;
  let currentTimestamp = baseTimestamp || Date.now();

  // 定义所有标签的正则表达式
  const patterns = [
    { type: 'thinking' as const, regex: /<(?:think|thinking)>([\s\S]*?)<\/(?:think|thinking)>/i },
    { type: 'todo' as const, regex: /<todo>([\s\S]*?)<\/todo>/i },
    { type: 'question' as const, regex: /<question>([\s\S]*?)<\/question>/i },
  ];

  while (remaining.length > 0) {
    let earliestMatch: { type: ContentBlockType; match: RegExpMatchArray; index: number } | null = null;

    // 找到最早出现的标签
    for (const pattern of patterns) {
      const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
      const match = regex.exec(remaining);
      if (match && (earliestMatch === null || match.index < earliestMatch.index)) {
        earliestMatch = { type: pattern.type, match, index: match.index };
      }
    }

    if (earliestMatch) {
      // 添加标签前的文本内容
      if (earliestMatch.index > 0) {
        const textContent = remaining.slice(0, earliestMatch.index).trim();
        if (textContent) {
          blocks.push({ type: 'text', content: textContent, timestamp: currentTimestamp++ });
        }
      }

      // 处理匹配到的标签
      const fullMatch = earliestMatch.match[0];
      const innerContent = earliestMatch.match[1];

      switch (earliestMatch.type) {
        case 'thinking':
          blocks.push({ type: 'thinking', thinking: innerContent.trim(), timestamp: currentTimestamp++ });
          break;
        case 'todo':
          const todoItems = parseTodoContent(innerContent);
          if (todoItems.length > 0) {
            blocks.push({ type: 'todo', todoItems, timestamp: currentTimestamp++ });
          }
          break;
        case 'question':
          const questionData = parseQuestionContent(innerContent);
          console.log('[parseContentBlocks] parseQuestionContent result:', questionData);
          console.log('[parseContentBlocks] innerContent:', innerContent);
          if (questionData) {
            blocks.push({ type: 'question', question: questionData, timestamp: currentTimestamp++ });
          }
          break;
      }

      // 更新剩余内容
      remaining = remaining.slice(earliestMatch.index + fullMatch.length);
    } else {
      // 没有更多标签，添加剩余内容
      const textContent = remaining.trim();
      if (textContent) {
        blocks.push({ type: 'text', content: textContent, timestamp: currentTimestamp++ });
      }
      break;
    }
  }

  return blocks;
}

function parseTodoContent(content: string): TodoItem[] {
  const todoItems: TodoItem[] = [];
  const taskRegex = /<task\s*(?:id="([^"]+)")?\s*(?:status="([^"]+)")?[^>]*>([^<]*)<\/task>/gi;
  let taskMatch;

  while ((taskMatch = taskRegex.exec(content)) !== null) {
    const id = taskMatch[1] || `task-${Date.now()}-${todoItems.length}`;
    const status = (taskMatch[2] || 'pending') as TodoItem['status'];
    const taskContent = taskMatch[3].trim();

    if (taskContent) {
      todoItems.push({
        id,
        content: taskContent,
        status,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  }

  return todoItems;
}

function parseQuestionContent(content: string): AgentQuestion | null {
  console.log('[parseQuestionContent] Input content:', content);
  
  // 修改正则以支持 question 文本（可能包含冒号、问号等）
  const questionTextMatch = content.match(/^([^\n<]+)/);
  const questionText = questionTextMatch ? questionTextMatch[1].trim() : '';
  console.log('[parseQuestionContent] questionText from regex:', questionText);

  // 提取非标签行作为问题文本的备选
  const lines = content.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('<'));
  console.log('[parseQuestionContent] lines:', lines);
  const finalQuestionText = questionText || lines[0] || '请回答以下问题';
  console.log('[parseQuestionContent] finalQuestionText:', finalQuestionText);

  // 放宽正则，允许 id 和 value 之间有可选空格
  const optionMatches = content.matchAll(/<option\s+id="([^"]+)"\s*value="([^"]+)"\s*>([^<]*(?:<[^>]*>[^<]*)*)<\/option>/gi);
  const options: Array<{ id: string; label: string; value: string }> = [];

  for (const match of optionMatches) {
    console.log('[parseQuestionContent] Match found:', match[1], match[2], match[3]);
    options.push({
      id: match[1],
      value: match[2],
      label: match[3].trim(),
    });
  }
  console.log('[parseQuestionContent] options after first regex:', options);

  // 如果没有找到选项，尝试更简单的正则
  if (options.length === 0) {
    const simpleOptionMatches = content.matchAll(/<option[^>]*id="([^"]+)"[^>]*value="([^"]+)"[^>]*>([^<]*)<\/option>/gi);
    for (const match of simpleOptionMatches) {
      console.log('[parseQuestionContent] Simple regex match:', match[1], match[2], match[3]);
      options.push({
        id: match[1],
        value: match[2],
        label: match[3].trim(),
      });
    }
    console.log('[parseQuestionContent] options after simple regex:', options);
  }

  if (!finalQuestionText && options.length === 0) {
    console.log('[parseQuestionContent] Returning null');
    return null;
  }

  const result = {
    id: `question-${Date.now()}`,
    question: finalQuestionText,
    options: options.length > 0 ? options : undefined,
    status: 'pending' as const,
    createdAt: Date.now(),
  };
  console.log('[parseQuestionContent] Returning:', result);
  return result;
}

const thinkingPattern = /<(?:think|thinking)>([\s\S]*?)<\/(?:think|thinking)>/gi;
const questionPattern = /<question>([\s\S]*?)<\/question>/gi;
const todoPattern = /<todo>([\s\S]*?)<\/todo>/gi;
const codeBlockPattern = /```(\w*)\n?([\s\S]*?)```/g;

function extractThinking(content: string): string | null {
  const match = thinkingPattern.exec(content);
  if (match) {
    thinkingPattern.lastIndex = 0;
    return match[1].trim();
  }
  return null;
}

function extractQuestion(
  content: string
): { question: AgentQuestion; options: Array<{ id: string; label: string; value: string }> } | null {
  const match = questionPattern.exec(content);
  if (!match) return null;

  questionPattern.lastIndex = 0;

  const questionContent = match[1];
  const questionTextMatch = questionContent.match(/^([^<]*)/);
  const questionText = questionTextMatch ? questionTextMatch[1].trim() : '';

  const options: Array<{ id: string; label: string; value: string }> = [];
  const optionRegex = /<option\s*(?:id="([^"]+)")?\s*value="([^"]+)"[^>]*>([^<]*)<\/option>/gi;
  let optionMatch;
  let idx = 0;

  while ((optionMatch = optionRegex.exec(questionContent)) !== null) {
    options.push({
      id: optionMatch[1] || `option-${idx++}`,
      value: optionMatch[2],
      label: optionMatch[3].trim() || optionMatch[2],
    });
  }

  if (!questionText && options.length === 0) {
    return null;
  }

  return {
    question: {
      id: `question-${Date.now()}`,
      question: questionText,
      options,
      status: 'pending',
      createdAt: Date.now(),
    },
    options,
  };
}

function extractTodoItems(content: string): TodoItem[] {
  const todoItems: TodoItem[] = [];

  const match = todoPattern.exec(content);
  if (!match) return todoItems;

  todoPattern.lastIndex = 0;

  const todoContent = match[1];
  const taskRegex = /<task\s*(?:id="([^"]+)")?\s*(?:status="([^"]+)")?[^>]*>([^<]*)<\/task>/gi;
  let taskMatch;

  while ((taskMatch = taskRegex.exec(todoContent)) !== null) {
    const id = taskMatch[1] || `task-${Date.now()}-${todoItems.length}`;
    const status = (taskMatch[2] || 'pending') as TodoItem['status'];
    const taskContent = taskMatch[3].trim();

    if (taskContent) {
      todoItems.push({
        id,
        content: taskContent,
        status,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  }

  return todoItems;
}

function extractCodeBlocks(content: string): CodeBlock[] {
  const codeBlocks: CodeBlock[] = [];
  let match;

  while ((match = codeBlockPattern.exec(content)) !== null) {
    codeBlocks.push({
      language: match[1] || 'text',
      code: match[2],
      startLine: 0,
      endLine: 0,
    });
  }

  codeBlockPattern.lastIndex = 0;
  return codeBlocks;
}

function removeCodeBlocks(content: string): string {
  return content.replace(codeBlockPattern, '');
}

export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function extractLanguageFromFilename(filename: string): string {
  const extensionMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    cs: 'csharp',
    php: 'php',
    swift: 'swift',
    kt: 'kotlin',
    scala: 'scala',
    r: 'r',
    sql: 'sql',
    html: 'html',
    css: 'css',
    scss: 'scss',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    xml: 'xml',
    md: 'markdown',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    ps1: 'powershell',
  };

  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return extensionMap[ext] || 'text';
}

export function highlightCode(code: string, language: string): string {
  const keywords: Record<string, string[]> = {
    javascript: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'import', 'export', 'async', 'await'],
    typescript: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'import', 'export', 'async', 'await', 'interface', 'type', 'enum'],
    python: ['def', 'class', 'if', 'elif', 'else', 'for', 'while', 'return', 'import', 'from', 'async', 'await', 'try', 'except'],
  };

  const langKeywords = keywords[language] || [];

  let highlighted = code;
  for (const keyword of langKeywords) {
    const regex = new RegExp(`\\b(${keyword})\\b`, 'g');
    highlighted = highlighted.replace(regex, `<span class="keyword">$1</span>`);
  }

  return highlighted;
}
