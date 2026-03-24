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
import { logService } from './services/logService';
import {
  registerUnifiedAgentIPC,
  initializeAgentConfigs,
  createDefaultConfigs,
} from './agent/unifiedAgentIPC';
import { IPC_CHANNELS, AIProviderConfig } from '../shared/types';

app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');

// Windows 离线/内网环境兼容性设置
if (process.platform === 'win32') {
  app.commandLine.appendSwitch('disable-gpu-sandbox');
  app.commandLine.appendSwitch('disable-features', 'VizDisplayCompositor');
  // 禁用硬件加速，解决某些 Windows 显卡驱动问题
  app.disableHardwareAcceleration();
  // 禁用网络相关功能，避免内网环境阻塞
  app.commandLine.appendSwitch('disable-web-security');
  app.commandLine.appendSwitch('disable-features', 'NetworkService');
  // 禁用自动更新检查
  app.commandLine.appendSwitch('disable-auto-update');
  // 禁用崩溃报告器
  app.commandLine.appendSwitch('disable-crash-reporter');
  // 禁用默认浏览器检查
  app.commandLine.appendSwitch('no-default-browser-check');
}

const isDev = process.argv.includes('--dev');

class YWCodeRApp {
  private mainWindow: BrowserWindow | null = null;
  private fileService: FileService | null = null;
  private aiService: AIService | null = null;
  private terminalService: TerminalService | null = null;
  private settingsService: SettingsService | null = null;
  private builderService: BuilderService | null = null;
  private codeRewriteService: CodeRewriteService | null = null;

  constructor() {
    this.initializeApp();
  }

  private initializeApp(): void {
    app.whenReady().then(async () => {
      // 1. 立即创建窗口，让用户尽快看到界面
      this.createWindow();

      // 2. 延迟初始化非关键服务（使用 requestIdleCallback 或 setTimeout）
      setTimeout(() => {
        this.initializeServices();
      }, 100);

      // 3. 更延迟初始化 Agent 配置（不影响启动速度）
      setTimeout(() => {
        this.initializeAgentServices();
      }, 500);
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

  // 初始化核心服务
  private initializeServices(): void {
    try {
      this.fileService = new FileService();
      this.settingsService = new SettingsService();
      this.aiService = new AIService(this.settingsService);
      this.builderService = new BuilderService();
      this.codeRewriteService = new CodeRewriteService(this.aiService);

      // 立即注册 Unified Agent IPC（前端启动时就需要）
      registerUnifiedAgentIPC();

      // 设置 IPC（必须在服务初始化后）
      this.setupIPC();
      this.setupMenu();
    } catch (e) {
      console.error('Failed to initialize services:', e);
    }

    // 初始化终端服务
    try {
      this.terminalService = new TerminalService();
    } catch (e) {
      console.error('Failed to initialize terminal service:', e);
    }
  }

  // 初始化 Agent 相关服务（延迟）
  private async initializeAgentServices(): Promise<void> {
    if (!this.aiService) return;

    setupAICoderService(this.aiService);

    try {
      await initializeAgentConfigs();
      const aiConfigs = this.aiService.getConfigs();
      // 始终创建内置智能体配置，即使用户没有配置 AI
      await createDefaultConfigs(aiConfigs);
    } catch (e) {
      console.error('Failed to initialize agent configs:', e);
    }
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
      show: false, // 先不显示，等加载完成后再显示
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
        // 离线环境兼容性设置
        webSecurity: false,
        allowRunningInsecureContent: true,
        // 禁用实验性功能，避免内网环境问题
        experimentalFeatures: false,
      },
    });

    // 窗口准备好后再显示，避免白屏
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();
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
    if (!this.fileService || !this.aiService || !this.settingsService) return;

    // File operations
    ipcMain.handle(IPC_CHANNELS.FILE_READ, async (_, filePath: string) => {
      return this.fileService!.readFile(filePath);
    });

    ipcMain.handle(IPC_CHANNELS.FILE_WRITE, async (_, filePath: string, content: string) => {
      return this.fileService!.writeFile(filePath, content);
    });

    ipcMain.handle(IPC_CHANNELS.FILE_DELETE, async (_, filePath: string) => {
      return this.fileService!.deleteFile(filePath);
    });

    ipcMain.handle(IPC_CHANNELS.FILE_RENAME, async (_, oldPath: string, newPath: string) => {
      return this.fileService!.renameFile(oldPath, newPath);
    });

    ipcMain.handle(IPC_CHANNELS.FILE_CREATE, async (_, filePath: string, isDirectory: boolean) => {
      return this.fileService!.createFile(filePath, isDirectory);
    });

    ipcMain.handle(IPC_CHANNELS.FILE_GET_TREE, async (_, dirPath: string) => {
      return this.fileService!.getFileTree(dirPath);
    });

    // AI operations
    ipcMain.handle(IPC_CHANNELS.AI_CHAT, async (_, request, configId?: string) => {
      return this.aiService!.chat(request, configId);
    });

    ipcMain.handle(IPC_CHANNELS.AI_STREAM, async (event, request, configId?: string) => {
      try {
        const stream = await this.aiService!.streamChat(request, configId);
        for await (const chunk of stream) {
          event.sender.send(IPC_CHANNELS.AI_STREAM, chunk);
        }
        event.sender.send(IPC_CHANNELS.AI_STREAM, '__DONE__');
      } catch (error: any) {
        event.sender.send(IPC_CHANNELS.AI_STREAM, '__ERROR__:' + (error.message || 'Stream failed'));
      }
    });

    ipcMain.handle(IPC_CHANNELS.AI_COMPLETE, async (_, request, configId?: string) => {
      return this.aiService!.complete(request, configId);
    });

    ipcMain.handle(IPC_CHANNELS.AI_TEST_CONNECTION, async (_, configId?: string) => {
      return this.aiService!.testConnection(configId);
    });

    ipcMain.handle(IPC_CHANNELS.AI_GET_PROVIDERS, async () => {
      return this.aiService!.getPredefinedProviders();
    });

    ipcMain.handle(IPC_CHANNELS.AI_GET_CONFIGS, async () => {
      return {
        configs: this.aiService!.getConfigs(),
        activeConfigId: this.settingsService!.get('activeConfigId'),
      };
    });

    ipcMain.handle(IPC_CHANNELS.AI_SAVE_CONFIG, async (_, config) => {
      this.aiService!.saveConfig(config);
      return true;
    });

    ipcMain.handle(IPC_CHANNELS.AI_DELETE_CONFIG, async (_, configId: string) => {
      this.aiService!.deleteConfig(configId);
      return true;
    });

    ipcMain.handle(IPC_CHANNELS.AI_SET_ACTIVE_CONFIG, async (_, configId: string) => {
      this.aiService!.setActiveConfig(configId);
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

    // Settings operations
    ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async (_, key: string) => {
      return this.settingsService!.get(key);
    });

    ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, async (_, key: string, value: any) => {
      this.settingsService!.set(key, value);
      return true;
    });

    // Builder operations - 暂时注释掉，等待实现
    // ipcMain.handle(IPC_CHANNELS.BUILDER_START, async (_, config) => {
    //   return this.builderService!.startBuilding(config);
    // });

    // ipcMain.handle(IPC_CHANNELS.BUILDER_STOP, async (_, taskId: string) => {
    //   return this.builderService!.stopBuilding(taskId);
    // });

    // Code Rewrite operations - 暂时注释掉，等待实现
    // ipcMain.handle(IPC_CHANNELS.CODE_REWRITE, async (_, filePath: string, instruction: string) => {
    //   return this.codeRewriteService!.rewriteCode(filePath, instruction);
    // });

    // Window operations
    ipcMain.handle('window:minimize', () => {
      this.mainWindow?.minimize();
    });

    ipcMain.handle('window:maximize', () => {
      if (this.mainWindow?.isMaximized()) {
        this.mainWindow.unmaximize();
      } else {
        this.mainWindow?.maximize();
      }
    });

    ipcMain.handle('window:close', () => {
      this.mainWindow?.close();
    });

    ipcMain.handle('window:reload', () => {
      this.mainWindow?.webContents.reload();
    });

    ipcMain.handle('window:reloadIgnoringCache', () => {
      this.mainWindow?.webContents.reloadIgnoringCache();
    });

    // Log operations
    ipcMain.handle('log:getPath', () => {
      return logService.getLogFilePath();
    });

    ipcMain.handle('log:readRecent', async (_, lines: number) => {
      return logService.readRecentLogs(lines);
    });

    // Dialog operations
    ipcMain.handle('dialog:openFolder', async () => {
      const result = await dialog.showOpenDialog(this.mainWindow!, {
        properties: ['openDirectory'],
      });
      return result.filePaths[0];
    });

    ipcMain.handle('dialog:openFile', async (_, options) => {
      const result = await dialog.showOpenDialog(this.mainWindow!, options);
      return result.filePaths;
    });

    ipcMain.handle('dialog:saveFile', async (_, options) => {
      const result = await dialog.showSaveDialog(this.mainWindow!, options);
      return result.filePath;
    });

    // App dialog operations (used by preload)
    ipcMain.handle('app:show-open-dialog', async (_, options) => {
      const result = await dialog.showOpenDialog(this.mainWindow!, options);
      return result;
    });

    ipcMain.handle('app:show-save-dialog', async (_, options) => {
      const result = await dialog.showSaveDialog(this.mainWindow!, options);
      return result;
    });

    // Shell operations
    ipcMain.handle('shell:openExternal', async (_, url: string) => {
      await shell.openExternal(url);
    });

    ipcMain.handle('shell:showItemInFolder', async (_, fullPath: string) => {
      shell.showItemInFolder(fullPath);
    });

    // File search
    ipcMain.handle('file:search', async (_, query: string, workspacePath: string) => {
      return this.fileService!.searchFiles(query, workspacePath);
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
          { label: '侧边栏', accelerator: 'CmdOrCtrl+B', click: () => this.sendMenuEvent('view:toggleSidebar') },
          { type: 'separator' },
          { label: '放大', accelerator: 'CmdOrCtrl+Plus', click: () => this.sendMenuEvent('view:zoomIn') },
          { label: '缩小', accelerator: 'CmdOrCtrl+-', click: () => this.sendMenuEvent('view:zoomOut') },
          { label: '重置缩放', accelerator: 'CmdOrCtrl+0', click: () => this.sendMenuEvent('view:zoomReset') },
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
        label: 'AI',
        submenu: [
          { label: '新建对话', accelerator: 'CmdOrCtrl+Shift+N', click: () => this.sendMenuEvent('ai:newChat') },
          { label: 'AI 设置', click: () => this.sendMenuEvent('ai:settings') },
        ],
      },
      {
        label: '帮助',
        submenu: [
          { label: '文档', click: () => shell.openExternal('https://github.com/yourusername/ywcoder') },
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

// Start the application
new YWCodeRApp();
