/**
 * Unified Agent IPC - 统一 Agent IPC 处理
 * 整合 Chat、Agent 和 SOLO 三种模式
 */

import { ipcMain, BrowserWindow, app } from 'electron';
import {
  AgentConfig,
  AgentTask,
  AgentMessage,
  AgentQuestion,
  createAgentConfig,
  TodoItem,
} from '../../shared/agentTypes';
import { AIProviderConfig } from '../../shared/types';
import { aiStreamService, StreamChunk } from '../services/aiStreamService';
import { DynamicSoloExecutor, ExecutionPlan, ExecutionPlanStep } from './solo/DynamicSoloExecutor';
import { BuilderExecutor, BuildPlan, BuildStep } from './builder/BuilderExecutor';
import * as fs from 'fs/promises';
import * as path from 'path';

// 调试模式开关
const DEBUG = process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development';

// 存储活跃的 Agent 会话
const activeTasks: Map<string, {
  task: AgentTask;
  config: AgentConfig;
  webContents: any;
  isRunning: boolean;
  isPaused: boolean;
  // 保存 executor 实例以便暂停/恢复操作
  soloExecutor?: DynamicSoloExecutor;
  agentExecutor?: any;
}> = new Map();

// 更新任务到磁盘
async function updateTaskOnDisk(updatedTask: AgentTask): Promise<void> {
  try {
    const tasks = await loadTasks();
    const index = tasks.findIndex(t => t.id === updatedTask.id);
    if (index >= 0) {
      tasks[index] = updatedTask;
    } else {
      tasks.push(updatedTask);
    }
    await saveTasks(tasks);
  } catch (error) {
    console.error('Failed to update task on disk:', error);
  }
}

// 获取存储目录 - 使用可写的目录（支持多个备选路径）
const getDataDir = () => {
  const possiblePaths = [
    // 首选：Electron 标准用户数据目录
    (() => {
      try {
        return app.getPath('userData');
      } catch {
        return null;
      }
    })(),
    // 备选1：应用所在目录
    process.cwd(),
    // 备选2：用户主目录
    require('os').homedir(),
    // 备选3：临时目录
    require('os').tmpdir(),
  ].filter(Boolean) as string[];

  for (const basePath of possiblePaths) {
    try {
      const testPath = path.join(basePath, '.test-write');
      const agentDataPath = path.join(basePath, 'agent-data');
      
      // 确保目录存在
      if (!require('fs').existsSync(basePath)) {
        require('fs').mkdirSync(basePath, { recursive: true });
      }
      
      // 测试写入权限
      require('fs').writeFileSync(testPath, 'test');
      require('fs').unlinkSync(testPath);
      
      DEBUG && console.log('[UnifiedAgentIPC] Using data dir:', agentDataPath);
      return agentDataPath;
    } catch (e) {
      DEBUG && console.warn('[UnifiedAgentIPC] Path not writable:', basePath);
      continue;
    }
  }

  // 如果所有路径都失败，使用临时目录（最后手段）
  const fallbackPath = path.join(require('os').tmpdir(), 'ywcoder-agent-data');
  console.error('[UnifiedAgentIPC] No writable path found, using fallback:', fallbackPath);
  return fallbackPath;
};

// 获取 AI 配置
async function getAIConfigs(): Promise<AIProviderConfig[]> {
  try {
    const dataDir = getDataDir();

    // 尝试多个可能的配置路径
    const possiblePaths = [
      path.join(dataDir.replace('agent-data', 'config'), 'settings.json'),
      path.join(dataDir.replace('agent-data', ''), 'config.json'),
      path.join(dataDir.replace('agent-data', ''), 'config', 'settings.json'),
    ];

    for (const configPath of possiblePaths) {
      try {
        const data = await fs.readFile(configPath, 'utf-8');
        const settings = JSON.parse(data);

        // 检查 settings.json 格式
        if (settings.aiConfigs && Array.isArray(settings.aiConfigs)) {
          return settings.aiConfigs;
        }

        // 检查 config.json 格式（旧的配置格式）
        if (settings.settings?.aiApiKey) {
          return [{
            id: 'default-ai-config',
            name: 'Default AI Config',
            provider: 'openai',
            apiKey: settings.settings.aiApiKey,
            model: settings.settings.aiModel || 'gpt-4',
            baseUrl: settings.settings.baseUrl,
            groupId: settings.settings.groupId,
            isDefault: true,
          }];
        }
      } catch {
        // 继续尝试下一个路径
      }
    }

    return [];
  } catch {
    return [];
  }
}

// 配置文件存储路径
const getConfigPath = () => path.join(getDataDir(), 'agent-configs.json');

// 任务存储路径
const getTasksPath = () => path.join(getDataDir(), 'agent-tasks.json');

// 保存所有任务到磁盘
async function saveTasks(tasks: AgentTask[]): Promise<void> {
  try {
    const tasksPath = getTasksPath();
    await fs.mkdir(path.dirname(tasksPath), { recursive: true });
    await fs.writeFile(tasksPath, JSON.stringify(tasks, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to save tasks:', error);
  }
}

// 从磁盘加载任务
async function loadTasks(): Promise<AgentTask[]> {
  try {
    const tasksPath = getTasksPath();
    const data = await fs.readFile(tasksPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

/**
 * 注册 Unified Agent IPC 处理器
 */
export function registerUnifiedAgentIPC(): void {
  // 获取所有配置
  ipcMain.handle('agent:config:get-all', async () => {
    try {
      const configPath = getConfigPath();
      await fs.mkdir(path.dirname(configPath), { recursive: true });

      try {
        const data = await fs.readFile(configPath, 'utf-8');
        const configs = JSON.parse(data);
        // 如果配置为空，尝试创建默认配置
        if (configs.length === 0) {
          const aiConfigs = await getAIConfigs();
          if (aiConfigs.length > 0) {
            await createDefaultConfigs(aiConfigs);
            // 重新读取配置
            const newData = await fs.readFile(configPath, 'utf-8');
            return JSON.parse(newData);
          }
        }
        return configs;
      } catch {
        // 文件不存在，尝试创建默认配置
        const aiConfigs = await getAIConfigs();
        if (aiConfigs.length > 0) {
          await createDefaultConfigs(aiConfigs);
          const newData = await fs.readFile(configPath, 'utf-8');
          return JSON.parse(newData);
        }
        return [];
      }
    } catch (error) {
      console.error('Failed to load configs:', error);
      return [];
    }
  });

  // 保存配置
  ipcMain.handle('agent:config:save', async (_, config: AgentConfig) => {
    try {
      const configPath = getConfigPath();
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      
      let configs: AgentConfig[] = [];
      try {
        const data = await fs.readFile(configPath, 'utf-8');
        configs = JSON.parse(data);
      } catch {
        // 文件不存在
      }
      
      const existingIndex = configs.findIndex(c => c.id === config.id);
      if (existingIndex >= 0) {
        configs[existingIndex] = config;
      } else {
        configs.push(config);
      }
      
      await fs.writeFile(configPath, JSON.stringify(configs, null, 2), 'utf-8');
      return { success: true };
    } catch (error: any) {
      console.error('Failed to save config:', error);
      return { success: false, error: error.message };
    }
  });

  // 删除配置
  ipcMain.handle('agent:config:delete', async (_, configId: string) => {
    try {
      const configPath = getConfigPath();

      let configs: AgentConfig[] = [];
      try {
        const data = await fs.readFile(configPath, 'utf-8');
        configs = JSON.parse(data);
      } catch {
        return { success: true };
      }

      configs = configs.filter(c => c.id !== configId);
      await fs.writeFile(configPath, JSON.stringify(configs, null, 2), 'utf-8');
      return { success: true };
    } catch (error: any) {
      console.error('Failed to delete config:', error);
      return { success: false, error: error.message };
    }
  });

  // 设置默认/活跃配置
  ipcMain.handle('agent:config:set-default', async (_, configId: string) => {
    try {
      const configPath = getConfigPath();

      let configs: AgentConfig[] = [];
      try {
        const data = await fs.readFile(configPath, 'utf-8');
        configs = JSON.parse(data);
      } catch {
        return { success: false, error: 'No configs found' };
      }

      // 更新配置的默认状态
      configs = configs.map(c => ({
        ...c,
        isDefault: c.id === configId
      }));

      await fs.writeFile(configPath, JSON.stringify(configs, null, 2), 'utf-8');
      return { success: true };
    } catch (error: any) {
      console.error('Failed to set default config:', error);
      return { success: false, error: error.message };
    }
  });

  // 更新默认 AI 配置（当切换 AI 配置时同步更新 Agent 配置）
  ipcMain.handle('agent:config:update-default-ai', async (_, aiConfig: AIProviderConfig) => {
    try {
      const configPath = getConfigPath();

      let configs: AgentConfig[] = [];
      try {
        const data = await fs.readFile(configPath, 'utf-8');
        configs = JSON.parse(data);
      } catch {
        // 文件不存在
        return { success: false, error: 'No agent configs found' };
      }

      // 更新所有 Agent 配置的默认 AI 配置
      let updated = false;
      configs = configs.map(agentConfig => {
        // 更新默认配置或所有配置
        if (agentConfig.isDefault || true) { // 更新所有配置
          updated = true;
          return {
            ...agentConfig,
            aiConfig: aiConfig,
          };
        }
        return agentConfig;
      });

      if (updated) {
        await fs.writeFile(configPath, JSON.stringify(configs, null, 2), 'utf-8');
      }

      return { success: true };
    } catch (error: any) {
      console.error('Failed to update default AI config:', error);
      return { success: false, error: error.message };
    }
  });

  // 创建任务
  ipcMain.handle('agent:task:create', async (event, {
    title,
    description,
    workspacePath,
    configId,
  }: {
    title: string;
    description: string;
    workspacePath: string;
    configId: string;
  }) => {
    try {
      // 加载配置
      let configs = await loadConfigs();
      console.log(`[agent:task:start] Loaded ${configs.length} configs`);

      let config = configs.find(c => c.id === configId);

      // 如果配置不存在，尝试使用第一个可用配置
      if (!config && configs.length > 0) {
        config = configs[0];
        console.log(`[agent:task:start] Config not found for ${configId}, using first available: ${config.id}`);
      }

      if (!config) {
        console.error(`[agent:task:start] No config found for ${configId} and no configs available`);
        throw new Error('Config not found. Please configure an AI provider first.');
      }

      // 检查 AI 配置
      if (!config.aiConfig) {
        console.error(`[agent:task:start] Config ${config.id} has no aiConfig`);
        throw new Error('Agent config is missing AI configuration. Please reconfigure the agent.');
      }

      console.log(`[agent:task:start] Using config: ${config.id}, type: ${config.type}, aiConfig: ${config.aiConfig.model || 'unknown'}`);

      const task: AgentTask = {
        id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title,
        description,
        agentId: config.id,
        configId: config.id, // 使用实际找到的配置ID
        agentType: config.type,
        status: 'pending',
        workspacePath,
        steps: [],
        currentStepIndex: 0,
        messages: [],
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
      };

      activeTasks.set(task.id, {
        task,
        config,
        webContents: event.sender,
        isRunning: false,
        isPaused: false,
      });

      // 保存任务到磁盘
      const existingTasks = await loadTasks();
      existingTasks.push(task);
      await saveTasks(existingTasks);

      return { taskId: task.id, task };
    } catch (error: any) {
      console.error('Failed to create task:', error);
      throw error;
    }
  });

  // 启动任务
  ipcMain.handle('agent:task:start', async (event, { taskId }: { taskId: string }) => {
    const session = activeTasks.get(taskId);
    if (!session) {
      console.error(`[UnifiedAgentIPC] Task not found: ${taskId}`);
      throw new Error('Task not found');
    }

    if (session.isRunning) {
      console.warn(`[UnifiedAgentIPC] Task is already running: ${taskId}`);
      throw new Error('Task is already running');
    }

    console.log(`[UnifiedAgentIPC] Starting task: ${taskId}, agentType: ${session.config.type}`);

    session.isRunning = true;
    session.isPaused = false;
    session.task.status = 'running';
    session.task.updatedAt = Date.now();

    // 立即返回成功，异步执行实际任务
    // 根据模式执行不同的处理逻辑
    switch (session.config.type) {
      case 'solocoder':
        // SOLO 模式：异步执行，不阻塞 IPC 响应
        executeSoloMode(session).catch(error => {
          console.error(`[UnifiedAgentIPC] SOLO mode execution error:`, error);
          session.isRunning = false;
          session.task.status = 'failed';
          broadcastToRenderer('agent:event:error', {
            taskId,
            error: error.message || '执行失败'
          });
          broadcastToRenderer('agent:event:status-change', {
            taskId,
            status: 'failed'
          });
        });
        break;
      case 'builder':
        // Agent 模式：异步执行
        executeAgentMode(session).catch(error => {
          console.error(`[UnifiedAgentIPC] Agent mode execution error:`, error);
          session.isRunning = false;
          session.task.status = 'failed';
          broadcastToRenderer('agent:event:error', {
            taskId,
            error: error.message || '执行失败'
          });
          broadcastToRenderer('agent:event:status-change', {
            taskId,
            status: 'failed'
          });
        });
        break;
      case 'chat':
        // Chat 模式通过 send-message 处理
        break;
    }

    return { success: true, taskId, mode: session.config.type };
  });

  // 发送消息 (仅 Chat 模式使用)
  ipcMain.handle('agent:task:send-message', async (_, { taskId, content, aiConfig }: { taskId: string; content: string; aiConfig?: AIProviderConfig }) => {
    let session = activeTasks.get(taskId);

    // 如果任务不在内存中，从磁盘加载并恢复
    if (!session) {
      const tasks = await loadTasks();
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        const configs = await loadConfigs();
        const config = configs.find(c => c.id === task.configId);
        if (config) {
          session = {
            task,
            config,
            webContents: null,
            isRunning: false,
            isPaused: false,
          };
          activeTasks.set(taskId, session);
          console.log('[UnifiedAgentIPC] Session restored from disk');
        } else {
          console.error('[UnifiedAgentIPC] Config not found for task:', task.configId);
        }
      }
    }

    if (!session) {
      throw new Error('Task not found');
    }

    // 只有 Chat 模式使用 send-message，SOLO 和 Agent 模式使用 start-task
    if (session.config.type !== 'chat') {
      // 对于 SOLO 和 Agent 模式，只需添加消息，不执行 Chat 逻辑
      const userMessage: AgentMessage = {
        id: Date.now().toString(),
        role: 'user',
        content,
        timestamp: Date.now(),
      };
      session.task.messages.push(userMessage);
      // 保存任务到磁盘
      await updateTaskOnDisk(session.task);
      return { success: true };
    }

    // 使用传入的 AI 配置（对话框当前选择的），如果没有则使用 session 中的配置
    const effectiveAIConfig = aiConfig || session.config.aiConfig;

    await executeChatMode(session, content, effectiveAIConfig);
    // 保存任务到磁盘
    await updateTaskOnDisk(session.task);
    return { success: true };
  });

  // 暂停任务
  ipcMain.handle('agent:task:pause', async (_, { taskId }: { taskId: string }) => {
    const session = activeTasks.get(taskId);
    if (!session) {
      throw new Error('Task not found');
    }

    session.isRunning = false;
    session.isPaused = true;
    session.task.status = 'paused';
    session.task.updatedAt = Date.now();

    // 调用 executor 的 pause 方法停止执行
    if (session.soloExecutor) {
      session.soloExecutor.pause();
    }
    // 如果有其他 executor，也调用它们的 pause 方法
    if (session.agentExecutor?.pause) {
      session.agentExecutor.pause();
    }

    // 保存任务到磁盘
    await updateTaskOnDisk(session.task);

    broadcastToRenderer('agent:event:status-change', { taskId, status: 'paused' });
    return { success: true };
  });

  // 恢复任务
  ipcMain.handle('agent:task:resume', async (_, { taskId }: { taskId: string }) => {
    const session = activeTasks.get(taskId);
    if (!session) {
      throw new Error('Task not found');
    }

    session.isRunning = true;
    session.isPaused = false;
    session.task.status = 'running';
    session.task.updatedAt = Date.now();

    // 根据模式恢复执行
    switch (session.config.type) {
      case 'solocoder':
        await executeSoloMode(session);
        break;
      case 'builder':
        await executeAgentMode(session);
        break;
    }

    return { success: true };
  });

  // 停止任务
  ipcMain.handle('agent:task:stop', async (_, { taskId }: { taskId: string }) => {
    const session = activeTasks.get(taskId);
    if (!session) {
      throw new Error('Task not found');
    }

    session.isRunning = false;
    session.isPaused = false;
    session.task.status = 'failed';
    session.task.updatedAt = Date.now();

    // 调用 executor 的 stop 方法停止执行
    if (session.soloExecutor) {
      session.soloExecutor.stop();
    }
    // 如果有其他 executor，也调用它们的 stop 方法
    if (session.agentExecutor?.stop) {
      session.agentExecutor.stop();
    }

    // 保存任务到磁盘
    await updateTaskOnDisk(session.task);

    broadcastToRenderer('agent:event:status-change', { taskId, status: 'failed' });
    broadcastToRenderer('agent:event:complete', { taskId });
    return { success: true };
  });

  // 删除任务
  ipcMain.handle('agent:task:delete', async (_, { taskId }: { taskId: string }) => {
    activeTasks.delete(taskId);
    
    // 从磁盘删除
    try {
      const tasks = await loadTasks();
      const filteredTasks = tasks.filter(t => t.id !== taskId);
      await saveTasks(filteredTasks);
    } catch (error) {
      console.error('Failed to delete task from disk:', error);
    }
    
    return { success: true };
  });

  // 保存任务（前端调用以保存任务状态）
  ipcMain.handle('agent:task:save', async (_, { task }: { task: AgentTask }) => {
    try {
      // 更新内存中的任务
      const session = activeTasks.get(task.id);
      if (session) {
        session.task = task;
      }
      // 保存到磁盘
      await updateTaskOnDisk(task);
      return { success: true };
    } catch (error: any) {
      console.error('Failed to save task:', error);
      return { success: false, error: error.message };
    }
  });

  // 获取所有任务
  ipcMain.handle('agent:task:get-all', async () => {
    // 从磁盘加载任务
    const savedTasks = await loadTasks();
    
    // 合并内存中的任务状态（如果有）
    const mergedTasks = savedTasks.map(savedTask => {
      const activeTask = activeTasks.get(savedTask.id);
      if (activeTask) {
        // 使用内存中的最新状态
        return activeTask.task;
      }
      return savedTask;
    });
    
    // 将内存中有但磁盘上没有的任务也加入（新创建的任务）
    for (const [taskId, session] of activeTasks) {
      if (!mergedTasks.find(t => t.id === taskId)) {
        mergedTasks.push(session.task);
      }
    }
    
    return mergedTasks;
  });

  // 回答 Agent 问题
  ipcMain.handle('agent:task:answer', async (_, { taskId, questionId, answer }: { taskId: string; questionId: string; answer: string }) => {
    const session = activeTasks.get(taskId);
    if (!session) {
      throw new Error('Task not found');
    }

    console.log('[agent:task:answer] Answering question:', questionId, 'with:', answer);

    // 更新问题状态
    const message = session.task.messages.find(m => m.agentQuestions?.some(q => q.id === questionId));
    if (message) {
      const question = message.agentQuestions?.find(q => q.id === questionId);
      if (question) {
        question.status = 'answered';
        question.answer = answer;
      }
    }

    // 添加用户回答作为新的用户消息
    const userMessage: AgentMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: answer,
      timestamp: Date.now(),
    };
    session.task.messages.push(userMessage);

    // 广播用户消息到渲染进程
    broadcastToRenderer('agent:event:message', {
      taskId,
      message: userMessage,
    });

    // 立即保存任务到磁盘，确保用户回答被持久化
    await updateTaskOnDisk(session.task);

    // 继续 AI 对话
    console.log('[agent:task:answer] Continuing AI conversation...');
    try {
      // 重新启动对话流，传入 AI 配置
      await executeChatMode(session, '', session.config.aiConfig);
    } catch (error) {
      console.error('[agent:task:answer] Error continuing conversation:', error);
      throw error;
    }

    return { success: true };
  });
}

/**
 * 加载配置
 */
async function loadConfigs(): Promise<AgentConfig[]> {
  try {
    const configPath = getConfigPath();
    const data = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

/**
 * 执行 Chat 模式
 */
async function executeChatMode(session: any, content: string, aiConfig?: AIProviderConfig): Promise<void> {
  const { task, config } = session;

  // 使用传入的 AI 配置，如果没有则使用 session 中的配置
  const effectiveAIConfig = aiConfig || config.aiConfig;

  // 设置 isRunning 为 true，确保 isRunning 检查通过
  session.isRunning = true;
  session.isPaused = false;

  // 添加用户消息到任务历史（如果 content 不为空）
  if (content) {
    const userMessage: AgentMessage = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: Date.now(),
    };
    task.messages.push(userMessage);
    DEBUG && console.log(`[executeChatMode] User message added to task:`, userMessage.id);
  }

  return new Promise((resolve, reject) => {
    let fullContent = '';
    let thinking = '';
    // 累积工具调用，用于保存到历史消息
    const toolCalls: Array<{
      id: string;
      toolName: string;
      params: any;
      status: 'running' | 'completed' | 'error';
      result?: any;
      error?: string;
    }> = [];
    // 暂存的问题，将在 AI 消息创建时添加
    const pendingQuestions: AgentQuestion[] = [];
    // 累积 todo 信息，用于保存到历史消息
    let lastTodoItems: TodoItem[] = [];

    const handleChunk = (chunk: StreamChunk) => {
      switch (chunk.type) {
        case 'thinking':
          thinking += chunk.content || '';
          broadcastToRenderer('agent:event:stream-thinking', {
            taskId: task.id,
            thinking: chunk.content
          });
          break;
        case 'thinking_complete':
          // 思考过程完成，发送完整思考内容
          thinking = chunk.content || thinking;
          broadcastToRenderer('agent:event:thinking-complete', {
            taskId: task.id,
            thinking
          });
          break;
        case 'content':
          fullContent += chunk.content || '';
          DEBUG && console.log('[executeChatMode] Sending stream-content:', chunk.content?.slice(0, 50), '...');
          broadcastToRenderer('agent:event:stream-content', {
            taskId: task.id,
            content: chunk.content
          });
          break;
        case 'tool_start': {
          const toolCallId = chunk.toolCallId || `tool_${Date.now()}`;
          DEBUG && console.log(`[executeChatMode] Tool started: ${toolCallId}, name: ${chunk.toolName}`);
          const toolCall = {
            id: toolCallId,
            toolName: chunk.toolName || '',
            params: chunk.toolParams || {},
            status: 'running' as const,
          };
          toolCalls.push(toolCall);
          DEBUG && console.log(`[executeChatMode] Total toolCalls: ${toolCalls.length}`);
          broadcastToRenderer('agent:event:tool-call', {
            taskId: task.id,
            toolCall,
          });
          break;
        }
        case 'tool_end': {
          const toolCallId = chunk.toolCallId;
          if (!toolCallId) {
            console.error('[executeChatMode] tool_end event missing toolCallId');
            break;
          }
          const existingToolCall = toolCalls.find(tc => tc.id === toolCallId);
          if (existingToolCall) {
            existingToolCall.status = chunk.toolResult?.success ? 'completed' : 'error';
            existingToolCall.result = chunk.toolResult?.data;
            existingToolCall.error = chunk.toolResult?.error;
            DEBUG && console.log(`[executeChatMode] Tool call updated: ${toolCallId}, status: ${existingToolCall.status}`);
          } else {
            console.error(`[executeChatMode] Tool call not found: ${toolCallId}`);
          }
          broadcastToRenderer('agent:event:tool-result', {
            taskId: task.id,
            toolCall: {
              id: toolCallId,
              toolName: chunk.toolName || '',
              params: {},
              status: chunk.toolResult?.success ? 'completed' : 'error',
              result: chunk.toolResult?.data,
              error: chunk.toolResult?.error,
            },
          });
          break;
        }
        case 'todo_update':
          if (chunk.todoItems) {
            // 添加 createdAt 和 updatedAt 字段以符合 TodoItem 类型
            lastTodoItems = chunk.todoItems.map((item: any) => ({
              ...item,
              createdAt: item.createdAt || Date.now(),
              updatedAt: item.updatedAt || Date.now(),
            }));
            broadcastToRenderer('agent:event:todo-update', {
              taskId: task.id,
              items: lastTodoItems,
            });
          }
          break;
        case 'agent_question':
          if (chunk.question) {
            // 暂存问题，将在 AI 消息创建时添加
            const fullQuestion: AgentQuestion = {
              ...chunk.question,
              status: 'pending',
              createdAt: Date.now(),
            };
            pendingQuestions.push(fullQuestion);
            DEBUG && console.log(`[executeChatMode] Question received, queued:`, fullQuestion.id, 'pending count:', pendingQuestions.length);
            
            broadcastToRenderer('agent:event:question', {
              taskId: task.id,
              question: fullQuestion,
            });
          }
          break;
        case 'done': {
          // 添加 AI 消息，包含工具调用和暂存的问题
          DEBUG && console.log(`[executeChatMode] Saving AI message with ${toolCalls.length} toolCalls, ${pendingQuestions.length} questions`);
          // 构建 contentBlocks，包含 todo 信息
          const contentBlocks: Array<{ type: 'text' | 'thinking' | 'question' | 'todo'; content?: string; thinking?: string; question?: AgentQuestion; todoItems?: TodoItem[]; timestamp: number }> = [];
          if (lastTodoItems.length > 0) {
            contentBlocks.push({
              type: 'todo',
              todoItems: lastTodoItems,
              timestamp: Date.now(),
            });
          }

          const aiMessage: AgentMessage = {
            id: Date.now().toString(),
            role: 'assistant',
            content: fullContent,
            timestamp: Date.now(),
            thinking,
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
            agentQuestions: pendingQuestions.length > 0 ? pendingQuestions : undefined,
            contentBlocks: contentBlocks.length > 0 ? contentBlocks : undefined,
          };
          task.messages.push(aiMessage);
          DEBUG && console.log(`[executeChatMode] AI message saved with toolCalls:`, aiMessage.toolCalls?.length, 'questions:', aiMessage.agentQuestions?.length);

          session.isRunning = false;
          task.status = 'completed';

          // 先广播消息，确保 UI 立即更新
          broadcastToRenderer('agent:event:message', {
            taskId: task.id,
            message: aiMessage
          });
          broadcastToRenderer('agent:event:status-change', {
            taskId: task.id,
            status: 'completed'
          });
          broadcastToRenderer('agent:event:complete', { taskId: task.id });

          // 然后异步保存任务到磁盘
          updateTaskOnDisk(task).then(() => {
            resolve();
          });
          break;
        }
        case 'error': {
          session.isRunning = false;
          task.status = 'failed';
          // 保存任务到磁盘
          updateTaskOnDisk(task).then(() => {
            broadcastToRenderer('agent:event:error', {
              taskId: task.id,
              error: chunk.error
            });
            broadcastToRenderer('agent:event:status-change', {
              taskId: task.id,
              status: 'failed'
            });
          });
          reject(new Error(chunk.error));
          break;
        }
      }
    };

    // 构建历史消息
    const history = task.messages.map((m: AgentMessage) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    // 调用 AI 流式服务，使用当前选择的 AI 配置
    aiStreamService.streamExecute(
      content,
      task.workspacePath,
      effectiveAIConfig,
      handleChunk,
      { history, isRunning: () => session.isRunning && !session.isPaused }
    ).catch(async (error: any) => {
      console.error('[executeChatMode] streamExecute error:', error);
      session.isRunning = false;
      task.status = 'failed';
      await updateTaskOnDisk(task);
      broadcastToRenderer('agent:event:error', {
        taskId: task.id,
        error: error.message || 'AI 服务调用失败'
      });
      reject(error);
    });
  });
}

/**
 * 执行 Agent 模式 (Builder 模式)
 * 使用 BuilderExecutor 实现 Plan-Build-Review 循环
 */
async function executeAgentMode(session: any): Promise<void> {
  const { task, config } = session;

  console.log(`[executeAgentMode] Starting Builder mode with BuilderExecutor for task: ${task.id}`);
  console.log(`[executeAgentMode] Config: ${config?.id}, type: ${config?.type}`);
  console.log(`[executeAgentMode] AI Config: ${config?.aiConfig ? config.aiConfig.model : 'MISSING'}`);

  // 检查配置
  if (!config?.aiConfig) {
    console.error('[executeAgentMode] ERROR: Config or aiConfig is missing!');
    broadcastToRenderer('agent:event:error', {
      taskId: task.id,
      error: 'AI configuration is missing. Please configure an AI provider first.'
    });
    throw new Error('AI configuration is missing');
  }

  try {
    // 创建 BuilderExecutor 实例
    const executor = new BuilderExecutor(task, config);
    
    // 保存 executor 实例到 session，以便暂停/恢复操作
    session.agentExecutor = executor;

    // 设置事件监听
    executor.on('phase:start', (phase: string) => {
      broadcastToRenderer('agent:event:phase-start', {
        taskId: task.id,
        phase,
      });
    });

    executor.on('phase:complete', (phase: string) => {
      broadcastToRenderer('agent:event:phase-complete', {
        taskId: task.id,
        phase,
      });
    });

    executor.on('step:start', (step: BuildStep) => {
      broadcastToRenderer('agent:event:step-start', {
        taskId: task.id,
        step: {
          id: step.id,
          type: step.phase,
          description: step.description,
          status: 'in_progress',
          startTime: step.startTime,
        },
      });
    });

    executor.on('step:complete', (step: BuildStep) => {
      broadcastToRenderer('agent:event:step-complete', {
        taskId: task.id,
        step: {
          id: step.id,
          type: step.phase,
          description: step.description,
          status: 'completed',
          endTime: step.endTime,
        },
      });
    });

    executor.on('step:error', (step: BuildStep, error: string) => {
      broadcastToRenderer('agent:event:step-fail', {
        taskId: task.id,
        step: {
          id: step.id,
          type: step.phase,
          description: step.description,
          status: 'failed',
          endTime: Date.now(),
        },
        error,
      });
    });

    executor.on('status', (message: string) => {
      broadcastToRenderer('agent:event:progress', {
        taskId: task.id,
        message,
      });
    });

    executor.on('thinking', (content: string) => {
      broadcastToRenderer('agent:event:thinking', {
        taskId: task.id,
        content,
      });
    });

    executor.on('content', (content: string) => {
      broadcastToRenderer('agent:event:content', {
        taskId: task.id,
        content,
      });
    });

    executor.on('tool:start', (toolCall: any) => {
      broadcastToRenderer('agent:event:tool-start', {
        taskId: task.id,
        toolCall,
      });
    });

    executor.on('tool:end', (result: any) => {
      broadcastToRenderer('agent:event:tool-end', {
        taskId: task.id,
        result,
      });
    });

    executor.on('message', (message: AgentMessage) => {
      broadcastToRenderer('agent:event:message', {
        taskId: task.id,
        message,
      });
    });

    executor.on('complete', (result: any) => {
      console.log(`[BuilderExecutor] Build completed:`, result);
      session.isRunning = false;
      task.status = 'completed';
      broadcastToRenderer('agent:event:complete', { 
        taskId: task.id,
        result,
      });
    });

    executor.on('error', (error: string) => {
      console.error(`[BuilderExecutor] Build error:`, error);
      session.isRunning = false;
      task.status = 'failed';
      broadcastToRenderer('agent:event:error', { 
        taskId: task.id, 
        error 
      });
    });

    // 开始执行
    await executor.execute();

  } catch (error: any) {
    console.error(`[executeAgentMode] Error:`, error);
    session.isRunning = false;
    task.status = 'failed';
    broadcastToRenderer('agent:event:error', { 
      taskId: task.id, 
      error: error.message 
    });
  }
}

/**
 * 执行 SOLO 模式
 * 使用 DynamicSoloExecutor 实现 AI 动态生成的执行流程
 */
async function executeSoloMode(session: any): Promise<void> {
  const { task, config } = session;

  console.log(`[executeSoloMode] Starting SOLO mode with DynamicSoloExecutor for task: ${task.id}`);

  // 创建初始 AI 消息用于流式展示
  const aiMessage: AgentMessage = {
    id: `solo-${Date.now()}`,
    role: 'assistant',
    content: '',
    timestamp: Date.now(),
  };
  task.messages.push(aiMessage);
  broadcastToRenderer('agent:event:message', {
    taskId: task.id,
    message: aiMessage,
  });

  // 累积流式内容
  let accumulatedContent = '';
  let accumulatedThinking = '';
  // 累积工具调用，用于保存到历史消息（与 chat 模式保持一致）
  const toolCalls: Array<{
    id: string;
    toolName: string;
    params: any;
    status: 'running' | 'completed' | 'error';
    result?: any;
    error?: string;
  }> = [];

  try {
    // 创建 DynamicSoloExecutor 实例
    const executor = new DynamicSoloExecutor(task, config);
    
    // 保存 executor 实例到 session，以便暂停/恢复操作
    session.soloExecutor = executor;

    // 设置事件监听
    executor.on('status', (message: string) => {
      broadcastToRenderer('agent:event:progress', {
        taskId: task.id,
        message,
      });
    });

    // 监听内容事件，累积到 AI 消息
    executor.on('content', (content: string) => {
      accumulatedContent += content;
      // 更新 AI 消息内容
      aiMessage.content = accumulatedContent;
      broadcastToRenderer('agent:event:stream-content', {
        taskId: task.id,
        content,
      });
    });

    // 监听思考内容
    executor.on('thinking', (thinking: string) => {
      accumulatedThinking += thinking;
      broadcastToRenderer('agent:event:stream-thinking', {
        taskId: task.id,
        thinking,
      });
    });

    executor.on('plan:generated', async (plan: ExecutionPlan) => {
      console.log(`[DynamicSoloExecutor] Plan generated with ${plan.steps.length} steps`);
      broadcastToRenderer('agent:event:plan-generated', {
        taskId: task.id,
        plan,
      });
      // 同时更新 todoItems 保持兼容性
      const now = Date.now();
      const newTodoItems = plan.steps.map(s => ({
        id: s.id,
        content: s.name,
        status: s.status,
        priority: 'medium' as const,
        createdAt: now,
        updatedAt: now,
      }));
      task.todoItems = newTodoItems;
      broadcastToRenderer('agent:event:todo-update', {
        taskId: task.id,
        items: task.todoItems,
      });
      // 保存执行计划到 AI 消息中（用于在对话中展示）
      aiMessage.executionPlan = plan;
      // 将 todoItems 添加到 contentBlocks 中保存到历史记录
      if (!aiMessage.contentBlocks) {
        aiMessage.contentBlocks = [];
      }
      aiMessage.contentBlocks.push({
        type: 'todo',
        todoItems: newTodoItems,
        timestamp: Date.now(),
      });
      // 保存任务到磁盘
      task.executionPlan = plan;
      await updateTaskOnDisk(task);
    });

    executor.on('step:start', (step: ExecutionPlanStep) => {
      broadcastToRenderer('agent:event:step-start', {
        taskId: task.id,
        step: {
          id: step.id,
          type: step.type,
          description: step.description,
          status: 'in_progress',
          startTime: Date.now(),
        },
      });
      // 添加到任务步骤
      task.steps.push({
        id: step.id,
        type: step.type,
        description: step.description,
        status: 'in_progress',
        startTime: Date.now(),
      });
    });

    executor.on('step:complete', (step: ExecutionPlanStep) => {
      broadcastToRenderer('agent:event:step-complete', {
        taskId: task.id,
        step: {
          id: step.id,
          type: step.type,
          description: step.description,
          status: 'completed',
          endTime: Date.now(),
          result: step.result,
        },
      });
      // 更新 todoItems
      const todoItem = task.todoItems.find((t: { id: string }) => t.id === step.id);
      if (todoItem) {
        todoItem.status = 'completed';
        broadcastToRenderer('agent:event:todo-update', {
          taskId: task.id,
          items: task.todoItems,
        });
      }
    });

    executor.on('step:error', (step: ExecutionPlanStep, error: string) => {
      broadcastToRenderer('agent:event:step-fail', {
        taskId: task.id,
        step: {
          id: step.id,
          type: step.type,
          description: step.description,
          status: 'failed',
          endTime: Date.now(),
        },
        error,
      });
    });

    executor.on('progress', (progress: number) => {
      broadcastToRenderer('agent:event:progress-update', {
        taskId: task.id,
        progress,
      });
    });

    executor.on('tool:start', (toolCall: any) => {
      const toolCallData = {
        id: toolCall.id || `tool_${Date.now()}`,
        toolName: toolCall.name || '',
        params: toolCall.params || {},
        status: 'running' as const,
      };
      toolCalls.push(toolCallData);
      broadcastToRenderer('agent:event:tool-call', {
        taskId: task.id,
        toolCall: toolCallData,
      });
    });

    executor.on('tool:end', (toolCall: any) => {
      const existingToolCall = toolCalls.find(tc => tc.id === toolCall.id);
      if (existingToolCall) {
        existingToolCall.status = toolCall.result?.success ? 'completed' : 'error';
        existingToolCall.result = toolCall.result?.data;
        existingToolCall.error = toolCall.result?.error;
      }
      broadcastToRenderer('agent:event:tool-result', {
        taskId: task.id,
        toolCall: {
          id: toolCall.id,
          toolName: toolCall.name || '',
          params: {},
          status: toolCall.result?.success ? 'completed' : 'error',
          result: toolCall.result?.data,
          error: toolCall.result?.error,
        },
      });
    });

    executor.on('summary', (summary: any) => {
      broadcastToRenderer('agent:event:summary', {
        taskId: task.id,
        summary,
      });
    });

    executor.on('error', (error: string) => {
      broadcastToRenderer('agent:event:error', {
        taskId: task.id,
        error,
      });
    });

    // 执行
    await executor.execute();

    // 执行完成
    console.log(`[executeSoloMode] Execution completed successfully`);

    // 更新 AI 消息的最终内容
    aiMessage.content = accumulatedContent || 'SOLO 任务执行完成';
    aiMessage.thinking = accumulatedThinking || undefined;
    aiMessage.toolCalls = toolCalls.length > 0 ? toolCalls : undefined;
    aiMessage.timestamp = Date.now();

    session.isRunning = false;
    task.status = 'completed';
    task.updatedAt = Date.now();

    // 保存任务到磁盘
    await updateTaskOnDisk(task);

    // 通知消息更新
    broadcastToRenderer('agent:event:message', {
      taskId: task.id,
      message: aiMessage,
    });
    broadcastToRenderer('agent:event:status-change', {
      taskId: task.id,
      status: 'completed',
    });
    broadcastToRenderer('agent:event:complete', { taskId: task.id });

  } catch (error: any) {
    console.error(`[executeSoloMode] Execution error:`, error);

    session.isRunning = false;
    task.status = 'failed';
    task.updatedAt = Date.now();

    const errorMessage = error?.message || '执行过程中发生未知错误';

    // 添加错误消息
    const errorMessageObj: AgentMessage = {
      id: Date.now().toString(),
      role: 'assistant',
      content: `任务执行失败: ${errorMessage}`,
      timestamp: Date.now(),
    };
    task.messages.push(errorMessageObj);

    // 保存任务到磁盘
    await updateTaskOnDisk(task);

    broadcastToRenderer('agent:event:message', {
      taskId: task.id,
      message: errorMessageObj,
    });
    broadcastToRenderer('agent:event:error', {
      taskId: task.id,
      error: errorMessage,
    });
    broadcastToRenderer('agent:event:status-change', {
      taskId: task.id,
      status: 'failed',
    });

    throw error;
  }
}

/**
 * 广播消息到所有渲染进程
 */
function broadcastToRenderer(channel: string, data: any): void {
  BrowserWindow.getAllWindows().forEach((window) => {
    if (!window.webContents.isDestroyed()) {
      window.webContents.send(channel, data);
    }
  });
}

/**
 * 初始化 Agent 配置
 */
export async function initializeAgentConfigs(): Promise<void> {
  const configPath = getConfigPath();
  try {
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    // 检查配置文件是否存在
    try {
      await fs.access(configPath);
    } catch {
      // 配置文件不存在，创建空配置
      await fs.writeFile(configPath, JSON.stringify([], null, 2), 'utf-8');
    }
  } catch (error) {
    console.error('Failed to initialize agent configs:', error);
  }
}

/**
 * 创建默认配置
 */
export async function createDefaultConfigs(aiConfigs: any[]): Promise<void> {
  const configPath = getConfigPath();
  try {
    let configs: AgentConfig[] = [];
    try {
      const data = await fs.readFile(configPath, 'utf-8');
      configs = JSON.parse(data);
    } catch {
      // 文件不存在
    }

    // 检查是否有内置智能体，如果没有就重新创建
    const hasBuiltIn = configs.some(c => c.type === 'chat' || c.type === 'builder' || c.type === 'solocoder');
    if (configs.length > 0 && hasBuiltIn) return;

    // 清除所有旧配置，重新创建默认配置
    console.log('[createDefaultConfigs] 重新创建内置智能体配置...');
    const defaultConfigs: AgentConfig[] = [];
    
    // 使用第一个 AI 配置，如果没有则使用默认空配置
    const aiConfig = aiConfigs.length > 0 ? aiConfigs[0] : {
      id: 'default-ai',
      name: 'Default AI',
      provider: 'openai',
      apiKey: '',
      model: 'gpt-4',
    };

    // Chat 配置
    defaultConfigs.push({
      ...createAgentConfig('chat', aiConfig, '对话助手', true),
      id: `default-chat-${Date.now()}`,
      isDefault: true,
    });

    // Solo Coder 配置
    defaultConfigs.push({
      ...createAgentConfig('solocoder', aiConfig, 'Solo Coder', true),
      id: `default-solocoder-${Date.now()}`,
      isDefault: false,
    });

    await fs.writeFile(configPath, JSON.stringify(defaultConfigs, null, 2), 'utf-8');
    console.log('[createDefaultConfigs] 已创建2个内置智能体');
  } catch (error) {
    console.error('Failed to create default configs:', error);
  }
}
