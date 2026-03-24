/**
 * Message Parser 单元测试
 */

import { describe, it, expect } from 'vitest';
import {
  parseMessage,
  parseContentBlocks,
  formatTimestamp,
  extractLanguageFromFilename,
  highlightCode,
} from './messageParser';

describe('parseMessage', () => {
  it('应该解析普通文本', () => {
    const result = parseMessage('Hello, world!');

    expect(result.content).toBe('Hello, world!');
    expect(result.thinking).toBeNull();
    expect(result.toolCalls).toEqual([]);
    expect(result.todoItems).toEqual([]);
  });

  it('应该提取思考内容', () => {
    const content = `<think>Thinking about the solution...</think>Let me explain.`;
    const result = parseMessage(content);

    expect(result.thinking).toBe('Thinking about the solution...');
    expect(result.content).toBe('Let me explain.');
  });

  it('应该提取待办事项', () => {
    const content = `
      <todo>
        <task status="pending">Task 1</task>
        <task status="in_progress">Task 2</task>
        <task status="completed">Task 3</task>
      </todo>
      Here are the tasks.
    `;

    const result = parseMessage(content);

    expect(result.todoItems).toHaveLength(3);
    expect(result.todoItems[0].content).toBe('Task 1');
    expect(result.todoItems[0].status).toBe('pending');
    expect(result.todoItems[1].status).toBe('in_progress');
    expect(result.todoItems[2].status).toBe('completed');
  });

  it('应该提取代码块', () => {
    const content = `
      Here is some code:

      \`\`\`javascript
      const hello = 'world';
      console.log(hello);
      \`\`\`

      That's it!
    `;

    const result = parseMessage(content);

    expect(result.codeBlocks).toHaveLength(1);
    expect(result.codeBlocks[0].language).toBe('javascript');
    expect(result.codeBlocks[0].code).toContain("const hello = 'world';");
  });

  it('应该处理多个代码块', () => {
    const content = `
      \`\`\`javascript
      const a = 1;
      \`\`\`

      \`\`\`python
      b = 2
      \`\`\`
    `;

    const result = parseMessage(content);

    expect(result.codeBlocks).toHaveLength(2);
    expect(result.codeBlocks[0].language).toBe('javascript');
    expect(result.codeBlocks[1].language).toBe('python');
  });

  it('应该处理完整消息', () => {
    const content = `
      <think>Analyzing the problem...</think>

      Let me create a solution:

      <todo>
        <task id="task-1" status="pending">Create component</task>
        <task id="task-2" status="pending">Add tests</task>
      </todo>

      \`\`\`typescript
      const Component = () => {
        return <div>Hello</div>;
      };
      \`\`\`
    `;

    const result = parseMessage(content);

    expect(result.thinking).toBe('Analyzing the problem...');
    expect(result.todoItems).toHaveLength(2);
    expect(result.codeBlocks).toHaveLength(1);
    expect(result.codeBlocks[0].language).toBe('typescript');
  });

  it('应该处理空内容', () => {
    const result = parseMessage('');

    expect(result.content).toBe('');
    expect(result.thinking).toBeNull();
    expect(result.toolCalls).toEqual([]);
    expect(result.todoItems).toEqual([]);
  });

  it('应该处理只有思考内容', () => {
    const content = '<think>Just thinking...</think>';
    const result = parseMessage(content);

    expect(result.thinking).toBe('Just thinking...');
    expect(result.content).toBe('');
  });

  it('应该处理只有待办事项', () => {
    const content = '<todo><task>Todo item</task></todo>';
    const result = parseMessage(content);

    expect(result.todoItems).toHaveLength(1);
    expect(result.content).toBe('');
  });

  it('应该按顺序解析内容块', () => {
    const content = `
      首先是一段介绍。
      <think>思考过程1</think>
      然后是思考后的内容。
      <todo><task id="1" status="pending">任务1</task></todo>
      最后是结尾。
    `;

    const result = parseMessage(content);

    expect(result.contentBlocks).toHaveLength(5);
    expect(result.contentBlocks[0].type).toBe('text');
    expect(result.contentBlocks[1].type).toBe('thinking');
    expect(result.contentBlocks[2].type).toBe('text');
    expect(result.contentBlocks[3].type).toBe('todo');
    expect(result.contentBlocks[4].type).toBe('text');
  });
});

describe('parseContentBlocks', () => {
  it('应该按顺序解析文本和思考块', () => {
    const content = '开始<think>思考内容</think>结束';
    const blocks = parseContentBlocks(content);

    expect(blocks).toHaveLength(3);
    expect(blocks[0].type).toBe('text');
    expect(blocks[0].content).toBe('开始');
    expect(blocks[1].type).toBe('thinking');
    expect(blocks[1].thinking).toBe('思考内容');
    expect(blocks[2].type).toBe('text');
    expect(blocks[2].content).toBe('结束');
  });

  it('应该按顺序解析多个思考块', () => {
    const content = '<think>思考1</think>文本<think>思考2</think>';
    const blocks = parseContentBlocks(content);

    expect(blocks).toHaveLength(3);
    expect(blocks[0].type).toBe('thinking');
    expect(blocks[0].thinking).toBe('思考1');
    expect(blocks[1].type).toBe('text');
    expect(blocks[1].content).toBe('文本');
    expect(blocks[2].type).toBe('thinking');
    expect(blocks[2].thinking).toBe('思考2');
  });

  it('应该按顺序解析待办事项', () => {
    const content = '介绍<todo><task>任务1</task></todo>结尾';
    const blocks = parseContentBlocks(content);

    expect(blocks).toHaveLength(3);
    expect(blocks[0].type).toBe('text');
    expect(blocks[1].type).toBe('todo');
    expect(blocks[1].todoItems).toHaveLength(1);
    expect(blocks[2].type).toBe('text');
  });

  it('应该处理空内容', () => {
    const blocks = parseContentBlocks('');
    expect(blocks).toHaveLength(0);
  });

  it('应该处理纯文本', () => {
    const blocks = parseContentBlocks('纯文本内容');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('text');
    expect(blocks[0].content).toBe('纯文本内容');
  });
});

describe('formatTimestamp', () => {
  it('应该格式化今天的时间', () => {
    const now = Date.now();
    const result = formatTimestamp(now);

    expect(result).toMatch(/\d{2}:\d{2}/);
  });

  it('应该格式化过去的时间', () => {
    const past = Date.now() - 24 * 60 * 60 * 1000; // 1天前
    const result = formatTimestamp(past);

    expect(result).toMatch(/\d{1,2}月\d{1,2}日/);
  });
});

describe('extractLanguageFromFilename', () => {
  it('应该提取 JavaScript 文件的语言', () => {
    expect(extractLanguageFromFilename('app.js')).toBe('javascript');
    expect(extractLanguageFromFilename('component.jsx')).toBe('javascript');
  });

  it('应该提取 TypeScript 文件的语言', () => {
    expect(extractLanguageFromFilename('app.ts')).toBe('typescript');
    expect(extractLanguageFromFilename('component.tsx')).toBe('typescript');
  });

  it('应该提取 Python 文件的语言', () => {
    expect(extractLanguageFromFilename('script.py')).toBe('python');
  });

  it('应该提取其他语言', () => {
    expect(extractLanguageFromFilename('app.go')).toBe('go');
    expect(extractLanguageFromFilename('main.rs')).toBe('rust');
    expect(extractLanguageFromFilename('server.java')).toBe('java');
  });

  it('应该处理未知扩展名', () => {
    expect(extractLanguageFromFilename('file.xyz')).toBe('text');
    expect(extractLanguageFromFilename('file')).toBe('text');
  });
});

describe('highlightCode', () => {
  it('应该高亮 JavaScript 关键字', () => {
    const code = 'const x = 1;';
    const highlighted = highlightCode(code, 'javascript');

    expect(highlighted).toContain('<span class="keyword">const</span>');
  });

  it('应该高亮 TypeScript 关键字', () => {
    const code = 'interface Props {}';
    const highlighted = highlightCode(code, 'typescript');

    expect(highlighted).toContain('<span class="keyword">interface</span>');
  });

  it('应该处理未知语言', () => {
    const code = 'const x = 1;';
    const highlighted = highlightCode(code, 'unknown');

    expect(highlighted).toBe(code);
  });

  it('应该保留非关键字', () => {
    const code = 'const x = 1;';
    const highlighted = highlightCode(code, 'javascript');

    expect(highlighted).toContain('x');
    expect(highlighted).toContain('=');
  });
});
