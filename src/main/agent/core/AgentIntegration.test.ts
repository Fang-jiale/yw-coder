/**
 * Agent 集成测试
 * 测试智能体系统的完整流程
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AgentStateMachine } from '../core/AgentStateMachine';
import { AgentContextManager } from '../core/AgentContext';
import { createStrategy } from '../strategies/StrategyFactory';
import { ToolRegistry } from '../tools/ToolRegistry';
import { ToolPermissionManager } from '../tools/ToolPermissionManager';

describe('Agent 系统集成测试', () => {
  describe('状态机与上下文集成', () => {
    let stateMachine: AgentStateMachine;
    let contextManager: AgentContextManager;

    beforeEach(() => {
      stateMachine = new AgentStateMachine({
        taskId: 'test-task-1',
      });
      contextManager = new AgentContextManager({
        taskId: 'test-task-1',
        workspacePath: '/workspace/test',
        taskTitle: 'Test Task',
        taskDescription: 'Test task description',
      });
    });

    afterEach(() => {
      stateMachine.reset();
    });

    it('应该正确初始化', () => {
      expect(stateMachine.getState()).toBe('idle');
      expect(contextManager.getContext().taskId).toBe('test-task-1');
    });

    it('应该完成基本状态转换', () => {
      stateMachine.transition({ type: 'START' });
      expect(stateMachine.getState()).toBe('initializing');

      stateMachine.transition({ type: 'DONE' });
      expect(stateMachine.getState()).toBe('planning');

      stateMachine.transition({ type: 'DONE' });
      expect(stateMachine.getState()).toBe('executing');
    });

    it('应该支持暂停和恢复', () => {
      stateMachine.transition({ type: 'START' });
      stateMachine.transition({ type: 'DONE' });
      stateMachine.transition({ type: 'PAUSE' });
      expect(stateMachine.getState()).toBe('paused');

      stateMachine.transition({ type: 'RESUME' });
      expect(stateMachine.getState()).toBe('executing');
    });

    it('应该正确处理错误', () => {
      stateMachine.transition({ type: 'START' });
      stateMachine.transition({ type: 'ERROR', error: 'Test error' });
      expect(stateMachine.getState()).toBe('failed');

      const context = stateMachine.getContext();
      expect(context.error).toBe('Test error');
    });

    it('应该记录状态历史', () => {
      stateMachine.transition({ type: 'START' });
      stateMachine.transition({ type: 'DONE' });

      const history = stateMachine.getHistory();
      expect(history.length).toBeGreaterThan(2);
      expect(history[0].state).toBe('idle');
      expect(history[1].event).toBe('START');
    });

    it('应该支持事件订阅', () => {
      const listener = vi.fn();
      stateMachine.subscribe(listener);

      stateMachine.transition({ type: 'START' });

      expect(listener).toHaveBeenCalledWith('initializing', 'START');
    });
  });

  describe('策略工厂集成', () => {
    it('应该能够创建 ChatStrategy', () => {
      const strategy = createStrategy('chat');
      expect(strategy.type).toBe('chat');
      expect(strategy.name).toBe('Chat');
    });

    it('应该能够创建 BuilderStrategy', () => {
      const strategy = createStrategy('builder');
      expect(strategy.type).toBe('builder');
      expect(strategy.name).toBe('Builder');
    });

    it('应该能够创建 SoloStrategy', () => {
      const strategy = createStrategy('solo');
      expect(strategy.type).toBe('solocoder');
      expect(strategy.name).toBe('SOLO');
    });

    it('应该验证策略上下文', () => {
      const strategy = createStrategy('chat');
      const testContextManager = new AgentContextManager({
        taskId: 'test-task',
        workspacePath: '/workspace/test',
        taskTitle: 'Test Task',
        taskDescription: 'Test task description',
      });
      const validContext = {
        task: {
          id: 'task-1',
          title: 'Test Task',
          description: 'Test description',
          agentId: 'agent-1',
          configId: 'config-1',
          agentType: 'chat' as any,
          status: 'pending' as any,
          workspacePath: '/workspace/test',
          steps: [],
          currentStepIndex: 0,
          messages: [
            { id: '1', role: 'user' as const, content: 'Hello', timestamp: Date.now() },
          ],
          todoItems: [],
          generatedFiles: [],
          errors: [],
          context: {},
          createdAt: Date.now(),
          updatedAt: Date.now(),
          metadata: {
            totalFilesGenerated: 0,
            totalCommandsExecuted: 0,
            estimatedTokensUsed: 0,
          },
        },
        context: testContextManager.getContext(),
        callbacks: {},
        isPaused: false,
        isStopped: false,
      };

      const validation = strategy.validate(validContext);
      expect(validation.valid).toBe(true);
    });

    it('应该估算步骤数', () => {
      const chatStrategy = createStrategy('chat');
      const builderStrategy = createStrategy('builder');
      const soloStrategy = createStrategy('solo');

      expect(chatStrategy.getEstimatedSteps()).toBe(1);
      expect(builderStrategy.getEstimatedSteps()).toBe(4);
      expect(soloStrategy.getEstimatedSteps()).toBe(6);
    });
  });

  describe('工具注册表集成', () => {
    let registry: ToolRegistry;

    beforeEach(() => {
      registry = new ToolRegistry();
    });

    it('应该注册和获取工具', () => {
      const tool = {
        name: 'test_tool',
        execute: vi.fn().mockResolvedValue({ success: true, data: 'test' }),
        metadata: {
          name: 'test_tool',
          description: 'A test tool',
          category: 'code' as const,
          parameters: [],
        },
      };

      registry.register(tool);
      expect(registry.has('test_tool')).toBe(true);

      const retrieved = registry.get('test_tool');
      expect(retrieved?.name).toBe('test_tool');
    });

    it('应该按类别列出工具', () => {
      registry.register({
        name: 'tool1',
        execute: vi.fn(),
        metadata: {
          name: 'tool1',
          description: 'Tool 1',
          category: 'file' as const,
          parameters: [],
        },
      });

      registry.register({
        name: 'tool2',
        execute: vi.fn(),
        metadata: {
          name: 'tool2',
          description: 'Tool 2',
          category: 'code' as const,
          parameters: [],
        },
      });

      const fileTools = registry.listToolsByCategory('file');
      const codeTools = registry.listToolsByCategory('code');

      expect(fileTools).toContain('tool1');
      expect(codeTools).toContain('tool2');
    });

    it('应该搜索工具', () => {
      registry.register({
        name: 'read_file',
        execute: vi.fn(),
        metadata: {
          name: 'read_file',
          description: 'Read file from disk',
          category: 'file' as const,
          parameters: [],
        },
      });

      const results = registry.searchTools('read');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toBe('read_file');
    });

    it('应该执行工具', async () => {
      registry.register({
        name: 'test_tool',
        execute: vi.fn().mockResolvedValue({ success: true, data: 'test result' }),
        metadata: {
          name: 'test_tool',
          description: 'Test tool',
          category: 'code' as const,
          parameters: [],
        },
      });

      const result = await registry.execute('test_tool', { param: 'value' });
      expect(result.success).toBe(true);
      expect(result.data).toBe('test result');
    });

    it('应该获取统计信息', () => {
      registry.register({
        name: 'tool1',
        execute: vi.fn(),
        metadata: {
          name: 'tool1',
          description: 'Tool 1',
          category: 'file' as const,
          parameters: [],
        },
      });

      const stats = registry.getStats();
      expect(stats.totalTools).toBe(1);
      expect(stats.byCategory.file).toBe(1);
    });
  });

  describe('权限管理集成', () => {
    let permissionManager: ToolPermissionManager;

    beforeEach(() => {
      permissionManager = new ToolPermissionManager();
    });

    it('应该允许默认安全操作', () => {
      const result = permissionManager.checkPermission({
        toolName: 'read_file',
        params: { file_path: '/workspace/test.txt' },
        workspacePath: '/workspace',
      });

      expect(result.allowed).toBe(true);
    });

    it('应该拒绝危险操作', () => {
      const result = permissionManager.checkPermission({
        toolName: 'execute_command',
        params: { command: 'rm -rf /' },
        workspacePath: '/workspace',
      });

      expect(result.allowed).toBe(false);
    });

    it('应该需要确认危险操作', () => {
      const result = permissionManager.checkPermission({
        toolName: 'write_file',
        params: { file_path: '/workspace/test.txt' },
        workspacePath: '/workspace',
      });

      expect(result.allowed).toBe(true);
      expect(result.requiresConfirmation).toBe(true);
    });

    it('应该设置自定义权限', () => {
      permissionManager.setPermission({
        toolName: 'custom_tool',
        allowed: true,
        maxCallsPerTask: 5,
      });

      const result = permissionManager.checkPermission({
        toolName: 'custom_tool',
        params: {},
        workspacePath: '/workspace',
        taskId: 'task-1',
      });

      expect(result.allowed).toBe(true);
    });

    it('应该追踪调用次数', () => {
      permissionManager.setPermission({
        toolName: 'test_tool',
        allowed: true,
        maxCallsPerTask: 2,
      });

      permissionManager.checkPermission({
        toolName: 'test_tool',
        params: {},
        workspacePath: '/workspace',
        taskId: 'task-1',
      });

      permissionManager.checkPermission({
        toolName: 'test_tool',
        params: {},
        workspacePath: '/workspace',
        taskId: 'task-1',
      });

      const count = permissionManager.getCallCount('task-1', 'test_tool');
      expect(count).toBe(2);
    });
  });

  describe('完整流程集成', () => {
    it('应该执行完整的 Builder 流程', async () => {
      const stateMachine = new AgentStateMachine({ taskId: 'builder-task' });
      const contextManager = new AgentContextManager({
        taskId: 'builder-task',
        workspacePath: '/workspace',
        taskTitle: 'Build Task',
        taskDescription: 'Build a simple web app',
      });

      stateMachine.transition({ type: 'START' });
      expect(stateMachine.getState()).toBe('initializing');

      stateMachine.transition({ type: 'DONE' });
      expect(stateMachine.getState()).toBe('planning');

      stateMachine.transition({ type: 'DONE' });
      expect(stateMachine.getState()).toBe('executing');

      stateMachine.transition({ type: 'DONE' });
      expect(stateMachine.getState()).toBe('reviewing');

      stateMachine.transition({ type: 'APPROVED' });
      expect(stateMachine.getState()).toBe('completed');
    });

    it('应该执行完整的 Solo 流程', async () => {
      const stateMachine = new AgentStateMachine({ taskId: 'solo-task' });

      stateMachine.transition({ type: 'START' });
      stateMachine.transition({ type: 'DONE' });
      stateMachine.transition({ type: 'DONE' });
      stateMachine.transition({ type: 'DONE' });
      stateMachine.transition({ type: 'APPROVED' });

      expect(stateMachine.getState()).toBe('completed');
      expect(stateMachine.isFinalState()).toBe(true);
    });

    it('应该在错误时正确恢复', async () => {
      const stateMachine = new AgentStateMachine({ taskId: 'recovery-task' });

      stateMachine.transition({ type: 'START' });
      stateMachine.transition({ type: 'ERROR', error: 'Test error' });
      expect(stateMachine.getState()).toBe('failed');

      const context = stateMachine.getContext();
      expect(context.error).toBe('Test error');

      stateMachine.transition({ type: 'RETRY' });
      expect(stateMachine.getState()).toBe('initializing');
    });
  });
});
