/**
 * AgentContext 单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AgentContextManager, createAgentContext } from './AgentContext';

describe('AgentContextManager', () => {
  let contextManager: AgentContextManager;

  beforeEach(() => {
    contextManager = createAgentContext(
      'task-123',
      '/workspace/project',
      'Test Task',
      'This is a test task description'
    );
  });

  describe('初始化', () => {
    it('应该正确初始化上下文', () => {
      const context = contextManager.getContext();
      expect(context.taskId).toBe('task-123');
      expect(context.workspacePath).toBe('/workspace/project');
      expect(context.taskTitle).toBe('Test Task');
      expect(context.taskDescription).toBe('This is a test task description');
    });

    it('应该使用 createAgentContext 工厂函数创建', () => {
      const manager = createAgentContext(
        'task-456',
        '/workspace/other',
        'Another Task',
        'Another description'
      );

      expect(manager.getContext().taskId).toBe('task-456');
    });
  });

  describe('上下文更新', () => {
    it('应该更新上下文', () => {
      contextManager.updateContext({
        taskTitle: 'Updated Title',
        projectType: 'React',
      });

      const context = contextManager.getContext();
      expect(context.taskTitle).toBe('Updated Title');
      expect(context.projectType).toBe('React');
    });

    it('应该设置项目信息', () => {
      contextManager.setProjectInfo('Node.js', ['Express', 'TypeScript'], ['express', 'typescript']);

      const context = contextManager.getContext();
      expect(context.projectType).toBe('Node.js');
      expect(context.techStack).toEqual(['Express', 'TypeScript']);
      expect(context.dependencies).toEqual(['express', 'typescript']);
    });

    it('应该设置文件列表', () => {
      const files = ['src/index.ts', 'src/app.ts', 'package.json'];
      contextManager.setFiles(files);

      const context = contextManager.getContext();
      expect(context.files).toEqual(files);
    });
  });

  describe('分析文件管理', () => {
    it('应该添加分析文件', () => {
      const analyzedFile = {
        path: 'src/utils/helper.ts',
        purpose: '提供工具函数',
        dependencies: ['lodash'],
        exports: ['formatDate', 'formatNumber'],
      };

      contextManager.addAnalyzedFile(analyzedFile);

      const context = contextManager.getContext();
      expect(context.analyzedFiles).toHaveLength(1);
      expect(context.analyzedFiles?.[0].path).toBe('src/utils/helper.ts');
    });

    it('应该添加多个分析文件', () => {
      contextManager.addAnalyzedFile({
        path: 'file1.ts',
        purpose: 'purpose1',
        dependencies: [],
        exports: [],
      });

      contextManager.addAnalyzedFile({
        path: 'file2.ts',
        purpose: 'purpose2',
        dependencies: [],
        exports: [],
      });

      const context = contextManager.getContext();
      expect(context.analyzedFiles).toHaveLength(2);
    });
  });

  describe('需求管理', () => {
    it('应该添加需求', () => {
      const requirement = {
        id: 'req-1',
        description: '实现用户登录功能',
        priority: 'high' as const,
        status: 'pending' as const,
      };

      contextManager.addRequirement(requirement);

      const context = contextManager.getContext();
      expect(context.requirements).toHaveLength(1);
      expect(context.requirements?.[0].id).toBe('req-1');
    });

    it('应该更新需求', () => {
      contextManager.addRequirement({
        id: 'req-1',
        description: 'Test',
        priority: 'high',
        status: 'pending',
      });

      contextManager.updateRequirement('req-1', {
        status: 'completed',
      });

      const context = contextManager.getContext();
      expect(context.requirements?.[0].status).toBe('completed');
    });

    it('应该更新不存在的需求时不报错', () => {
      expect(() => {
        contextManager.updateRequirement('non-existent', { status: 'completed' });
      }).not.toThrow();
    });
  });

  describe('元数据管理', () => {
    it('应该设置和获取元数据', () => {
      contextManager.setMetadata('customKey', { value: 'test' });
      const value = contextManager.getMetadata<{ value: string }>('customKey');

      expect(value).toEqual({ value: 'test' });
    });

    it('应该获取不存在的元数据', () => {
      const value = contextManager.getMetadata('non-existent');
      expect(value).toBeUndefined();
    });

    it('应该覆盖已存在的元数据', () => {
      contextManager.setMetadata('key', 'value1');
      contextManager.setMetadata('key', 'value2');

      const value = contextManager.getMetadata<string>('key');
      expect(value).toBe('value2');
    });
  });

  describe('验证', () => {
    it('应该验证有效的上下文', () => {
      const result = contextManager.validate();
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该验证空的任务描述', () => {
      const manager = createAgentContext(
        'task-789',
        '/workspace/test',
        '',
        ''
      );

      const result = manager.validate();
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Task description is empty');
    });

    it('应该验证过短的任务描述', () => {
      const manager = createAgentContext(
        'task-789',
        '/workspace/test',
        '',
        'Short'
      );

      const result = manager.validate();
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Task description is too short');
    });

    it('应该产生警告当没有技术栈时', () => {
      const result = contextManager.validate();
      expect(result.warnings).toContain('No tech stack detected');
    });

    it('应该产生警告当没有文件时', () => {
      const result = contextManager.validate();
      expect(result.warnings).toContain('No files in workspace');
    });
  });

  describe('任务上下文转换', () => {
    it('应该转换为任务上下文格式', () => {
      contextManager.setProjectInfo('React', ['React', 'TypeScript'], ['react', 'typescript']);
      contextManager.setFiles(['src/App.tsx', 'src/index.tsx']);

      const taskContext = contextManager.toTaskContext();

      expect(taskContext.projectType).toBe('React');
      expect(taskContext.techStack).toEqual(['React', 'TypeScript']);
      expect(taskContext.files).toEqual(['src/App.tsx', 'src/index.tsx']);
    });
  });

  describe('序列化和反序列化', () => {
    it('应该正确序列化上下文', () => {
      contextManager.setProjectInfo('Vue', ['Vue', 'JavaScript'], ['vue']);
      const serialized = contextManager.serialize();

      expect(serialized).toContain('"projectType":"Vue"');
      expect(serialized).toContain('"taskId":"task-123"');
    });

    it('应该正确反序列化上下文', () => {
      contextManager.setProjectInfo('Angular', ['Angular', 'TypeScript'], ['@angular/core']);

      const serialized = contextManager.serialize();
      const restored = AgentContextManager.deserialize(serialized);

      const context = restored.getContext();
      expect(context.taskId).toBe('task-123');
      expect(context.projectType).toBe('Angular');
      expect(context.techStack).toEqual(['Angular', 'TypeScript']);
    });
  });

  describe('克隆', () => {
    it('应该正确克隆上下文管理器', () => {
      contextManager.setProjectInfo('Svelte', ['Svelte'], ['svelte']);
      contextManager.addAnalyzedFile({
        path: 'App.svelte',
        purpose: 'Main app',
        dependencies: [],
        exports: [],
      });

      const cloned = contextManager.clone();

      const originalContext = contextManager.getContext();
      const clonedContext = cloned.getContext();

      expect(clonedContext.taskId).toBe(originalContext.taskId);
      expect(clonedContext.projectType).toBe(originalContext.projectType);
      expect(clonedContext.analyzedFiles).toEqual(originalContext.analyzedFiles);
    });

    it('克隆应该独立于原始对象', () => {
      contextManager.setMetadata('key', 'original');

      const cloned = contextManager.clone();
      cloned.setMetadata('key', 'modified');

      const originalValue = contextManager.getMetadata<string>('key');
      const clonedValue = cloned.getMetadata<string>('key');

      expect(originalValue).toBe('original');
      expect(clonedValue).toBe('modified');
    });
  });

  describe('摘要', () => {
    it('应该返回正确的摘要', () => {
      contextManager.setProjectInfo('React Native', ['React', 'React Native'], []);
      contextManager.setFiles(['App.tsx', 'index.tsx']);
      contextManager.addRequirement({ id: 'r1', description: 'Req 1', priority: 'high', status: 'pending' });

      const summary = contextManager.getSummary();

      expect(summary.taskId).toBe('task-123');
      expect(summary.projectType).toBe('React Native');
      expect(summary.fileCount).toBe(2);
      expect(summary.requirementCount).toBe(1);
    });
  });

  describe('清空', () => {
    it('应该清空所有可选数据', () => {
      contextManager.setFiles(['file1.ts']);
      contextManager.addAnalyzedFile({ path: 'file1.ts', purpose: 'test', dependencies: [], exports: [] });
      contextManager.addRequirement({ id: 'r1', description: 'Req', priority: 'high', status: 'pending' });
      contextManager.setMetadata('key', 'value');

      contextManager.clear();

      const context = contextManager.getContext();
      expect(context.files).toBeUndefined();
      expect(context.analyzedFiles).toBeUndefined();
      expect(context.requirements).toBeUndefined();
      expect(context.metadata).toBeUndefined();
    });
  });
});
