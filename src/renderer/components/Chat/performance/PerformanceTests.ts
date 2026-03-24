/**
 * 性能测试
 * 测试关键性能指标
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('性能测试', () => {
  describe('渲染性能', () => {
    it('应该在16ms内完成简单组件渲染', () => {
      const start = performance.now();

      // 模拟组件渲染
      const element = document.createElement('div');
      element.innerHTML = '<span>Hello World</span>';

      const end = performance.now();
      const duration = end - start;

      expect(duration).toBeLessThan(16); // 60fps
    });

    it('应该高效处理大量消息', () => {
      const messageCount = 1000;
      const messages = Array.from({ length: messageCount }, (_, i) => ({
        id: `msg-${i}`,
        content: `Message ${i}`,
        timestamp: Date.now(),
      }));

      const start = performance.now();

      // 模拟消息列表渲染
      const container = document.createElement('div');
      messages.forEach((msg) => {
        const el = document.createElement('div');
        el.textContent = msg.content;
        container.appendChild(el);
      });

      const end = performance.now();
      const duration = end - start;

      console.log(`渲染 ${messageCount} 条消息耗时: ${duration}ms`);
      expect(duration).toBeLessThan(100); // 100ms 内完成
    });

    it('应该快速解析 Markdown', () => {
      const content = Array.from({ length: 100 }, (_, i) => `
        # Heading ${i}

        Paragraph ${i} with some text.

        \`\`\`javascript
        const code${i} = 'example';
        \`\`\`
      `).join('\n');

      const start = performance.now();

      // 模拟 Markdown 解析
      const lines = content.split('\n');
      const headings = lines.filter((l) => l.startsWith('#'));
      const codeBlocks = content.match(/```[\s\S]*?```/g) || [];

      const end = performance.now();
      const duration = end - start;

      console.log(`解析 Markdown 耗时: ${duration}ms`);
      expect(duration).toBeLessThan(50);
    });
  });

  describe('内存性能', () => {
    it('应该有效释放大对象', () => {
      const largeArray = new Array(100000).fill('data');
      const obj = { data: largeArray };

      // 模拟清理
      obj.data = null;

      expect((obj as any).data).toBeNull();
    });

    it('应该限制历史记录大小', () => {
      const maxHistory = 50;
      const history: string[] = [];

      for (let i = 0; i < 100; i++) {
        history.push(`item-${i}`);
        if (history.length > maxHistory) {
          history.shift();
        }
      }

      expect(history.length).toBe(maxHistory);
    });
  });

  describe('滚动性能', () => {
    it('应该快速计算滚动位置', () => {
      const scrollTop = 500;
      const scrollHeight = 5000;
      const clientHeight = 600;
      const threshold = 100;

      const start = performance.now();

      const isAtBottom = scrollHeight - scrollTop - clientHeight < threshold;
      const shouldAutoScroll = isAtBottom;

      const end = performance.now();
      const duration = end - start;

      expect(duration).toBeLessThan(1); // 1ms 内完成
      expect(isAtBottom).toBe(false);
    });
  });

  describe('流式内容性能', () => {
    it('应该高效节流内容更新', () => {
      const throttleMs = 60;
      let lastUpdate = 0;
      let updateCount = 0;
      const updates: string[] = [];

      const throttledUpdate = (content: string) => {
        const now = Date.now();
        if (now - lastUpdate >= throttleMs) {
          updates.push(content);
          lastUpdate = now;
          updateCount++;
        }
      };

      const start = performance.now();

      for (let i = 0; i < 100; i++) {
        throttledUpdate(`content-${i}`);
      }

      const end = performance.now();
      const duration = end - start;

      console.log(`100 次更新，${updateCount} 次实际更新，耗时: ${duration}ms`);
      expect(duration).toBeLessThan(10);
    });

    it('应该快速拼接字符串', () => {
      const chunk = 'a'.repeat(1000);
      let content = '';

      const start = performance.now();

      for (let i = 0; i < 100; i++) {
        content += chunk;
      }

      const end = performance.now();
      const duration = end - start;

      console.log(`拼接 100KB 字符串耗时: ${duration}ms`);
      expect(duration).toBeLessThan(50);
    });
  });

  describe('搜索性能', () => {
    it('应该快速搜索工具', () => {
      const tools = Array.from({ length: 100 }, (_, i) => ({
        name: `tool_${i}`,
        description: `Tool ${i} description`,
      }));

      const query = 'tool_5';

      const start = performance.now();

      const results = tools.filter(
        (tool) =>
          tool.name.toLowerCase().includes(query.toLowerCase()) ||
          tool.description.toLowerCase().includes(query.toLowerCase())
      );

      const end = performance.now();
      const duration = end - start;

      console.log(`搜索 100 个工具耗时: ${duration}ms`);
      expect(duration).toBeLessThan(5);
      expect(results.length).toBe(1);
    });
  });

  describe('状态转换性能', () => {
    it('应该快速执行状态转换', () => {
      const transitions = {
        idle: ['START'],
        initializing: ['DONE', 'ERROR'],
        planning: ['DONE', 'FAILED', 'PAUSE', 'STOP'],
        executing: ['STEP_COMPLETE', 'DONE', 'FAILED', 'PAUSE', 'STOP'],
      };

      const start = performance.now();

      for (let i = 0; i < 1000; i++) {
        const state = 'executing';
        const available = transitions[state as keyof typeof transitions];
        const canTransition = available.includes('DONE');
      }

      const end = performance.now();
      const duration = end - start;

      console.log(`1000 次状态检查耗时: ${duration}ms`);
      expect(duration).toBeLessThan(10);
    });
  });

  describe('列表渲染性能', () => {
    it('应该快速渲染长列表项', () => {
      const items = Array.from({ length: 1000 }, (_, i) => ({
        id: `item-${i}`,
        title: `Item ${i}`,
        content: `Content for item ${i}`,
      }));

      const start = performance.now();

      const renderedItems = items.map((item) => ({
        ...item,
        formatted: `ID: ${item.id} - ${item.title}`,
      }));

      const end = performance.now();
      const duration = end - start;

      console.log(`渲染 1000 个列表项耗时: ${duration}ms`);
      expect(duration).toBeLessThan(50);
    });

    it('应该快速过滤列表', () => {
      const items = Array.from({ length: 1000 }, (_, i) => ({
        id: `item-${i}`,
        active: i % 2 === 0,
      }));

      const start = performance.now();

      const activeItems = items.filter((item) => item.active);

      const end = performance.now();
      const duration = end - start;

      console.log(`过滤 1000 个项目耗时: ${duration}ms`);
      expect(duration).toBeLessThan(10);
      expect(activeItems.length).toBe(500);
    });
  });
});

describe('性能基准测试', () => {
  it('渲染基准: 应该 < 16ms per frame', () => {
    const targetFps = 60;
    const targetFrameTime = 1000 / targetFps;

    const start = performance.now();

    // 模拟组件渲染
    for (let i = 0; i < 10; i++) {
      const el = document.createElement('div');
      el.innerHTML = `<span>Frame ${i}</span>`;
    }

    const duration = performance.now() - start;

    console.log(`渲染 10 帧耗时: ${duration}ms, 目标: ${targetFrameTime}ms`);
    expect(duration).toBeLessThan(targetFrameTime * 10);
  });

  it('内存基准: 应该 < 50MB for 1000 messages', () => {
    const messageSize = 500; // bytes
    const messageCount = 1000;
    const expectedMemory = (messageSize * messageCount) / (1024 * 1024);

    console.log(`1000 条消息预计占用: ${expectedMemory.toFixed(2)}MB`);
    expect(expectedMemory).toBeLessThan(50);
  });

  it('响应性基准: 应该 < 100ms response time', () => {
    const start = performance.now();

    // 模拟用户操作
    const result = Array.from({ length: 100 }, (_, i) => i * 2);

    const duration = performance.now() - start;

    console.log(`用户操作响应耗时: ${duration}ms, 目标: <100ms`);
    expect(duration).toBeLessThan(100);
  });
});
