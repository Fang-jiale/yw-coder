import { app, BrowserWindow, ipcMain, dialog, shell, Menu } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { FileService } from './services/fileService';
import AIService from './services/aiService';
import { TerminalService } from './services/terminalService';
import { SettingsService } from './services/settingsService';
import { BuilderService } from './services/builderService';
import { CodeRewriteService } from './services/codeRewriteService';
import { setupAICoderService } from './services/aicoderService';
import {
  registerUnifiedAgentIPC,
  initializeAgentConfigs,
  createDefaultConfigs,
} from './agent/unifiedAgentIPC';
import { IPC_CHANNELS, AIProviderConfig } from '../shared/types';

app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');

const isDev = process.argv.includes('--dev');

class YWCodeRApp {
  private mainWindow: BrowserWindow | null = null;
  private fileService: FileService;
  private aiService: AIService;
  private terminalService: TerminalService | null = null;
  private settingsService: SettingsService;
  private builderService: BuilderService;
  private codeRewriteService: CodeRewriteService;

  constructor() {
    this.fileService = new FileService();
    this.settingsService = new SettingsService();
    this.aiService = new AIService(this.settingsService);
    this.builderService = new BuilderService();
    this.codeRewriteService = new CodeRewriteService(this.aiService);
    this.initializeApp();
  }

  private initializeApp(): void {
    app.whenReady().then(() => {
      try {
        this.terminalService = new TerminalService();
      } catch (e) {
        console.error('Failed to initialize terminal service:', e);
      }
      this.createWindow();
      this.setupIPC();
      this.setupMenu();
    });

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createWindow();
      }
    });

    app.on('before-quit', () => {
      this.terminalService?.disposeAll();
    });
  }

  private createWindow(): void {
    const isMac = process.platform === 'darwin';
    const isWin = process.platform === 'win32';

    this.mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 800,
      minHeight: 600,
      titleBarStyle: isMac ? 'hidden' : 'hiddenInset',
      frame: false,
      icon: path.join(__dirname, '../../logo.png'),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
      },
    });

    if (isDev) {
      this.mainWindow.loadURL('http://localhost:5173');
      this.mainWindow.webContents.openDevTools();
    } else {
      this.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    }

    this.mainWindow.on('maximize', () => {
      this.mainWindow?.webContents.send('window:maximizeChange', true);
    });

    this.mainWindow.on('unmaximize', () => {
      this.mainWindow?.webContents.send('window:maximizeChange', false);
    });
  }

  private setupIPC(): void {
    // File operations
    ipcMain.handle(IPC_CHANNELS.FILE_READ, async (_, filePath: string) => {
      return this.fileService.readFile(filePath);
    });

    ipcMain.handle(IPC_CHANNELS.FILE_WRITE, async (_, filePath: string, content: string) => {
      return this.fileService.writeFile(filePath, content);
    });

    ipcMain.handle(IPC_CHANNELS.FILE_DELETE, async (_, filePath: string) => {
      return this.fileService.deleteFile(filePath);
    });

    ipcMain.handle(IPC_CHANNELS.FILE_RENAME, async (_, oldPath: string, newPath: string) => {
      return this.fileService.renameFile(oldPath, newPath);
    });

    ipcMain.handle(IPC_CHANNELS.FILE_CREATE, async (_, filePath: string, isDirectory: boolean) => {
      return this.fileService.createFile(filePath, isDirectory);
    });

    ipcMain.handle(IPC_CHANNELS.FILE_GET_TREE, async (_, dirPath: string) => {
      return this.fileService.getFileTree(dirPath);
    });

    // AI operations
    ipcMain.handle(IPC_CHANNELS.AI_CHAT, async (_, request, configId?: string) => {
      return this.aiService.chat(request, configId);
    });

    ipcMain.handle(IPC_CHANNELS.AI_STREAM, async (event, request, configId?: string) => {
      try {
        const stream = await this.aiService.streamChat(request, configId);
        for await (const chunk of stream) {
          event.sender.send(IPC_CHANNELS.AI_STREAM, chunk);
        }
        event.sender.send(IPC_CHANNELS.AI_STREAM, '__DONE__');
      } catch (error: any) {
        event.sender.send(IPC_CHANNELS.AI_STREAM, '__ERROR__:' + (error.message || 'Stream failed'));
      }
    });

    ipcMain.handle(IPC_CHANNELS.AI_COMPLETE, async (_, request, configId?: string) => {
      return this.aiService.complete(request, configId);
    });

    ipcMain.handle(IPC_CHANNELS.AI_TEST_CONNECTION, async (_, configId?: string) => {
      return this.aiService.testConnection(configId);
    });

    ipcMain.handle(IPC_CHANNELS.AI_GET_PROVIDERS, async () => {
      return this.aiService.getPredefinedProviders();
    });

    ipcMain.handle(IPC_CHANNELS.AI_GET_CONFIGS, async () => {
      return {
        configs: this.aiService.getConfigs(),
        activeConfigId: this.settingsService.get('activeConfigId'),
      };
    });

    ipcMain.handle(IPC_CHANNELS.AI_SAVE_CONFIG, async (_, config) => {
      this.aiService.saveConfig(config);
      return true;
    });

    ipcMain.handle(IPC_CHANNELS.AI_DELETE_CONFIG, async (_, configId: string) => {
      this.aiService.deleteConfig(configId);
      return true;
    });

    ipcMain.handle(IPC_CHANNELS.AI_SET_ACTIVE_CONFIG, async (_, configId: string) => {
      this.aiService.setActiveConfig(configId);
      return true;
    });

    // Terminal operations
    ipcMain.handle(IPC_CHANNELS.TERMINAL_CREATE, async (_, cwd?: string) => {
      const session = this.terminalService!.createSession(cwd);
      
      this.terminalService!.onData(session.id, (data) => {
        this.mainWindow?.webContents.send(IPC_CHANNELS.TERMINAL_DATA, session.id, data);
      });

      this.terminalService!.onExit(session.id, (code) => {
        this.mainWindow?.webContents.send(IPC_CHANNELS.TERMINAL_EXIT, session.id, code);
      });

      return session;
    });

    ipcMain.handle(IPC_CHANNELS.TERMINAL_WRITE, async (_, sessionId: string, data: string) => {
      this.terminalService?.write(sessionId, data);
    });

    ipcMain.handle(IPC_CHANNELS.TERMINAL_RESIZE, async (_, sessionId: string, cols: number, rows: number) => {
      this.terminalService?.resize(sessionId, cols, rows);
    });

    ipcMain.handle(IPC_CHANNELS.TERMINAL_KILL, async (_, sessionId: string) => {
      this.terminalService?.kill(sessionId);
    });

    // Settings
    ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async (_, key?: string) => {
      return this.settingsService.get(key);
    });

    ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, async (_, key: string, value: any) => {
      this.settingsService.set(key, value);
      return true;
    });

    // App operations
    ipcMain.handle(IPC_CHANNELS.APP_GET_VERSION, async () => {
      return app.getVersion();
    });

    // Window control handlers
    ipcMain.on('window:minimize', () => {
      this.mainWindow?.minimize();
    });

    ipcMain.on('window:maximize', () => {
      if (this.mainWindow?.isMaximized()) {
        this.mainWindow.unmaximize();
      } else {
        this.mainWindow?.maximize();
      }
    });

    ipcMain.on('window:close', () => {
      this.mainWindow?.close();
    });

    ipcMain.handle('window:isMaximized', async () => {
      return this.mainWindow?.isMaximized() ?? false;
    });

    ipcMain.handle('window:reload', async () => {
      this.mainWindow?.webContents.reload();
    });

    ipcMain.handle('window:reloadIgnoringCache', async () => {
      this.mainWindow?.webContents.reloadIgnoringCache();
    });

    ipcMain.handle(IPC_CHANNELS.APP_SHOW_OPEN_DIALOG, async (_, options) => {
      if (!this.mainWindow) {
        throw new Error('Main window is not ready');
      }
      const result = await dialog.showOpenDialog(this.mainWindow, options);
      return result;
    });

    ipcMain.handle(IPC_CHANNELS.APP_SHOW_SAVE_DIALOG, async (_, options) => {
      if (!this.mainWindow) {
        throw new Error('Main window is not ready');
      }
      const result = await dialog.showSaveDialog(this.mainWindow, options);
      return result;
    });

    ipcMain.handle(IPC_CHANNELS.APP_OPEN_EXTERNAL, async (_, url: string) => {
      await shell.openExternal(url);
    });

    // Builder operations
    ipcMain.handle(IPC_CHANNELS.BUILDER_START, async (event, description: string, workspacePath: string, configId?: string) => {
      // Get config
      let config: AIProviderConfig | undefined;
      if (configId) {
        const configs = this.aiService.getConfigs();
        config = configs.find(c => c.id === configId);
      }
      if (!config) {
        config = this.aiService.getActiveConfig() || undefined;
      }
      if (!config) {
        throw new Error('No AI configuration found. Please add a configuration in settings.');
      }

      this.builderService.onProgress((task) => {
        event.sender.send(IPC_CHANNELS.BUILDER_STATUS, task);
      });
      return this.builderService.generateProject(description, workspacePath, config);
    });

    ipcMain.handle(IPC_CHANNELS.BUILDER_CANCEL, async () => {
      this.builderService.cancelCurrentTask();
    });

    // Code rewrite
    ipcMain.handle(IPC_CHANNELS.CODE_REWRITE, async (_, request, configId?: string) => {
      let config: AIProviderConfig | undefined;
      if (configId) {
        const configs = this.aiService.getConfigs();
        config = configs.find(c => c.id === configId);
      }
      if (!config) {
        config = this.aiService.getActiveConfig() || undefined;
      }
      if (!config) {
        throw new Error('No AI configuration found. Please add a configuration in settings.');
      }
      return this.codeRewriteService.rewrite(request, config);
    });

    // Code refactor options
    ipcMain.handle(IPC_CHANNELS.CODE_REFACTOR, async (_, code, language, configId?: string) => {
      let config: AIProviderConfig | undefined;
      if (configId) {
        const configs = this.aiService.getConfigs();
        config = configs.find(c => c.id === configId);
      }
      if (!config) {
        config = this.aiService.getActiveConfig() || undefined;
      }
      if (!config) {
        throw new Error('No AI configuration found. Please add a configuration in settings.');
      }
      return this.codeRewriteService.getRefactorOptions(code, language, config);
    });

    // File search
    ipcMain.handle('file:search', async (_, query: string, workspacePath: string) => {
      return this.fileService.searchFiles(query, workspacePath);
    });

    setupAICoderService(this.aiService);

    // Setup Unified Agent IPC (includes Chat, Agent, and SOLO modes)
    registerUnifiedAgentIPC();
    initializeAgentConfigs().then(async () => {
      // 创建默认配置（如果有AI配置）
      const aiConfigs = this.aiService.getConfigs();
      if (aiConfigs.length > 0) {
        await createDefaultConfigs(aiConfigs);
      }
    });
  }

  private setupMenu(): void {
    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: '文件',
        submenu: [
          { label: '新建文件', accelerator: 'CmdOrCtrl+N', click: () => this.sendMenuEvent('file:new') },
          { label: '打开文件', accelerator: 'CmdOrCtrl+O', click: () => this.sendMenuEvent('file:open') },
          { label: '打开文件夹', accelerator: 'CmdOrCtrl+Shift+O', click: () => this.sendMenuEvent('folder:open') },
          { type: 'separator' },
          { label: '保存', accelerator: 'CmdOrCtrl+S', click: () => this.sendMenuEvent('file:save') },
          { label: '另存为', accelerator: 'CmdOrCtrl+Shift+S', click: () => this.sendMenuEvent('file:saveAs') },
        ],
      },
      {
        label: '编辑',
        submenu: [
          { label: '撤销', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
          { label: '重做', accelerator: 'CmdOrCtrl+Shift+Z', role: 'redo' },
          { type: 'separator' },
          { label: '剪切', accelerator: 'CmdOrCtrl+X', role: 'cut' },
          { label: '复制', accelerator: 'CmdOrCtrl+C', role: 'copy' },
          { label: '粘贴', accelerator: 'CmdOrCtrl+V', role: 'paste' },
          { type: 'separator' },
          { label: '查找', accelerator: 'CmdOrCtrl+F', click: () => this.sendMenuEvent('edit:find') },
          { label: '替换', accelerator: 'CmdOrCtrl+H', click: () => this.sendMenuEvent('edit:replace') },
        ],
      },
      {
        label: '视图',
        submenu: [
          { label: '命令面板', accelerator: 'CmdOrCtrl+Shift+P', click: () => this.sendMenuEvent('view:commandPalette') },
          { label: '打开侧边栏', accelerator: 'CmdOrCtrl+B', click: () => this.sendMenuEvent('view:toggleSidebar') },
          { type: 'separator' },
          { label: '放大', accelerator: 'CmdOrCtrl+=', click: () => this.sendMenuEvent('view:zoomIn') },
          { label: '缩小', accelerator: 'CmdOrCtrl+-', click: () => this.sendMenuEvent('view:zoomOut') },
          { label: '重置缩放', accelerator: 'CmdOrCtrl+0', click: () => this.sendMenuEvent('view:zoomReset') },
        ],
      },
      {
        label: 'AI',
        submenu: [
          { label: '新建对话', accelerator: 'CmdOrCtrl+Shift+L', click: () => this.sendMenuEvent('ai:newChat') },
          { label: 'Builder模式', accelerator: 'CmdOrCtrl+Shift+B', click: () => this.sendMenuEvent('ai:builder') },
          { label: '代码补全', accelerator: 'Tab', click: () => this.sendMenuEvent('ai:complete') },
        ],
      },
      {
        label: '终端',
        submenu: [
          { label: '新建终端', accelerator: 'CmdOrCtrl+`', click: () => this.sendMenuEvent('terminal:new') },
          { label: '关闭终端', accelerator: 'CmdOrCtrl+Shift+`', click: () => this.sendMenuEvent('terminal:close') },
        ],
      },
      {
        label: '帮助',
        submenu: [
          { label: '欢迎使用', click: () => this.sendMenuEvent('help:welcome') },
          { label: '文档', click: () => this.sendMenuEvent('help:docs') },
          { label: '关于', click: () => this.sendMenuEvent('help:about') },
        ],
      },
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }

  private sendMenuEvent(event: string): void {
    this.mainWindow?.webContents.send('menu:event', event);
  }
}

new YWCodeRApp();
