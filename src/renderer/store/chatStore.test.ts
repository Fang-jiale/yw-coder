import { describe, it, expect, beforeEach } from 'vitest';
import { useChatStore } from './chatStore';

describe('chatStore', () => {
  beforeEach(() => {
    useChatStore.setState({
      sessions: [],
      currentSessionId: null,
      isStreaming: false,
      currentBuilderTask: null,
      availableProviders: {},
      aiConfigs: [],
      activeConfigId: null,
    });
  });

  it('should have initial state', () => {
    const state = useChatStore.getState();
    expect(state.sessions).toEqual([]);
    expect(state.currentSessionId).toBeNull();
    expect(state.isStreaming).toBe(false);
  });

  it('should create a new session', () => {
    const store = useChatStore.getState();
    const sessionId = store.createSession('chat');
    
    const state = useChatStore.getState();
    expect(state.sessions).toHaveLength(1);
    expect(state.sessions[0].id).toBe(sessionId);
  });

  it('should delete a session', () => {
    const store = useChatStore.getState();
    
    // 创建会话
    const sessionId = store.createSession('chat');
    
    // 删除会话
    store.deleteSession(sessionId);
    
    const state = useChatStore.getState();
    expect(state.sessions).toHaveLength(0);
  });

  it('should set current session', () => {
    const store = useChatStore.getState();
    
    // 创建会话
    const sessionId = store.createSession('chat');
    
    // 设置当前会话
    store.setCurrentSession(sessionId);
    
    const state = useChatStore.getState();
    expect(state.currentSessionId).toBe(sessionId);
  });

  it('should add message to session', () => {
    const store = useChatStore.getState();
    
    // 创建会话
    const sessionId = store.createSession('chat');
    
    // 添加消息
    store.addMessage(sessionId, {
      role: 'user',
      content: 'Hello',
    });
    
    const state = useChatStore.getState();
    const session = state.sessions.find(s => s.id === sessionId);
    expect(session?.messages).toHaveLength(1);
    expect(session?.messages[0].content).toBe('Hello');
  });

  it('should update session agent mode', () => {
    const store = useChatStore.getState();
    
    // 创建会话
    const sessionId = store.createSession('chat');
    
    // 更新 agent 模式
    store.updateSessionAgentMode(sessionId, 'build', 'build');
    
    const state = useChatStore.getState();
    const session = state.sessions.find(s => s.id === sessionId);
    expect(session?.agentMode).toBe('build');
  });

  it('should set active config', () => {
    const store = useChatStore.getState();
    store.setActiveConfig('config-1');
    
    const state = useChatStore.getState();
    expect(state.activeConfigId).toBe('config-1');
  });
});
