/**
 * AgentStateMachine 单元测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AgentStateMachine, AgentState, AgentEvent } from './AgentStateMachine';

describe('AgentStateMachine', () => {
  let stateMachine: AgentStateMachine;

  beforeEach(() => {
    stateMachine = new AgentStateMachine({ taskId: 'test-task' });
  });

  afterEach(() => {
    stateMachine.reset();
  });

  describe('初始状态', () => {
    it('应该从 idle 状态开始', () => {
      expect(stateMachine.getState()).toBe('idle');
    });

    it('应该返回初始上下文', () => {
      const context = stateMachine.getContext();
      expect(context.taskId).toBe('test-task');
    });

    it('应该有空的转换历史', () => {
      const history = stateMachine.getHistory();
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].state).toBe('idle');
    });
  });

  describe('状态转换', () => {
    it('应该从 idle 转换到 initializing', () => {
      stateMachine.transition({ type: 'START' });
      expect(stateMachine.getState()).toBe('initializing');
    });

    it('应该从 initializing 转换到 planning', () => {
      stateMachine.transition({ type: 'START' });
      stateMachine.transition({ type: 'DONE' });
      expect(stateMachine.getState()).toBe('planning');
    });

    it('应该从 planning 转换到 executing', () => {
      stateMachine.transition({ type: 'START' });
      stateMachine.transition({ type: 'DONE' });
      stateMachine.transition({ type: 'DONE' });
      expect(stateMachine.getState()).toBe('executing');
    });

    it('应该从 executing 转换到 reviewing', () => {
      stateMachine.transition({ type: 'START' });
      stateMachine.transition({ type: 'DONE' });
      stateMachine.transition({ type: 'DONE' });
      stateMachine.transition({ type: 'DONE' });
      expect(stateMachine.getState()).toBe('reviewing');
    });

    it('应该从 reviewing 转换到 completed', () => {
      stateMachine.transition({ type: 'START' });
      stateMachine.transition({ type: 'DONE' });
      stateMachine.transition({ type: 'DONE' });
      stateMachine.transition({ type: 'DONE' });
      stateMachine.transition({ type: 'APPROVED' });
      expect(stateMachine.getState()).toBe('completed');
    });

    it('应该从 reviewing 转换回 executing (rejected)', () => {
      stateMachine.transition({ type: 'START' });
      stateMachine.transition({ type: 'DONE' });
      stateMachine.transition({ type: 'DONE' });
      stateMachine.transition({ type: 'DONE' });
      stateMachine.transition({ type: 'REJECTED' });
      expect(stateMachine.getState()).toBe('executing');
    });
  });

  describe('暂停和恢复', () => {
    it('应该从 planning 暂停到 paused', () => {
      stateMachine.transition({ type: 'START' });
      stateMachine.transition({ type: 'DONE' });
      stateMachine.transition({ type: 'PAUSE' });
      expect(stateMachine.getState()).toBe('paused');
    });

    it('应该从 paused 恢复到 executing', () => {
      stateMachine.transition({ type: 'START' });
      stateMachine.transition({ type: 'DONE' });
      stateMachine.transition({ type: 'PAUSE' });
      stateMachine.transition({ type: 'RESUME' });
      expect(stateMachine.getState()).toBe('executing');
    });

    it('应该从 paused 停止到 idle', () => {
      stateMachine.transition({ type: 'START' });
      stateMachine.transition({ type: 'DONE' });
      stateMachine.transition({ type: 'PAUSE' });
      stateMachine.transition({ type: 'STOP' });
      expect(stateMachine.getState()).toBe('idle');
    });
  });

  describe('错误处理', () => {
    it('应该从 initializing 失败到 failed', () => {
      stateMachine.transition({ type: 'START' });
      stateMachine.transition({ type: 'ERROR', error: 'Initialization failed' });
      expect(stateMachine.getState()).toBe('failed');
    });

    it('应该从 planning 失败到 failed', () => {
      stateMachine.transition({ type: 'START' });
      stateMachine.transition({ type: 'DONE' });
      stateMachine.transition({ type: 'ERROR', error: 'Planning failed' });
      expect(stateMachine.getState()).toBe('failed');
    });

    it('应该从 executing 失败到 failed', () => {
      stateMachine.transition({ type: 'START' });
      stateMachine.transition({ type: 'DONE' });
      stateMachine.transition({ type: 'DONE' });
      stateMachine.transition({ type: 'STEP_FAILED', error: 'Execution failed' });
      expect(stateMachine.getState()).toBe('failed');
    });

    it('应该从 failed 重试到 initializing', () => {
      stateMachine.transition({ type: 'START' });
      stateMachine.transition({ type: 'ERROR', error: 'Test error' });
      stateMachine.transition({ type: 'RETRY' });
      expect(stateMachine.getState()).toBe('initializing');
    });

    it('应该保存错误信息到上下文', () => {
      stateMachine.transition({ type: 'START' });
      stateMachine.transition({ type: 'ERROR', error: 'Test error message' });
      const context = stateMachine.getContext();
      expect(context.error).toBe('Test error message');
    });
  });

  describe('无效转换', () => {
    it('不应该从 idle 直接转换到 executing', () => {
      expect(() => {
        stateMachine.transition({ type: 'DONE' });
      }).toThrow('Invalid transition');
    });

    it('不应该从 completed 直接转换到 paused', () => {
      stateMachine.transition({ type: 'START' });
      stateMachine.transition({ type: 'DONE' });
      stateMachine.transition({ type: 'DONE' });
      stateMachine.transition({ type: 'DONE' });
      stateMachine.transition({ type: 'APPROVED' });

      expect(() => {
        stateMachine.transition({ type: 'PAUSE' });
      }).toThrow('Invalid transition');
    });

    it('不应该从 idle 直接转换到 reviewing', () => {
      expect(() => {
        stateMachine.transition({ type: 'STEP_COMPLETE' });
      }).toThrow('Invalid transition');
    });
  });

  describe('状态检查', () => {
    it('应该正确识别运行状态', () => {
      expect(stateMachine.isRunning()).toBe(false);

      stateMachine.transition({ type: 'START' });
      expect(stateMachine.isRunning()).toBe(true);

      stateMachine.transition({ type: 'DONE' });
      expect(stateMachine.isRunning()).toBe(true);

      stateMachine.transition({ type: 'DONE' });
      expect(stateMachine.isRunning()).toBe(true);

      stateMachine.transition({ type: 'DONE' });
      expect(stateMachine.isRunning()).toBe(true);

      stateMachine.transition({ type: 'APPROVED' });
      expect(stateMachine.isRunning()).toBe(false);
    });

    it('应该正确识别最终状态', () => {
      expect(stateMachine.isFinalState()).toBe(false);

      stateMachine.transition({ type: 'START' });
      expect(stateMachine.isFinalState()).toBe(false);

      stateMachine.transition({ type: 'DONE' });
      stateMachine.transition({ type: 'DONE' });
      stateMachine.transition({ type: 'DONE' });
      stateMachine.transition({ type: 'APPROVED' });
      expect(stateMachine.isFinalState()).toBe(true);
    });
  });

  describe('事件订阅', () => {
    it('应该正确订阅状态变化', () => {
      const listener = vi.fn();
      const unsubscribe = stateMachine.subscribe(listener);

      stateMachine.transition({ type: 'START' });

      expect(listener).toHaveBeenCalledWith('initializing', 'START');
      unsubscribe();
    });

    it('应该正确取消订阅', () => {
      const listener = vi.fn();
      const unsubscribe = stateMachine.subscribe(listener);
      unsubscribe();

      stateMachine.transition({ type: 'START' });

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('历史记录', () => {
    it('应该记录所有状态转换', () => {
      stateMachine.transition({ type: 'START' });
      stateMachine.transition({ type: 'DONE' });

      const history = stateMachine.getHistory();
      expect(history.length).toBeGreaterThanOrEqual(3);
    });

    it('应该限制历史记录数量', () => {
      for (let i = 0; i < 150; i++) {
        stateMachine.transition({ type: 'STOP' });
        stateMachine.transition({ type: 'START' });
      }

      const history = stateMachine.getHistory();
      expect(history.length).toBeLessThanOrEqual(100);
    });
  });

  describe('重置', () => {
    it('应该重置状态到 idle', () => {
      stateMachine.transition({ type: 'START' });
      stateMachine.transition({ type: 'DONE' });

      stateMachine.reset();

      expect(stateMachine.getState()).toBe('idle');
    });

    it('应该清除上下文', () => {
      stateMachine.transition({ type: 'START' });
      stateMachine.reset();

      const context = stateMachine.getContext();
      expect(Object.keys(context).length).toBe(0);
    });
  });

  describe('可用的转换', () => {
    it('应该返回当前状态可用的转换', () => {
      const events = stateMachine.getAvailableEvents();
      expect(events).toContain('START');
    });

    it('应该从 failed 状态返回 RETRY 和 STOP', () => {
      stateMachine.transition({ type: 'START' });
      stateMachine.transition({ type: 'ERROR', error: 'test' });

      const events = stateMachine.getAvailableEvents();
      expect(events).toContain('RETRY');
      expect(events).toContain('STOP');
    });
  });

  describe('序列化', () => {
    it('应该正确序列化状态机', () => {
      stateMachine.transition({ type: 'START' });
      const serialized = stateMachine.serialize();

      expect(serialized).toContain('"state":"initializing"');
      expect(serialized).toContain('"taskId":"test-task"');
    });

    it('应该正确反序列化状态机', () => {
      stateMachine.transition({ type: 'START' });
      const serialized = stateMachine.serialize();

      const restored = AgentStateMachine.deserialize(serialized);
      expect(restored.getState()).toBe('initializing');

      const context = restored.getContext();
      expect(context.taskId).toBe('test-task');
    });
  });

  describe('元数据', () => {
    it('应该返回完整的状态元数据', () => {
      stateMachine.transition({ type: 'START' });

      const metadata = stateMachine.getStateMetadata();

      expect(metadata.state).toBe('initializing');
      expect(metadata.isRunning).toBe(true);
      expect(metadata.isFinal).toBe(false);
      expect(metadata.availableEvents).toContain('DONE');
      expect(metadata.availableEvents).toContain('ERROR');
    });
  });

  describe('canTransition', () => {
    it('应该正确检查转换是否有效', () => {
      expect(stateMachine.canTransition('START')).toBe(true);
      expect(stateMachine.canTransition('DONE')).toBe(false);
    });

    it('应该从 paused 正确检查转换', () => {
      stateMachine.transition({ type: 'START' });
      stateMachine.transition({ type: 'DONE' });
      stateMachine.transition({ type: 'PAUSE' });

      expect(stateMachine.canTransition('RESUME')).toBe(true);
      expect(stateMachine.canTransition('STOP')).toBe(true);
      expect(stateMachine.canTransition('START')).toBe(false);
    });
  });
});
