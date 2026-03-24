import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  File,
  FolderOpen,
  MessageSquare,
  Sparkles,
  Terminal,
  Settings,
  Moon,
  Sun,
  GitBranch
} from 'lucide-react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useUnifiedAgentStore } from '@/store/unifiedAgentStore';
import { useSettingsStore } from '@/store/settingsStore';
import { cn } from '@/lib/utils';

interface CommandItem {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  shortcut?: string;
  action: () => void;
  category: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showInputDialog, setShowInputDialog] = useState(false);
  const [inputDialogConfig, setInputDialogConfig] = useState<{
    title: string;
    placeholder: string;
    onConfirm: (value: string) => void;
  } | null>(null);
  const [dialogInputValue, setDialogInputValue] = useState('');
  
  const { workspacePath, openFile, createFile } = useWorkspaceStore();
  const { createTask } = useUnifiedAgentStore();
  const { theme, updateSettings } = useSettingsStore();

  const handleInputConfirm = () => {
    if (inputDialogConfig && dialogInputValue.trim()) {
      inputDialogConfig.onConfirm(dialogInputValue.trim());
    }
    setShowInputDialog(false);
    setDialogInputValue('');
    setInputDialogConfig(null);
    onClose();
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleInputConfirm();
    } else if (e.key === 'Escape') {
      setShowInputDialog(false);
      setDialogInputValue('');
      setInputDialogConfig(null);
    }
  };

  const getCommands = useCallback((): CommandItem[] => {
    const commands: CommandItem[] = [
      // File commands
      {
        id: 'file:new',
        title: '新建文件',
        description: '创建一个新的文件',
        icon: File,
        shortcut: 'Ctrl+N',
        action: () => {
          setInputDialogConfig({
            title: '新建文件',
            placeholder: '输入文件路径（如：src/index.js）',
            onConfirm: async (filePath: string) => {
              if (workspacePath && filePath) {
                const fullPath = `${workspacePath}/${filePath}`;
                await createFile(fullPath, false);
                openFile(fullPath);
              }
            },
          });
          setShowInputDialog(true);
        },
        category: '文件',
      },
      {
        id: 'file:open',
        title: '打开文件',
        description: '打开一个已有的文件',
        icon: FolderOpen,
        shortcut: 'Ctrl+O',
        action: () => {
          window.electronAPI?.app?.showOpenDialog({
            properties: ['openFile'],
          }).then((result: any) => {
            if (!result.canceled && result.filePaths.length > 0) {
              openFile(result.filePaths[0]);
            }
          });
          onClose();
        },
        category: '文件',
      },
      {
        id: 'folder:open',
        title: '打开文件夹',
        description: '打开一个项目文件夹',
        icon: FolderOpen,
        shortcut: 'Ctrl+Shift+O',
        action: () => {
          window.electronAPI?.app?.showOpenDialog({
            properties: ['openDirectory'],
          }).then((result: any) => {
            if (!result.canceled && result.filePaths.length > 0) {
              // Reload workspace
              window.location.reload();
            }
          });
          onClose();
        },
        category: '文件',
      },
      
      // AI commands
      {
        id: 'ai:newChat',
        title: '新建 AI 对话',
        description: '开始一个新的 AI 对话',
        icon: MessageSquare,
        shortcut: 'Ctrl+Shift+L',
        action: () => {
          createTask('新对话', '');
          onClose();
        },
        category: 'AI',
      },
      {
        id: 'ai:builder',
        title: 'Builder 模式',
        description: '使用 AI Builder 创建项目',
        icon: Sparkles,
        shortcut: 'Ctrl+Shift+B',
        action: () => {
          createTask('AI Builder', '');
          onClose();
        },
        category: 'AI',
      },
      
      // Terminal commands
      {
        id: 'terminal:new',
        title: '新建终端',
        description: '打开一个新的终端会话',
        icon: Terminal,
        shortcut: 'Ctrl+`',
        action: () => {
          window.electronAPI?.terminal?.create();
          onClose();
        },
        category: '终端',
      },
      
      // View commands
      {
        id: 'view:toggleTheme',
        title: theme === 'dark' ? '切换到亮色主题' : '切换到暗色主题',
        description: '切换编辑器主题',
        icon: theme === 'dark' ? Sun : Moon,
        action: () => {
          updateSettings({ theme: theme === 'dark' ? 'light' : 'dark' });
          onClose();
        },
        category: '视图',
      },
      {
        id: 'view:settings',
        title: '打开设置',
        description: '打开设置面板',
        icon: Settings,
        shortcut: 'Ctrl+,',
        action: () => {
          // Settings will be opened via menu event
          window.electronAPI?.menu?.onMenuEvent((event: string) => {
            if (event === 'settings:open') {
              // Handle settings open
            }
          });
          onClose();
        },
        category: '视图',
      },
      
      // Git commands
      {
        id: 'git:clone',
        title: '克隆仓库',
        description: '从远程仓库克隆项目',
        icon: GitBranch,
        action: () => {
          setInputDialogConfig({
            title: '克隆仓库',
            placeholder: '输入 Git 仓库 URL',
            onConfirm: async (repoUrl: string) => {
              if (workspacePath && repoUrl) {
                try {
                  await window.electronAPI?.terminal?.write?.('1', `git clone ${repoUrl}\r`);
                } catch (error) {
                  console.error('Git clone failed:', error);
                }
              }
            },
          });
          setShowInputDialog(true);
        },
        category: 'Git',
      },
    ];

    // Filter commands based on search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return commands.filter(
        (cmd) =>
          cmd.title.toLowerCase().includes(query) ||
          cmd.description.toLowerCase().includes(query) ||
          cmd.category.toLowerCase().includes(query)
      );
    }

    return commands;
  }, [searchQuery, theme, createTask, openFile, onClose, updateSettings, workspacePath, createFile]);

  const commands = getCommands();
  const filteredCommands = commands;

  // Group commands by category
  const groupedCommands = filteredCommands.reduce((acc, command) => {
    if (!acc[command.category]) {
      acc[command.category] = [];
    }
    acc[command.category].push(command);
    return acc;
  }, {} as Record<string, CommandItem[]>);

  // Reset selection when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < filteredCommands.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, onClose]);

  if (!isOpen) return null;

  let currentIndex = 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center pt-[20vh] z-50">
      <div className="w-[600px] max-w-[90vw] bg-background rounded-lg shadow-2xl overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          <Search className="w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="输入命令或搜索..."
            className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
            autoFocus
          />
          <kbd className="px-2 py-1 text-xs bg-muted rounded">ESC</kbd>
        </div>

        {/* Input Dialog */}
        {showInputDialog && inputDialogConfig && (
          <div className="px-4 py-4 border-b bg-muted/30">
            <div className="text-sm font-medium mb-2">{inputDialogConfig.title}</div>
            <div className="flex gap-2">
              <input
                type="text"
                value={dialogInputValue}
                onChange={(e) => setDialogInputValue(e.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder={inputDialogConfig.placeholder}
                className="flex-1 px-3 py-2 text-sm bg-background border rounded-md outline-none focus:ring-2 focus:ring-primary/20"
                autoFocus
              />
              <button
                onClick={handleInputConfirm}
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              >
                确定
              </button>
            </div>
          </div>
        )}

        {/* Commands List */}
        <div className="max-h-[400px] overflow-y-auto py-2">
          {filteredCommands.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground">
              未找到匹配的命令
            </div>
          ) : (
            Object.entries(groupedCommands).map(([category, categoryCommands]) => (
              <div key={category}>
                <div className="px-4 py-1 text-xs font-medium text-muted-foreground uppercase">
                  {category}
                </div>
                {categoryCommands.map((command) => {
                  const index = currentIndex++;
                  const isSelected = index === selectedIndex;
                  const Icon = command.icon;

                  return (
                    <button
                      key={command.id}
                      onClick={() => command.action()}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-2 text-left transition-colors',
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-accent'
                      )}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{command.title}</div>
                        <div
                          className={cn(
                            'text-xs truncate',
                            isSelected
                              ? 'text-primary-foreground/70'
                              : 'text-muted-foreground'
                          )}
                        >
                          {command.description}
                        </div>
                      </div>
                      {command.shortcut && (
                        <kbd
                          className={cn(
                            'px-2 py-0.5 text-xs rounded flex-shrink-0',
                            isSelected
                              ? 'bg-primary-foreground/20 text-primary-foreground'
                              : 'bg-muted text-muted-foreground'
                          )}
                        >
                          {command.shortcut}
                        </kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-muted rounded">↓</kbd>
              导航
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded">↵</kbd>
              选择
            </span>
          </div>
          <span>{filteredCommands.length} 个命令</span>
        </div>
      </div>
    </div>
  );
};
