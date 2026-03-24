import { useEffect, useState, useCallback } from 'react';
import { useSettingsStore } from './store/settingsStore';
import { useCodeActionStore } from './store/codeActionStore';
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
import { ChatPanel } from './components/Chat/ChatPanelRefactored';
import { AgentSelector } from './components/Agent/AgentSelector';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Toaster } from '@/components/ui/toaster';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { History, PanelLeft, PanelRight, FolderOpen, TerminalSquare } from 'lucide-react';
import { useWorkspace } from './hooks/useWorkspace';
import { useAgent } from './hooks/useAgent';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { useAppShortcuts } from './hooks/useAppShortcuts';
import { useWorkspaceStore } from './store/workspaceStore';

function App() {
  const [showWelcome, setShowWelcome] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showHistorySidebar, setShowHistorySidebar] = useState(true);
  const [showEditor, setShowEditor] = useState(true);
  const [showTerminal, setShowTerminal] = useState(false);
  const [isWindows, setIsWindows] = useState(false);
  const [effectiveTheme] = useState<'light' | 'dark'>('light');

  const { loadSettings, loadAIConfigs } = useSettingsStore();
  const { currentAction, showDiffViewer, hideDiff, applyAction } = useCodeActionStore();
  const {
    workspacePath,
    openFiles,
    activeFilePath,
    updateFileContent,
    handleOpenFolder,
    openFile,
  } = useWorkspace();
  const { createTask, activeConfigId } = useAgent();

  useEffect(() => {
    const checkPlatform = () => {
      setIsWindows(navigator.userAgent.includes('Windows'));
    };
    checkPlatform();
  }, []);

  useEffect(() => {
    if (workspacePath) {
      setShowWelcome(false);
    }
  }, [workspacePath]);

  useAppShortcuts({
    onNewChat: () => {
      createTask('新对话', '');
    },
    onOpenSettings: () => setShowSettings(true),
    onToggleSidebar: () => setShowEditor(!showEditor),
    onCommandPalette: () => setShowCommandPalette(true),
    onSave: () => {
      if (activeFilePath) {
        const file = openFiles.find(f => f.path === activeFilePath);
        if (file) {
          window.electronAPI?.file?.write?.(activeFilePath, file.content);
        }
      }
    },
  });

  const handleOpenWorkspace = useCallback((path: string) => {
    if (!path) return;
    handleOpenFolder();
    localStorage.setItem('lastWorkspace', path);
    setShowWelcome(false);

    const recent = localStorage.getItem('recentWorkspaces');
    let recentList: string[] = [];
    try {
      recentList = recent ? JSON.parse(recent) : [];
    } catch (e) {
      recentList = [];
    }

    recentList = recentList.filter(p => p !== path);
    recentList.unshift(path);
    recentList = recentList.slice(0, 10);
    localStorage.setItem('recentWorkspaces', JSON.stringify(recentList));
  }, [handleOpenFolder]);

  const handleNewChat = useCallback(async () => {
    await createTask('新对话', '');
  }, [createTask]);

  const handleQuickStart = useCallback(async () => {
    setShowWelcome(false);
    await createTask('AI Builder', '');
  }, [createTask]);

  useKeyboardShortcuts([
    {
      key: 'e',
      modifiers: ['ctrl', 'shift'],
      description: '切换编辑器显示',
      action: () => setShowEditor(prev => !prev),
    },
  ], { deps: [] });

  const handleFileOpen = useCallback((data: { filePath: string }) => {
    console.log('[App] Received file:open event:', data.filePath);
    setShowEditor(true);
  }, []);

  useEffect(() => {
    loadSettings();
    loadAIConfigs();

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
        case 'settings:open':
          setShowSettings(true);
          break;
        case 'view:commandPalette':
          setShowCommandPalette(true);
          break;
      }
    };

    window.electronAPI?.menu?.onMenuEvent(handleMenuEvent);
    window.electronAPI?.unifiedAgent?.onFileOpen?.(handleFileOpen);

    return () => {
      window.electronAPI?.menu?.removeListener();
    };
  }, [loadSettings, loadAIConfigs, handleOpenFolder, handleNewChat, handleFileOpen]);

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
          <ResizablePanel key={`left-${showEditor}`} defaultSize={showEditor ? 55 : 20} minSize={showEditor ? 30 : 15} maxSize={showEditor ? 70 : 30}>
            <ResizablePanelGroup direction="horizontal">
              <ResizablePanel key={`filetree-${showEditor}`} defaultSize={showEditor ? 35 : 100} minSize={15} maxSize={showEditor ? 50 : 100}>
                <div className="h-full flex flex-col">
                  <div className="border-b px-2 py-1.5 flex items-center gap-1 bg-muted/20">
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn('h-7 w-7 rounded-md transition-colors', showEditor && 'bg-accent')}
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
                    <ErrorBoundary>
                      <Sidebar onSettingsClick={() => setShowSettings(true)} />
                    </ErrorBoundary>
                  </div>
                </div>
              </ResizablePanel>

              {showEditor && (
                <>
                  <ResizableHandle className="w-1 bg-border hover:bg-primary/20 transition-colors" />
                  <ResizablePanel defaultSize={65} minSize={30}>
                    <ResizablePanelGroup direction="vertical">
                      <ResizablePanel defaultSize={showTerminal ? 75 : 100} minSize={30}>
                        <ErrorBoundary>
                          <Editor />
                        </ErrorBoundary>
                      </ResizablePanel>
                      {showTerminal && (
                        <>
                          <ResizableHandle className="h-1 bg-border hover:bg-primary/20 transition-colors" />
                          <ResizablePanel defaultSize={25} minSize={10}>
                            <ErrorBoundary>
                              <TerminalPanel onCollapse={() => setShowTerminal(false)} />
                            </ErrorBoundary>
                          </ResizablePanel>
                        </>
                      )}
                      {!showTerminal && (
                        <div className="h-6 bg-muted/20 border-t flex items-center justify-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 px-2 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => setShowTerminal(true)}
                          >
                            <TerminalSquare className="w-3 h-3 mr-1" />
                            展开终端
                          </Button>
                        </div>
                      )}
                    </ResizablePanelGroup>
                  </ResizablePanel>
                </>
              )}
            </ResizablePanelGroup>
          </ResizablePanel>

          {showEditor && <ResizableHandle className="w-1 bg-border hover:bg-primary/20 transition-colors" />}

          <ResizablePanel key={`right-${showEditor}`} defaultSize={showEditor ? 45 : 80} minSize={30} maxSize={85}>
            <div className="h-full flex flex-col">
              <div className="border-b px-3 py-2 flex items-center gap-2 bg-muted/20">
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn('h-8 w-8 rounded-lg transition-colors', showHistorySidebar && 'bg-accent')}
                  onClick={() => setShowHistorySidebar(!showHistorySidebar)}
                  title={showHistorySidebar ? '隐藏历史记录' : '显示历史记录'}
                >
                  <History className="w-4 h-4" />
                </Button>
                <div className="flex-1" />
                <AgentSelector />
              </div>
              
              <div className="flex-1 flex overflow-hidden">
                {showHistorySidebar && (
                  <>
                    <div className="w-56 flex-shrink-0">
                      <ChatHistorySidebar onNewChat={handleNewChat} />
                    </div>
                    <div className="w-px bg-border flex-shrink-0" />
                  </>
                )}
                <div className="flex-1 overflow-hidden">
                  <ErrorBoundary>
                    <ChatPanel onOpenSettings={() => setShowSettings(true)} />
                  </ErrorBoundary>
                </div>
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      
      <StatusBar />
      <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />
      <CommandPalette isOpen={showCommandPalette} onClose={() => setShowCommandPalette(false)} />
      
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
