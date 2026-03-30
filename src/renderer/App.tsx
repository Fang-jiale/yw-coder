import { useEffect, useState, useCallback } from 'react';
import { useWorkspaceStore } from './store/workspaceStore';
import { useSettingsStore } from './store/settingsStore';
import { useCodeActionStore } from './store/codeActionStore';
import { useUnifiedAgentStore } from './store/unifiedAgentStore';
import { Sidebar } from './components/Sidebar/Sidebar';
import { Editor } from './components/Editor/Editor';
import { ChatHistorySidebar } from './components/Chat/ChatHistorySidebar';
import { TerminalPanel } from './components/Terminal/TerminalPanel';
import { TitleBar } from './components/TitleBar/TitleBar';
import { StatusBar } from './components/StatusBar/StatusBar';
import { WelcomeScreen } from './components/Welcome/WelcomeScreen';
import { SettingsDialog } from './components/Settings/SettingsDialog';
import { CommandPalette } from './components/CommandPalette/CommandPalette';
import { DiffViewer } from './components/DiffViewer/DiffViewer';
import { ChatPanel } from './components/Chat/ChatPanel';
import { AgentModeSelector } from './components/Agent/AgentModeSelector';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Toaster } from '@/components/ui/toaster';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  History,
  PanelLeft,
  PanelRight,
  FolderOpen,
} from 'lucide-react';
import { setupUnifiedAgentEventListeners } from './store/unifiedAgentStore';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

function App() {
  const [showWelcome, setShowWelcome] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showHistorySidebar, setShowHistorySidebar] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [isWindows, setIsWindows] = useState(false);
  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>('light');
  const { loadWorkspace, openFiles, activeFilePath, updateFileContent } = useWorkspaceStore();
  const { theme, loadSettings } = useSettingsStore();
  const { currentAction, showDiffViewer, hideDiff, applyAction } = useCodeActionStore();
  const { createTask, activeConfigId } = useUnifiedAgentStore();

  // 编辑器区域渲染检查日志
  useEffect(() => {
    window.electronAPI?.logRenderEvent?.('editor_area_render_check', {
      showEditor,
      openFilesCount: openFiles.length,
      activeFilePath,
      hasActiveFile: !!activeFilePath,
    });
  }, [showEditor, openFiles.length, activeFilePath]);

  useEffect(() => {
    const checkPlatform = () => {
      const platform = navigator.userAgent;
      setIsWindows(platform.includes('Windows'));
    };
    checkPlatform();
  }, []);

  // 强制使用浅色模式
  useEffect(() => {
    setEffectiveTheme('light');
  }, []);

  const handleOpenFolder = useCallback(async () => {
    console.log('handleOpenFolder called');
    console.log('electronAPI:', window.electronAPI);
    console.log('app:', window.electronAPI?.app);
    
    try {
      const result = await window.electronAPI?.app?.showOpenDialog({
        properties: ['openDirectory'],
      });
      
      console.log('showOpenDialog result:', result);

      if (result && !result.canceled && result.filePaths.length > 0) {
        const path = result.filePaths[0];
        console.log('Opening folder:', path);
        loadWorkspace(path);
        localStorage.setItem('lastWorkspace', path);
        setShowWelcome(false);
      }
    } catch (error) {
      console.error('Failed to open folder:', error);
    }
  }, [loadWorkspace]);

  const handleOpenWorkspace = useCallback((path: string) => {
    if (!path) return;
    loadWorkspace(path);
    localStorage.setItem('lastWorkspace', path);
    setShowWelcome(false);

    // 更新最近工作区列表
    const recent = localStorage.getItem('recentWorkspaces');
    let recentList: string[] = [];
    try {
      recentList = recent ? JSON.parse(recent) : [];
    } catch (e) {
      recentList = [];
    }

    // 移除已存在的相同路径，并添加到列表开头
    recentList = recentList.filter(p => p !== path);
    recentList.unshift(path);

    // 限制最多保存 10 个
    recentList = recentList.slice(0, 10);

    localStorage.setItem('recentWorkspaces', JSON.stringify(recentList));
  }, [loadWorkspace]);

  // 处理新建对话
  const handleNewChat = useCallback(async () => {
    await createTask('新对话', '', activeConfigId || undefined);
  }, [createTask, activeConfigId]);

  // 处理快速开始 - 打开 AI Builder
  const handleQuickStart = useCallback(async () => {
    setShowWelcome(false);
    await createTask('AI Builder', '', activeConfigId || undefined);
  }, [createTask, activeConfigId]);

  // 注册快捷键
  useKeyboardShortcuts([
    {
      key: 'e',
      modifiers: ['ctrl', 'shift'],
      description: '切换编辑器显示',
      action: () => setShowEditor(prev => !prev),
    },
  ], {
    deps: [],
  });

  useEffect(() => {
    loadSettings();
    setupUnifiedAgentEventListeners();

    const savedWorkspace = localStorage.getItem('lastWorkspace');
    if (savedWorkspace) {
      loadWorkspace(savedWorkspace);
      setShowWelcome(false);
    }

    const handleMenuEvent = (event: string) => {
      switch (event) {
        case 'folder:open':
          handleOpenFolder();
          break;
        case 'file:new':
          break;
        case 'ai:newChat':
          handleNewChat();
          break;
        case 'ai:builder':
          break;
        case 'terminal:new':
          break;
        case 'settings:open':
          setShowSettings(true);
          break;
        case 'view:commandPalette':
          setShowCommandPalette(true);
          break;
      }
    };

    window.electronAPI?.menu?.onMenuEvent(handleMenuEvent);

    const handleFileChange = (data: { filePath: string; content: string }) => {
      console.log('File changed by AI:', data.filePath);
      const { openFiles, updateFileContent } = useWorkspaceStore.getState();
      const isOpen = openFiles.some(f => f.path === data.filePath);
      if (isOpen) {
        updateFileContent(data.filePath, data.content);
      }
    };
    window.electronAPI?.file?.onChange(handleFileChange);

    const handleFileProgress = (data: { filePath: string; content: string; isComplete: boolean }) => {
      const { openFiles, updateFileContent } = useWorkspaceStore.getState();
      const isOpen = openFiles.some(f => f.path === data.filePath);
      if (isOpen) {
        updateFileContent(data.filePath, data.content);
      }
    };
    window.electronAPI?.file?.onProgress(handleFileProgress);

    const handleFileOpen = (data: { filePath: string }) => {
      console.log('AI wants to open file:', data.filePath);
      const { openFile } = useWorkspaceStore.getState();
      openFile(data.filePath);
    };
    window.electronAPI?.file?.onOpen(handleFileOpen);

    return () => {
      window.electronAPI?.menu?.removeListener();
      window.electronAPI?.file?.removeChangeListener();
      window.electronAPI?.file?.removeProgressListener();
      window.electronAPI?.file?.removeOpenListener();
    };
  }, [loadSettings, loadWorkspace, handleOpenFolder, handleNewChat]);

  if (showWelcome) {
    return (
      <div className={cn('h-screen w-screen bg-background', effectiveTheme === 'dark' ? 'dark' : '')}>
        <WelcomeScreen 
          onOpenFolder={handleOpenFolder} 
          onOpenRecent={handleOpenWorkspace}
          onQuickStart={handleQuickStart}
        />
        <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />
        <Toaster />
      </div>
    );
  }

  return (
    <div className={cn('h-screen w-screen flex flex-col', effectiveTheme === 'dark' ? 'dark' : '')}>
      <TitleBar onSettingsClick={() => setShowSettings(true)} isWindows={isWindows} />
      
      <div className="flex-1 flex overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          {/* Left Panel: File Tree + Editor + Terminal */}
          <ResizablePanel key={`left-${showEditor}`} defaultSize={showEditor ? 55 : 20} minSize={showEditor ? 30 : 15} maxSize={showEditor ? 70 : 30}>
            <ResizablePanelGroup direction="horizontal">
              {/* File Tree */}
              <ResizablePanel key={`filetree-${showEditor}`} defaultSize={showEditor ? 35 : 100} minSize={15} maxSize={showEditor ? 50 : 100}>
                <div className="h-full flex flex-col">
                  {/* File Tree Header with Toggle Button */}
                  <div className="border-b px-2 py-1.5 flex items-center gap-1 bg-muted/20">
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        'h-7 w-7 rounded-md transition-colors',
                        showEditor && 'bg-accent'
                      )}
                      onClick={() => setShowEditor(!showEditor)}
                      title={showEditor ? '隐藏编辑器' : '显示编辑器'}
                    >
                      {showEditor ? <PanelLeft className="w-4 h-4" /> : <PanelRight className="w-4 h-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-md transition-colors"
                      onClick={handleOpenFolder}
                      title="打开文件夹"
                    >
                      <FolderOpen className="w-4 h-4" />
                    </Button>
                    <span className="text-xs font-medium text-muted-foreground ml-1">资源管理器</span>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <Sidebar onSettingsClick={() => setShowSettings(true)} />
                  </div>
                </div>
              </ResizablePanel>

              {showEditor && (
                <>
                  <ResizableHandle className="w-1 bg-border hover:bg-primary/20 transition-colors" />

                  {/* Editor and Terminal */}
                  <ResizablePanel defaultSize={65} minSize={30}>
                    <ResizablePanelGroup direction="vertical">
                      <ResizablePanel defaultSize={75} minSize={30}>
                        <Editor />
                      </ResizablePanel>

                      <ResizableHandle className="h-1 bg-border hover:bg-primary/20 transition-colors" />

                      <ResizablePanel defaultSize={25} minSize={10}>
                        <TerminalPanel />
                      </ResizablePanel>
                    </ResizablePanelGroup>
                  </ResizablePanel>
                </>
              )}
            </ResizablePanelGroup>
          </ResizablePanel>

          {showEditor && <ResizableHandle className="w-1 bg-border hover:bg-primary/20 transition-colors" />}

          {/* Right Panel: AI Chat / SOLO with History Sidebar */}
          <ResizablePanel key={`right-${showEditor}`} defaultSize={showEditor ? 45 : 80} minSize={30} maxSize={85}>
            <div className="h-full flex flex-col">
              {/* Header */}
              <div className="border-b px-3 py-2 flex items-center gap-2 bg-muted/20">
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'h-8 w-8 rounded-lg transition-colors',
                    showHistorySidebar && 'bg-accent'
                  )}
                  onClick={() => setShowHistorySidebar(!showHistorySidebar)}
                  title={showHistorySidebar ? '隐藏历史记录' : '显示历史记录'}
                >
                  <History className="w-4 h-4" />
                </Button>

                <div className="flex-1" />

                <AgentModeSelector />
              </div>
              
              {/* Content - 共用对话框历史侧边栏 */}
              <div className="flex-1 flex overflow-hidden">
                {/* History Sidebar - 在两种模式下都显示 */}
                {showHistorySidebar && (
                  <>
                    <div className="w-56 flex-shrink-0">
                      <ChatHistorySidebar onNewChat={handleNewChat} />
                    </div>
                    <div className="w-px bg-border flex-shrink-0" />
                  </>
                )}
                
                {/* Main Chat Panel - 统一对话框 */}
                <div className="flex-1 overflow-hidden">
                  <ChatPanel onSettingsClick={() => setShowSettings(true)} />
                </div>
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      
      <StatusBar />
      <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />
      <CommandPalette isOpen={showCommandPalette} onClose={() => setShowCommandPalette(false)} />
      
      {/* Diff Viewer */}
      {currentAction && (
        <DiffViewer
          originalCode={currentAction.originalCode}
          modifiedCode={currentAction.suggestedCode}
          language={currentAction.language}
          fileName={currentAction.fileName}
          isOpen={showDiffViewer}
          onClose={hideDiff}
          onApply={() => {
            if (currentAction) {
              const file = openFiles.find(f => f.path === activeFilePath);
              if (file) {
                updateFileContent(file.path, currentAction.suggestedCode);
              }
              applyAction(currentAction.id);
            }
          }}
          onReject={() => {
            if (currentAction) {
              applyAction(currentAction.id);
              hideDiff();
            }
          }}
        />
      )}
      
      <Toaster />
    </div>
  );
}

export default App;
