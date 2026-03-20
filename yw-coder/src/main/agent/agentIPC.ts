/**
 * Agent IPC 接口
 * 提供主进程和渲染进程之间的通信
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { agentManager, AgentMode, AgentCallbacks } from './agent';
import { IPC_CHANNELS } from '../../shared/types';

// 存储活跃的 Agent 会话
const activeAgents: Map<string, {
  agent: any;
  webContents: any;
}> = new Map();

/**
 * 设置 Agent IPC 处理器
 */
export function setupAgentIPC(): void {
  // 创建 Agent
  ipcMain.handle(IPC_CHANNELS.AGENT_CREATE, async (event, {
    title,
    description,
    workspacePath,
    config,
    mode,
  }: {
    title: string;
    description: string;
    workspacePath: string;
    config: any;
    mode: AgentMode;
  }) => {
    const agent = agentManager.createAgent(
      title,
      description,
      workspacePath,
      config,
      mode,
      createCallbacks(event, agentManager.getAllAgents().length.toString())
    );

    const taskId = agent.getTask().id;
    activeAgents.set(taskId, {
      agent,
      webContents: event.sender,
    });

    return {
      taskId,
      task: agent.getTask(),
    };
  });

  // 启动 Agent
  ipcMain.handle(IPC_CHANNELS.AGENT_START, async (event, { taskId }: { taskId: string }) => {
    const session = activeAgents.get(taskId);
    if (!session) {
      throw new Error('Agent not found');
    }

    try {
      await session.agent.start();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // 暂停 Agent
  ipcMain.handle(IPC_CHANNELS.AGENT_PAUSE, (event, { taskId }: { taskId: string }) => {
    const session = activeAgents.get(taskId);
    if (!session) {
      throw new Error('Agent not found');
    }

    session.agent.pause();
    return { success: true };
  });

  // 恢复 Agent
  ipcMain.handle(IPC_CHANNELS.AGENT_RESUME, async (event, { taskId }: { taskId: string }) => {
    const session = activeAgents.get(taskId);
    if (!session) {
      throw new Error('Agent not found');
    }

    try {
      await session.agent.resume();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // 停止 Agent
  ipcMain.handle(IPC_CHANNELS.AGENT_STOP, (event, { taskId }: { taskId: string }) => {
    const session = activeAgents.get(taskId);
    if (!session) {
      throw new Error('Agent not found');
    }

    session.agent.stop();
    return { success: true };
  });

  // 获取 Agent 状态
  ipcMain.handle(IPC_CHANNELS.AGENT_GET_STATUS, (event, { taskId }: { taskId: string }) => {
    const session = activeAgents.get(taskId);
    if (!session) {
      throw new Error('Agent not found');
    }

    return session.agent.getTask();
  });

  // 获取所有 Agent
  ipcMain.handle(IPC_CHANNELS.AGENT_GET_ALL, () => {
    return agentManager.getAllAgents().map(agent => agent.getTask());
  });

  // 删除 Agent
  ipcMain.handle(IPC_CHANNELS.AGENT_DELETE, (event, { taskId }: { taskId: string }) => {
    activeAgents.delete(taskId);
    agentManager.removeAgent(taskId);
    return { success: true };
  });
}

/**
 * 创建 Agent 回调
 */
function createCallbacks(event: IpcMainInvokeEvent, taskId: string): AgentCallbacks {
  const send = (channel: string, data: any) => {
    if (!event.sender.isDestroyed()) {
      event.sender.send(channel, { taskId, ...data });
    }
  };

  return {
    onModeChange: (mode) => {
      send(IPC_CHANNELS.AGENT_EVENT_MODE_CHANGE, { mode });
    },
    onStepStart: (step) => {
      send(IPC_CHANNELS.AGENT_EVENT_STEP_START, { step });
    },
    onStepComplete: (step) => {
      send(IPC_CHANNELS.AGENT_EVENT_STEP_COMPLETE, { step });
    },
    onStepFail: (step, error) => {
      send(IPC_CHANNELS.AGENT_EVENT_STEP_FAIL, { step, error });
    },
    onMessage: (message) => {
      send(IPC_CHANNELS.AGENT_EVENT_MESSAGE, { message });
    },
    onThinking: (thinking) => {
      send(IPC_CHANNELS.AGENT_EVENT_THINKING, { thinking });
    },
    onToolCall: (toolCall) => {
      send(IPC_CHANNELS.AGENT_EVENT_TOOL_CALL, { toolCall });
    },
    onToolResult: (toolCall) => {
      send(IPC_CHANNELS.AGENT_EVENT_TOOL_RESULT, { toolCall });
    },
    onStatusChange: (status) => {
      send(IPC_CHANNELS.AGENT_EVENT_STATUS_CHANGE, { status });
    },
    onError: (error) => {
      send(IPC_CHANNELS.AGENT_EVENT_ERROR, { error });
    },
    onComplete: () => {
      send(IPC_CHANNELS.AGENT_EVENT_COMPLETE, {});
    },
  };
}
