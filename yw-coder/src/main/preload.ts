import { contextBridge, ipcRenderer } from 'electron';

// Inline IPC_CHANNELS to avoid module resolution issues in preload script
const IPC_CHANNELS = {
  // File operations
  FILE_READ: 'file:read',
  FILE_WRITE: 'file:write',
  FILE_DELETE: 'file:delete',
  FILE_RENAME: 'file:rename',
  FILE_CREATE: 'file:create',
  FILE_WATCH: 'file:watch',
  FILE_GET_TREE: 'file:get-tree',

  // AI operations
  AI_CHAT: 'ai:chat',
  AI_STREAM: 'ai:stream',
  AI_COMPLETE: 'ai:complete',
  AI_CANCEL: 'ai:cancel',
  AI_TEST_CONNECTION: 'ai:test-connection',
  AI_GET_PROVIDERS: 'ai:get-providers',
  AI_GET_CONFIGS: 'ai:get-configs',
  AI_SAVE_CONFIG: 'ai:save-config',
  AI_DELETE_CONFIG: 'ai:delete-config',
  AI_SET_ACTIVE_CONFIG: 'ai:set-active-config',

  // Terminal operations
  TERMINAL_CREATE: 'terminal:create',
  TERMINAL_WRITE: 'terminal:write',
  TERMINAL_RESIZE: 'terminal:resize',
  TERMINAL_DATA: 'terminal:data',
  TERMINAL_EXIT: 'terminal:exit',
  TERMINAL_KILL: 'terminal:kill',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',

  // App
  APP_GET_VERSION: 'app:get-version',
  APP_SHOW_OPEN_DIALOG: 'app:show-open-dialog',
  APP_SHOW_SAVE_DIALOG: 'app:show-save-dialog',
  APP_OPEN_EXTERNAL: 'app:open-external',

  // Builder
  BUILDER_START: 'builder:start',
  BUILDER_CANCEL: 'builder:cancel',
  BUILDER_STATUS: 'builder:status',
  
  // Agent
  AGENT_CREATE: 'agent:create',
  AGENT_START: 'agent:start',
  AGENT_PAUSE: 'agent:pause',
  AGENT_RESUME: 'agent:resume',
  AGENT_STOP: 'agent:stop',
  AGENT_GET_STATUS: 'agent:get-status',
  AGENT_GET_ALL: 'agent:get-all',
  AGENT_DELETE: 'agent:delete',
  
  // Agent Events
  AGENT_EVENT_MODE_CHANGE: 'agent:event:mode-change',
  AGENT_EVENT_STEP_START: 'agent:event:step-start',
  AGENT_EVENT_STEP_COMPLETE: 'agent:event:step-complete',
  AGENT_EVENT_STEP_FAIL: 'agent:event:step-fail',
  AGENT_EVENT_MESSAGE: 'agent:event:message',
  AGENT_EVENT_THINKING: 'agent:event:thinking',
  AGENT_EVENT_TOOL_CALL: 'agent:event:tool-call',
  AGENT_EVENT_TOOL_RESULT: 'agent:event:tool-result',
  AGENT_EVENT_STATUS_CHANGE: 'agent:event:status-change',
  AGENT_EVENT_ERROR: 'agent:event:error',
  AGENT_EVENT_COMPLETE: 'agent:event:complete',
  AGENT_EVENT_PROGRESS: 'agent:event:progress',
  AGENT_EVENT_PROGRESS_UPDATE: 'agent:event:progress-update',
  AGENT_EVENT_PLAN_GENERATED: 'agent:event:plan-generated',
  AGENT_EVENT_STREAM_THINKING: 'agent:event:stream-thinking',
  AGENT_EVENT_STREAM_CONTENT: 'agent:event:stream-content',
  
  // File change events
  FILE_CHANGED: 'file:changed',
  FILE_PROGRESS: 'file:progress',
  FILE_OPEN: 'file:open',

  // SOLO Agent
  SOLO_CREATE: 'solo:create',
  SOLO_START: 'solo:start',
  SOLO_PAUSE: 'solo:pause',
  SOLO_RESUME: 'solo:resume',
  SOLO_STOP: 'solo:stop',
  SOLO_DELETE: 'solo:delete',
  SOLO_GET_ALL: 'solo:get-all',
  SOLO_GET: 'solo:get',
  SOLO_ANSWER: 'solo:answer',

  // SOLO Events
  SOLO_STEP_START: 'solo:event:step-start',
  SOLO_STEP_COMPLETE: 'solo:event:step-complete',
  SOLO_STEP_FAIL: 'solo:event:step-fail',
  SOLO_THINKING: 'solo:event:thinking',
  SOLO_TOOL_CALL: 'solo:event:tool-call',
  SOLO_TOOL_RESULT: 'solo:event:tool-result',
  SOLO_TODO_UPDATE: 'solo:event:todo-update',
  SOLO_PROGRESS: 'solo:event:progress',
  SOLO_ERROR: 'solo:event:error',
  SOLO_COMPLETE: 'solo:event:complete',
  SOLO_QUESTION: 'solo:event:question',

  // Code Rewrite
  CODE_REWRITE: 'code:rewrite',
  CODE_REFACTOR: 'code:refactor',

  // Unified Agent
  UNIFIED_CONFIG_GET_ALL: 'agent:config:get-all',
  UNIFIED_CONFIG_GET: 'agent:config:get',
  UNIFIED_CONFIG_SAVE: 'agent:config:save',
  UNIFIED_CONFIG_DELETE: 'agent:config:delete',
  UNIFIED_CONFIG_SET_DEFAULT: 'agent:config:set-default',
  UNIFIED_CONFIG_UPDATE_DEFAULT_AI: 'agent:config:update-default-ai',
  UNIFIED_TASK_CREATE: 'agent:task:create',
  UNIFIED_TASK_START: 'agent:task:start',
  UNIFIED_TASK_PAUSE: 'agent:task:pause',
  UNIFIED_TASK_RESUME: 'agent:task:resume',
  UNIFIED_TASK_STOP: 'agent:task:stop',
  UNIFIED_TASK_DELETE: 'agent:task:delete',
  UNIFIED_TASK_GET: 'agent:task:get',
  UNIFIED_TASK_GET_ALL: 'agent:task:get-all',
  UNIFIED_TASK_ANSWER: 'agent:task:answer',
  UNIFIED_TASK_SEND_MESSAGE: 'agent:task:send-message',
  UNIFIED_TASK_SAVE: 'agent:task:save',
  UNIFIED_EVENT_STEP_START: 'agent:event:step-start',
  UNIFIED_EVENT_STEP_COMPLETE: 'agent:event:step-complete',
  UNIFIED_EVENT_STEP_FAIL: 'agent:event:step-fail',
  UNIFIED_EVENT_MESSAGE: 'agent:event:message',
  UNIFIED_EVENT_THINKING: 'agent:event:thinking',
  UNIFIED_EVENT_THINKING_COMPLETE: 'agent:event:thinking-complete',
  UNIFIED_EVENT_STREAM_CONTENT: 'agent:event:stream-content',
  UNIFIED_EVENT_STREAM_THINKING: 'agent:event:stream-thinking',
  UNIFIED_EVENT_TOOL_CALL: 'agent:event:tool-call',
  UNIFIED_EVENT_TOOL_RESULT: 'agent:event:tool-result',
  UNIFIED_EVENT_TODO_UPDATE: 'agent:event:todo-update',
  UNIFIED_EVENT_PROGRESS: 'agent:event:progress',
  UNIFIED_EVENT_STATUS_CHANGE: 'agent:event:status-change',
  UNIFIED_EVENT_ERROR: 'agent:event:error',
  UNIFIED_EVENT_COMPLETE: 'agent:event:complete',
  UNIFIED_EVENT_QUESTION: 'agent:event:question',
  // 动态执行计划事件
  UNIFIED_EVENT_PLAN_GENERATED: 'agent:event:plan-generated',
  UNIFIED_EVENT_PROGRESS_UPDATE: 'agent:event:progress-update',
} as const;

const api = {
  // Window operations
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
    reload: () => ipcRenderer.invoke('window:reload'),
    reloadIgnoringCache: () => ipcRenderer.invoke('window:reloadIgnoringCache'),
    onMaximizeChange: (callback: (isMaximized: boolean) => void) => {
      ipcRenderer.on('window:maximizeChange', (_, isMaximized) => callback(isMaximized));
    },
  },

  // File operations
  file: {
    read: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.FILE_READ, filePath),
    write: (filePath: string, content: string) => ipcRenderer.invoke(IPC_CHANNELS.FILE_WRITE, filePath, content),
    delete: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.FILE_DELETE, filePath),
    rename: (oldPath: string, newPath: string) => ipcRenderer.invoke(IPC_CHANNELS.FILE_RENAME, oldPath, newPath),
    create: (filePath: string, isDirectory: boolean) => ipcRenderer.invoke(IPC_CHANNELS.FILE_CREATE, filePath, isDirectory),
    getTree: (dirPath: string) => ipcRenderer.invoke(IPC_CHANNELS.FILE_GET_TREE, dirPath),
    search: (query: string, workspacePath: string) => ipcRenderer.invoke('file:search', query, workspacePath),
    onChange: (callback: (data: { filePath: string; content: string }) => void) => {
      ipcRenderer.on(IPC_CHANNELS.FILE_CHANGED, (_, data) => callback(data));
    },
    removeChangeListener: () => {
      ipcRenderer.removeAllListeners(IPC_CHANNELS.FILE_CHANGED);
    },
    onProgress: (callback: (data: { filePath: string; content: string; isComplete: boolean }) => void) => {
      ipcRenderer.on(IPC_CHANNELS.FILE_PROGRESS, (_, data) => callback(data));
    },
    removeProgressListener: () => {
      ipcRenderer.removeAllListeners(IPC_CHANNELS.FILE_PROGRESS);
    },
    onOpen: (callback: (data: { filePath: string }) => void) => {
      ipcRenderer.on(IPC_CHANNELS.FILE_OPEN, (_, data) => callback(data));
    },
    removeOpenListener: () => {
      ipcRenderer.removeAllListeners(IPC_CHANNELS.FILE_OPEN);
    },
  },

  // AI operations
  ai: {
    chat: (request: any, configId?: string) => ipcRenderer.invoke(IPC_CHANNELS.AI_CHAT, request, configId),
    stream: (request: any, configId?: string) => ipcRenderer.invoke(IPC_CHANNELS.AI_STREAM, request, configId),
    complete: (request: any, configId?: string) => ipcRenderer.invoke(IPC_CHANNELS.AI_COMPLETE, request, configId),
    testConnection: (configId?: string) => ipcRenderer.invoke(IPC_CHANNELS.AI_TEST_CONNECTION, configId),
    getProviders: () => ipcRenderer.invoke(IPC_CHANNELS.AI_GET_PROVIDERS),
    getConfigs: () => ipcRenderer.invoke(IPC_CHANNELS.AI_GET_CONFIGS),
    saveConfig: (config: any) => ipcRenderer.invoke(IPC_CHANNELS.AI_SAVE_CONFIG, config),
    deleteConfig: (configId: string) => ipcRenderer.invoke(IPC_CHANNELS.AI_DELETE_CONFIG, configId),
    setActiveConfig: (configId: string) => ipcRenderer.invoke(IPC_CHANNELS.AI_SET_ACTIVE_CONFIG, configId),
    onStream: (callback: (chunk: any) => void) => {
      ipcRenderer.on(IPC_CHANNELS.AI_STREAM, (_, chunk) => callback(chunk));
    },
    removeStreamListener: () => {
      ipcRenderer.removeAllListeners(IPC_CHANNELS.AI_STREAM);
    },
  },

  // Terminal operations
  terminal: {
    create: (cwd?: string) => ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_CREATE, cwd),
    write: (sessionId: string, data: string) => ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_WRITE, sessionId, data),
    resize: (sessionId: string, cols: number, rows: number) => ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_RESIZE, sessionId, cols, rows),
    kill: (sessionId: string) => ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_KILL, sessionId),
    onData: (callback: (sessionId: string, data: string) => void) => {
      ipcRenderer.on(IPC_CHANNELS.TERMINAL_DATA, (_, sessionId, data) => callback(sessionId, data));
    },
    onExit: (callback: (sessionId: string, code: number) => void) => {
      ipcRenderer.on(IPC_CHANNELS.TERMINAL_EXIT, (_, sessionId, code) => callback(sessionId, code));
    },
    removeListeners: () => {
      ipcRenderer.removeAllListeners(IPC_CHANNELS.TERMINAL_DATA);
      ipcRenderer.removeAllListeners(IPC_CHANNELS.TERMINAL_EXIT);
    },
  },

  // Settings
  settings: {
    get: (key?: string) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET, key),
    set: (key: string, value: any) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, key, value),
  },

  // App operations
  app: {
    getVersion: () => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_VERSION),
    showOpenDialog: (options: any) => ipcRenderer.invoke(IPC_CHANNELS.APP_SHOW_OPEN_DIALOG, options),
    showSaveDialog: (options: any) => ipcRenderer.invoke(IPC_CHANNELS.APP_SHOW_SAVE_DIALOG, options),
    openExternal: (url: string) => ipcRenderer.invoke(IPC_CHANNELS.APP_OPEN_EXTERNAL, url),
  },

  // Menu events
  menu: {
    onMenuEvent: (callback: (event: string) => void) => {
      ipcRenderer.on('menu:event', (_, event) => callback(event));
    },
    removeListener: () => {
      ipcRenderer.removeAllListeners('menu:event');
    },
  },

  // Builder operations
  builder: {
    start: (description: string, workspacePath: string, configId?: string) => ipcRenderer.invoke(IPC_CHANNELS.BUILDER_START, description, workspacePath, configId),
    cancel: () => ipcRenderer.invoke(IPC_CHANNELS.BUILDER_CANCEL),
    onStatus: (callback: (task: any) => void) => {
      ipcRenderer.on(IPC_CHANNELS.BUILDER_STATUS, (_, task) => callback(task));
    },
    removeStatusListener: () => {
      ipcRenderer.removeAllListeners(IPC_CHANNELS.BUILDER_STATUS);
    },
  },

  // Agent operations
  agent: {
    create: (params: { title: string; description: string; workspacePath: string; config: any; mode: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_CREATE, params),
    start: (params: { taskId: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_START, params),
    pause: (params: { taskId: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_PAUSE, params),
    resume: (params: { taskId: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_RESUME, params),
    stop: (params: { taskId: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_STOP, params),
    getStatus: (params: { taskId: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_GET_STATUS, params),
    getAll: () =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_GET_ALL),
    delete: (params: { taskId: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_DELETE, params),
    
    // Event listeners
    onModeChange: (callback: (data: any) => void) => {
      ipcRenderer.on(IPC_CHANNELS.AGENT_EVENT_MODE_CHANGE, (_, data) => callback(data));
    },
    onStepStart: (callback: (data: any) => void) => {
      ipcRenderer.on(IPC_CHANNELS.AGENT_EVENT_STEP_START, (_, data) => callback(data));
    },
    onStepComplete: (callback: (data: any) => void) => {
      ipcRenderer.on(IPC_CHANNELS.AGENT_EVENT_STEP_COMPLETE, (_, data) => callback(data));
    },
    onStepFail: (callback: (data: any) => void) => {
      ipcRenderer.on(IPC_CHANNELS.AGENT_EVENT_STEP_FAIL, (_, data) => callback(data));
    },
    onMessage: (callback: (data: any) => void) => {
      ipcRenderer.on(IPC_CHANNELS.AGENT_EVENT_MESSAGE, (_, data) => callback(data));
    },
    onThinking: (callback: (data: any) => void) => {
      ipcRenderer.on(IPC_CHANNELS.AGENT_EVENT_THINKING, (_, data) => callback(data));
    },
    onToolCall: (callback: (data: any) => void) => {
      ipcRenderer.on(IPC_CHANNELS.AGENT_EVENT_TOOL_CALL, (_, data) => callback(data));
    },
    onToolResult: (callback: (data: any) => void) => {
      ipcRenderer.on(IPC_CHANNELS.AGENT_EVENT_TOOL_RESULT, (_, data) => callback(data));
    },
    onStatusChange: (callback: (data: any) => void) => {
      ipcRenderer.on(IPC_CHANNELS.AGENT_EVENT_STATUS_CHANGE, (_, data) => callback(data));
    },
    onError: (callback: (data: any) => void) => {
      ipcRenderer.on(IPC_CHANNELS.AGENT_EVENT_ERROR, (_, data) => callback(data));
    },
    onComplete: (callback: (data: any) => void) => {
      ipcRenderer.on(IPC_CHANNELS.AGENT_EVENT_COMPLETE, (_, data) => callback(data));
    },
    removeAllListeners: () => {
      ipcRenderer.removeAllListeners(IPC_CHANNELS.AGENT_EVENT_MODE_CHANGE);
      ipcRenderer.removeAllListeners(IPC_CHANNELS.AGENT_EVENT_STEP_START);
      ipcRenderer.removeAllListeners(IPC_CHANNELS.AGENT_EVENT_STEP_COMPLETE);
      ipcRenderer.removeAllListeners(IPC_CHANNELS.AGENT_EVENT_STEP_FAIL);
      ipcRenderer.removeAllListeners(IPC_CHANNELS.AGENT_EVENT_MESSAGE);
      ipcRenderer.removeAllListeners(IPC_CHANNELS.AGENT_EVENT_THINKING);
      ipcRenderer.removeAllListeners(IPC_CHANNELS.AGENT_EVENT_TOOL_CALL);
      ipcRenderer.removeAllListeners(IPC_CHANNELS.AGENT_EVENT_TOOL_RESULT);
      ipcRenderer.removeAllListeners(IPC_CHANNELS.AGENT_EVENT_STATUS_CHANGE);
      ipcRenderer.removeAllListeners(IPC_CHANNELS.AGENT_EVENT_ERROR);
      ipcRenderer.removeAllListeners(IPC_CHANNELS.AGENT_EVENT_COMPLETE);
    },
  },

  // AI Coder operations - 新的命令式接口
  aicoder: {
    // 流式执行 AI 命令（核心接口）
    stream: (params: {
      input: string;
      workspacePath: string;
      configId: string;
      openFilePaths?: string[];
      selection?: {
        filePath: string;
        code: string;
        startLine: number;
        endLine: number;
        language: string;
      };
      history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    }) => {
      ipcRenderer.send('aicoder:stream', params);
    },

    // 监听流式输出
    onStreamChunk: (callback: (chunk: any) => void) => {
      ipcRenderer.on('aicoder:stream:chunk', (_event, chunk) => callback(chunk));
    },

    // 移除流式监听
    removeStreamListener: () => {
      ipcRenderer.removeAllListeners('aicoder:stream:chunk');
    },

    // 应用代码编辑
    applyEdit: (params: {
      edit: {
        type: 'edit' | 'write' | 'create' | 'delete';
        filePath: string;
        originalCode?: string;
        newCode: string;
        description: string;
      };
      workspacePath: string;
    }) => ipcRenderer.invoke('aicoder:applyEdit', params),

    // 获取可用命令列表
    getCommands: () => ipcRenderer.invoke('aicoder:getCommands'),

    // 读取文件
    readFile: (params: { filePath: string; workspacePath: string }) =>
      ipcRenderer.invoke('aicoder:readFile', params),

    // 搜索代码
    grep: (params: { pattern: string; workspacePath: string; glob?: string }) =>
      ipcRenderer.invoke('aicoder:grep', params),

    // 旧接口（保持兼容）
    complete: (params: { code: string; cursorPosition: number; filePath: string; workspacePath: string; openFilePaths: string[]; configId?: string }) =>
      ipcRenderer.invoke('aicoder:complete', params),
    generate: (params: { description: string; language: string; workspacePath: string; openFilePaths: string[]; configId?: string }) =>
      ipcRenderer.invoke('aicoder:generate', params),
    edit: (params: { instruction: string; filePath: string; workspacePath: string; openFilePaths: string[]; configId?: string }) =>
      ipcRenderer.invoke('aicoder:edit', params),
    explain: (params: { code: string; filePath: string; workspacePath: string; openFilePaths: string[]; configId?: string }) =>
      ipcRenderer.invoke('aicoder:explain', params),
    review: (params: { code: string; filePath: string; workspacePath: string; openFilePaths: string[]; configId?: string }) =>
      ipcRenderer.invoke('aicoder:review', params),
    chat: (params: { messages: Array<{ role: string; content: string }>; workspacePath: string; openFilePaths: string[]; configId?: string }) =>
      ipcRenderer.invoke('aicoder:chat', params),
  },

  // SOLO Agent operations
  solo: {
    create: (params: { title: string; description: string; workspacePath: string; config: any; mode: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.SOLO_CREATE, params),
    start: (params: { taskId: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.SOLO_START, params),
    pause: (params: { taskId: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.SOLO_PAUSE, params),
    resume: (params: { taskId: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.SOLO_RESUME, params),
    stop: (params: { taskId: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.SOLO_STOP, params),
    delete: (params: { taskId: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.SOLO_DELETE, params),
    getAll: () =>
      ipcRenderer.invoke(IPC_CHANNELS.SOLO_GET_ALL),
    get: (params: { taskId: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.SOLO_GET, params),
    answer: (params: { taskId: string; answer: string; optionId?: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.SOLO_ANSWER, params),

    // Event listeners
    onStepStart: (callback: (data: any) => void) => {
      ipcRenderer.on(IPC_CHANNELS.SOLO_STEP_START, (_, data) => callback(data));
    },
    onStepComplete: (callback: (data: any) => void) => {
      ipcRenderer.on(IPC_CHANNELS.SOLO_STEP_COMPLETE, (_, data) => callback(data));
    },
    onStepFail: (callback: (data: any) => void) => {
      ipcRenderer.on(IPC_CHANNELS.SOLO_STEP_FAIL, (_, data) => callback(data));
    },
    onThinking: (callback: (data: any) => void) => {
      ipcRenderer.on(IPC_CHANNELS.SOLO_THINKING, (_, data) => callback(data));
    },
    onToolCall: (callback: (data: any) => void) => {
      ipcRenderer.on(IPC_CHANNELS.SOLO_TOOL_CALL, (_, data) => callback(data));
    },
    onToolResult: (callback: (data: any) => void) => {
      ipcRenderer.on(IPC_CHANNELS.SOLO_TOOL_RESULT, (_, data) => callback(data));
    },
    onTodoUpdate: (callback: (data: any) => void) => {
      ipcRenderer.on(IPC_CHANNELS.SOLO_TODO_UPDATE, (_, data) => callback(data));
    },
    onProgress: (callback: (data: any) => void) => {
      ipcRenderer.on(IPC_CHANNELS.SOLO_PROGRESS, (_, data) => callback(data));
    },
    onError: (callback: (data: any) => void) => {
      ipcRenderer.on(IPC_CHANNELS.SOLO_ERROR, (_, data) => callback(data));
    },
    onComplete: (callback: (data: any) => void) => {
      ipcRenderer.on(IPC_CHANNELS.SOLO_COMPLETE, (_, data) => callback(data));
    },
    onQuestion: (callback: (data: any) => void) => {
      ipcRenderer.on(IPC_CHANNELS.SOLO_QUESTION, (_, data) => callback(data));
    },
    removeAllListeners: () => {
      ipcRenderer.removeAllListeners(IPC_CHANNELS.SOLO_STEP_START);
      ipcRenderer.removeAllListeners(IPC_CHANNELS.SOLO_STEP_COMPLETE);
      ipcRenderer.removeAllListeners(IPC_CHANNELS.SOLO_STEP_FAIL);
      ipcRenderer.removeAllListeners(IPC_CHANNELS.SOLO_THINKING);
      ipcRenderer.removeAllListeners(IPC_CHANNELS.SOLO_TOOL_CALL);
      ipcRenderer.removeAllListeners(IPC_CHANNELS.SOLO_TOOL_RESULT);
      ipcRenderer.removeAllListeners(IPC_CHANNELS.SOLO_TODO_UPDATE);
      ipcRenderer.removeAllListeners(IPC_CHANNELS.SOLO_PROGRESS);
      ipcRenderer.removeAllListeners(IPC_CHANNELS.SOLO_ERROR);
      ipcRenderer.removeAllListeners(IPC_CHANNELS.SOLO_COMPLETE);
      ipcRenderer.removeAllListeners(IPC_CHANNELS.SOLO_QUESTION);
    },
  },

  // Code Rewrite
  codeRewrite: {
    rewrite: (params: { code: string; language: string; filePath: string; instruction: string; mode: string }, configId?: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.CODE_REWRITE, params, configId),
    refactor: (code: string, language: string, configId?: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.CODE_REFACTOR, code, language, configId),
  },

  // Unified Agent
  unifiedAgent: {
    // Config management
    getConfigs: () => ipcRenderer.invoke(IPC_CHANNELS.UNIFIED_CONFIG_GET_ALL),
    getConfig: (configId: string) => ipcRenderer.invoke(IPC_CHANNELS.UNIFIED_CONFIG_GET, configId),
    saveConfig: (config: any) => ipcRenderer.invoke(IPC_CHANNELS.UNIFIED_CONFIG_SAVE, config),
    deleteConfig: (configId: string) => ipcRenderer.invoke(IPC_CHANNELS.UNIFIED_CONFIG_DELETE, configId),
    setActiveConfig: (configId: string) => ipcRenderer.invoke(IPC_CHANNELS.UNIFIED_CONFIG_SET_DEFAULT, configId),
    updateDefaultAIConfig: (aiConfig: any) => ipcRenderer.invoke(IPC_CHANNELS.UNIFIED_CONFIG_UPDATE_DEFAULT_AI, aiConfig),

    // Task management
    createTask: (params: { title: string; description: string; workspacePath: string; configId: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.UNIFIED_TASK_CREATE, params),
    startTask: (params: { taskId: string }) => ipcRenderer.invoke(IPC_CHANNELS.UNIFIED_TASK_START, params),
    pauseTask: (params: { taskId: string }) => ipcRenderer.invoke(IPC_CHANNELS.UNIFIED_TASK_PAUSE, params),
    resumeTask: (params: { taskId: string }) => ipcRenderer.invoke(IPC_CHANNELS.UNIFIED_TASK_RESUME, params),
    stopTask: (params: { taskId: string }) => ipcRenderer.invoke(IPC_CHANNELS.UNIFIED_TASK_STOP, params),
    deleteTask: (params: { taskId: string }) => ipcRenderer.invoke(IPC_CHANNELS.UNIFIED_TASK_DELETE, params),
    getTask: (params: { taskId: string }) => ipcRenderer.invoke(IPC_CHANNELS.UNIFIED_TASK_GET, params),
    getAllTasks: () => ipcRenderer.invoke(IPC_CHANNELS.UNIFIED_TASK_GET_ALL),
    sendMessage: (params: { taskId: string; content: string; aiConfig?: any }) =>
      ipcRenderer.invoke(IPC_CHANNELS.UNIFIED_TASK_SEND_MESSAGE, params),
    answerQuestion: (params: { taskId: string; questionId: string; answer: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.UNIFIED_TASK_ANSWER, params),
    saveTask: (params: { task: any }) => ipcRenderer.invoke(IPC_CHANNELS.UNIFIED_TASK_SAVE, params),

    // Event listeners
    onStepStart: (callback: (data: any) => void) => {
      ipcRenderer.on(IPC_CHANNELS.UNIFIED_EVENT_STEP_START, (_, data) => callback(data));
    },
    onStepComplete: (callback: (data: any) => void) => {
      ipcRenderer.on(IPC_CHANNELS.UNIFIED_EVENT_STEP_COMPLETE, (_, data) => callback(data));
    },
    onStepFail: (callback: (data: any) => void) => {
      ipcRenderer.on(IPC_CHANNELS.UNIFIED_EVENT_STEP_FAIL, (_, data) => callback(data));
    },
    onMessage: (callback: (data: any) => void) => {
      ipcRenderer.on(IPC_CHANNELS.UNIFIED_EVENT_MESSAGE, (_, data) => callback(data));
    },
    onThinking: (callback: (data: any) => void) => {
      ipcRenderer.on(IPC_CHANNELS.UNIFIED_EVENT_THINKING, (_, data) => callback(data));
    },
    onThinkingComplete: (callback: (data: any) => void) => {
      ipcRenderer.on(IPC_CHANNELS.UNIFIED_EVENT_THINKING_COMPLETE, (_, data) => callback(data));
    },
    onStreamContent: (callback: (data: any) => void) => {
      ipcRenderer.on(IPC_CHANNELS.UNIFIED_EVENT_STREAM_CONTENT, (_, data) => callback(data));
    },
    onStreamThinking: (callback: (data: any) => void) => {
      ipcRenderer.on(IPC_CHANNELS.UNIFIED_EVENT_STREAM_THINKING, (_, data) => callback(data));
    },
    onToolCall: (callback: (data: any) => void) => {
      ipcRenderer.on(IPC_CHANNELS.UNIFIED_EVENT_TOOL_CALL, (_, data) => callback(data));
    },
    onToolResult: (callback: (data: any) => void) => {
      ipcRenderer.on(IPC_CHANNELS.UNIFIED_EVENT_TOOL_RESULT, (_, data) => callback(data));
    },
    onTodoUpdate: (callback: (data: any) => void) => {
      ipcRenderer.on(IPC_CHANNELS.UNIFIED_EVENT_TODO_UPDATE, (_, data) => callback(data));
    },
    onProgress: (callback: (data: any) => void) => {
      ipcRenderer.on(IPC_CHANNELS.UNIFIED_EVENT_PROGRESS, (_, data) => callback(data));
    },
    onStatusChange: (callback: (data: any) => void) => {
      ipcRenderer.on(IPC_CHANNELS.UNIFIED_EVENT_STATUS_CHANGE, (_, data) => callback(data));
    },
    onError: (callback: (data: any) => void) => {
      ipcRenderer.on(IPC_CHANNELS.UNIFIED_EVENT_ERROR, (_, data) => callback(data));
    },
    onComplete: (callback: (data: any) => void) => {
      ipcRenderer.on(IPC_CHANNELS.UNIFIED_EVENT_COMPLETE, (_, data) => callback(data));
    },
    onQuestion: (callback: (data: any) => void) => {
      ipcRenderer.on(IPC_CHANNELS.UNIFIED_EVENT_QUESTION, (_, data) => callback(data));
    },
    // 动态执行计划事件
    onPlanGenerated: (callback: (data: any) => void) => {
      ipcRenderer.on(IPC_CHANNELS.UNIFIED_EVENT_PLAN_GENERATED, (_, data) => callback(data));
    },
    onProgressUpdate: (callback: (data: any) => void) => {
      ipcRenderer.on(IPC_CHANNELS.UNIFIED_EVENT_PROGRESS_UPDATE, (_, data) => callback(data));
    },
    removeAllListeners: () => {
      ipcRenderer.removeAllListeners(IPC_CHANNELS.UNIFIED_EVENT_STEP_START);
      ipcRenderer.removeAllListeners(IPC_CHANNELS.UNIFIED_EVENT_STEP_COMPLETE);
      ipcRenderer.removeAllListeners(IPC_CHANNELS.UNIFIED_EVENT_STEP_FAIL);
      ipcRenderer.removeAllListeners(IPC_CHANNELS.UNIFIED_EVENT_MESSAGE);
      ipcRenderer.removeAllListeners(IPC_CHANNELS.UNIFIED_EVENT_THINKING);
      ipcRenderer.removeAllListeners(IPC_CHANNELS.UNIFIED_EVENT_THINKING_COMPLETE);
      ipcRenderer.removeAllListeners(IPC_CHANNELS.UNIFIED_EVENT_STREAM_CONTENT);
      ipcRenderer.removeAllListeners(IPC_CHANNELS.UNIFIED_EVENT_STREAM_THINKING);
      ipcRenderer.removeAllListeners(IPC_CHANNELS.UNIFIED_EVENT_TOOL_CALL);
      ipcRenderer.removeAllListeners(IPC_CHANNELS.UNIFIED_EVENT_TOOL_RESULT);
      ipcRenderer.removeAllListeners(IPC_CHANNELS.UNIFIED_EVENT_TODO_UPDATE);
      ipcRenderer.removeAllListeners(IPC_CHANNELS.UNIFIED_EVENT_PROGRESS);
      ipcRenderer.removeAllListeners(IPC_CHANNELS.UNIFIED_EVENT_STATUS_CHANGE);
      ipcRenderer.removeAllListeners(IPC_CHANNELS.UNIFIED_EVENT_ERROR);
      ipcRenderer.removeAllListeners(IPC_CHANNELS.UNIFIED_EVENT_COMPLETE);
      ipcRenderer.removeAllListeners(IPC_CHANNELS.UNIFIED_EVENT_QUESTION);
      ipcRenderer.removeAllListeners(IPC_CHANNELS.UNIFIED_EVENT_PLAN_GENERATED);
      ipcRenderer.removeAllListeners(IPC_CHANNELS.UNIFIED_EVENT_PROGRESS_UPDATE);
    },
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);

export type ElectronAPI = typeof api;
