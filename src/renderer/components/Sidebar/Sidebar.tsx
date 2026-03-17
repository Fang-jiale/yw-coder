import { useState, useCallback, useRef } from 'react';
import {
  FolderTree,
  Search,
  GitBranch,
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  Plus,
  RefreshCw,
  Loader2,
  X,
  Settings,
  FileCode,
  FolderOpen,
  FilePlus,
  FolderPlus
} from 'lucide-react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useSearchStore } from '@/store/searchStore';
import { FileNode } from '../../../shared/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type SidebarTab = 'explorer' | 'search' | 'git';

interface SidebarProps {
  onSettingsClick?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onSettingsClick }) => {
  const [activeTab, setActiveTab] = useState<SidebarTab>('explorer');
  const { fileTree, workspacePath, expandedFolders, toggleFolder, openFile, refreshFileTree, createFile } = useWorkspaceStore();
  const { query, results, isSearching, search, clearResults } = useSearchStore();
  const [searchInput, setSearchInput] = useState('');

  // 新建文件/文件夹状态
  const [isCreating, setIsCreating] = useState(false);
  const [createType, setCreateType] = useState<'file' | 'folder' | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileClick = (node: FileNode) => {
    if (node.type === 'directory') {
      toggleFolder(node.path);
    } else {
      openFile(node.path);
    }
  };

  const handleSearch = useCallback(async () => {
    if (workspacePath && searchInput.trim()) {
      await search(searchInput, workspacePath);
    }
  }, [searchInput, workspacePath, search]);

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleResultClick = (filePath: string) => {
    openFile(filePath);
  };

  // 开始新建文件或文件夹
  const startCreate = (type: 'file' | 'folder') => {
    if (!workspacePath) return;
    setCreateType(type);
    setIsCreating(true);
    setNewItemName('');
    // 聚焦输入框
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  // 取消新建
  const cancelCreate = () => {
    setIsCreating(false);
    setCreateType(null);
    setNewItemName('');
  };

  // 确认新建
  const confirmCreate = async () => {
    if (!workspacePath || !newItemName.trim() || !createType) return;

    const newPath = `${workspacePath}/${newItemName.trim()}`;
    try {
      await createFile(newPath, createType === 'folder');
      cancelCreate();
      // 如果是文件，自动打开
      if (createType === 'file') {
        await openFile(newPath);
      }
    } catch (error) {
      console.error('Failed to create:', error);
    }
  };

  // 处理新建输入框的按键
  const handleCreateKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      confirmCreate();
    } else if (e.key === 'Escape') {
      cancelCreate();
    }
  };

  const getFileIcon = (node: FileNode) => {
    if (node.type === 'directory') {
      return <Folder className="w-4 h-4 text-blue-500/80 dark:text-blue-400/80 flex-shrink-0" />;
    }
    
    const ext = node.name.split('.').pop()?.toLowerCase();
    const codeExts = ['ts', 'tsx', 'js', 'jsx', 'py', 'java', 'go', 'rs', 'cpp', 'c', 'h'];
    const configExts = ['json', 'yaml', 'yml', 'toml', 'xml'];
    const styleExts = ['css', 'scss', 'sass', 'less', 'styl'];
    const docExts = ['md', 'txt', 'doc', 'pdf'];
    
    if (codeExts.includes(ext || '')) {
      return <FileCode className="w-4 h-4 text-amber-500/80 flex-shrink-0" />;
    }
    if (configExts.includes(ext || '')) {
      return <FileCode className="w-4 h-4 text-purple-500/80 flex-shrink-0" />;
    }
    if (styleExts.includes(ext || '')) {
      return <FileCode className="w-4 h-4 text-cyan-500/80 flex-shrink-0" />;
    }
    if (docExts.includes(ext || '')) {
      return <File className="w-4 h-4 text-green-500/80 flex-shrink-0" />;
    }
    
    return <File className="w-4 h-4 text-muted-foreground/70 flex-shrink-0" />;
  };

  const renderFileNode = (node: FileNode, depth: number = 0) => {
    const isExpanded = expandedFolders.has(node.path);
    const isDirectory = node.type === 'directory';

    return (
      <div key={node.path} className="animate-in fade-in">
        <div
          className={cn(
            "flex items-center gap-1.5 px-2 py-1.5 cursor-pointer hover:bg-accent/60 group rounded-md mx-1",
            "text-sm select-none transition-all duration-150"
          )}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => handleFileClick(node)}
        >
          {isDirectory && (
            <span className="w-4 h-4 flex items-center justify-center text-muted-foreground/60 transition-transform duration-150">
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </span>
          )}
          {!isDirectory && <span className="w-4" />}
          
          {getFileIcon(node)}
          
          <span className="truncate text-foreground/80 group-hover:text-foreground transition-colors">{node.name}</span>
        </div>
        
        {isDirectory && isExpanded && node.children && (
          <div className="animate-in slide-in-from-top-1">
            {node.children.map(child => renderFileNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const renderExplorer = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2.5 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-semibold text-foreground/80 uppercase tracking-wide">
            资源管理器
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 hover:bg-accent/80 rounded-md"
            onClick={() => refreshFileTree()}
            title="刷新"
          >
            <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 hover:bg-accent/80 rounded-md disabled:opacity-30"
            onClick={() => startCreate('file')}
            disabled={!workspacePath || isCreating}
            title="新建文件"
          >
            <FilePlus className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 hover:bg-accent/80 rounded-md disabled:opacity-30"
            onClick={() => startCreate('folder')}
            disabled={!workspacePath || isCreating}
            title="新建文件夹"
          >
            <FolderPlus className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        {workspacePath ? (
          <div className="py-2">
            {/* 新建文件/文件夹输入框 */}
            {isCreating && (
              <div className="px-2 py-1.5 animate-in fade-in slide-in-from-top-1">
                <div className="flex items-center gap-2 px-2 py-1.5 bg-accent/40 rounded-md">
                  {createType === 'file' ? (
                    <FilePlus className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  ) : (
                    <FolderPlus className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  )}
                  <Input
                    ref={inputRef}
                    type="text"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    onKeyDown={handleCreateKeyDown}
                    onBlur={cancelCreate}
                    placeholder={createType === 'file' ? '输入文件名...' : '输入文件夹名...'}
                    className="h-7 text-xs px-2 py-1 bg-background"
                  />
                </div>
              </div>
            )}
            {fileTree.length > 0 ? (
              fileTree.map(node => renderFileNode(node))
            ) : (
              <div className="p-6 text-center">
                <div className="w-12 h-12 bg-muted/50 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <Folder className="w-6 h-6 text-muted-foreground/40" />
                </div>
                <p className="text-sm text-muted-foreground">暂无文件</p>
                <p className="text-xs text-muted-foreground/60 mt-1">该文件夹为空</p>
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 text-center">
            <div className="w-12 h-12 bg-muted/50 rounded-xl flex items-center justify-center mx-auto mb-3">
              <FolderTree className="w-6 h-6 text-muted-foreground/40" />
            </div>
            <p className="text-sm text-muted-foreground">尚未打开文件夹</p>
            <p className="text-xs text-muted-foreground/60 mt-1">点击"打开文件夹"开始</p>
          </div>
        )}
      </ScrollArea>
    </div>
  );

  const renderSearch = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2.5 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-semibold text-foreground/80 uppercase tracking-wide">
            搜索
          </span>
        </div>
      </div>
      <div className="p-3 space-y-2">
        <div className="relative">
          <Input
            type="text"
            placeholder="搜索文件内容..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="pr-8 h-9"
          />
          {searchInput && (
            <button
              onClick={() => { setSearchInput(''); clearResults(); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <Button 
          onClick={handleSearch} 
          disabled={isSearching || !searchInput.trim() || !workspacePath}
          className="w-full"
          size="sm"
        >
          {isSearching ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              搜索中...
            </>
          ) : (
            <>
              <Search className="w-4 h-4 mr-2" />
              搜索
            </>
          )}
        </Button>
      </div>
      
      <ScrollArea className="flex-1">
        {results.length > 0 ? (
          <div className="space-y-2 p-2">
            {results.map((result, index) => (
              <div key={index} className="space-y-1 animate-in slide-in-from-right-2">
                <div 
                  className="text-xs font-medium text-foreground/80 px-2 py-1.5 bg-muted/40 rounded-md cursor-pointer hover:bg-accent/60 transition-colors"
                  onClick={() => handleResultClick(result.path)}
                >
                  {result.path.replace(workspacePath || '', '') || result.path}
                </div>
                {result.matches.map((match, matchIndex) => (
                  <div
                    key={matchIndex}
                    className="text-xs px-2 py-1.5 cursor-pointer hover:bg-accent/40 rounded truncate transition-colors"
                    onClick={() => handleResultClick(result.path)}
                  >
                    <span className="text-muted-foreground mr-2 font-mono">{match.line}:</span>
                    <span className="text-foreground/90">{match.content}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : query && !isSearching ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            未找到匹配结果
          </div>
        ) : null}
      </ScrollArea>
    </div>
  );

  const renderGit = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2.5 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-semibold text-foreground/80 uppercase tracking-wide">
            源代码管理
          </span>
        </div>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 bg-muted/50 rounded-xl flex items-center justify-center mb-3">
          <GitBranch className="w-6 h-6 text-muted-foreground/40" />
        </div>
        <p className="text-sm text-muted-foreground">暂无可提交的更改</p>
        <p className="text-xs text-muted-foreground/60 mt-1">工作区是干净的</p>
      </div>
    </div>
  );

  const tabs = [
    { id: 'explorer' as const, icon: FolderTree, label: '资源管理器' },
    { id: 'search' as const, icon: Search, label: '搜索' },
    { id: 'git' as const, icon: GitBranch, label: 'Git' },
  ];

  return (
    <div className="flex h-full bg-background border-r">
      {/* Tab Icons */}
      <div className="w-12 flex flex-col items-center py-3 border-r bg-muted/20">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "w-9 h-9 flex items-center justify-center rounded-lg mb-1.5 transition-all duration-200",
              activeTab === tab.id 
                ? "bg-primary text-primary-foreground shadow-sm" 
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            )}
            title={tab.label}
          >
            <tab.icon className="w-[18px] h-[18px]" />
          </button>
        ))}
        
        {/* Settings button at bottom */}
        <div className="flex-1" />
        <button
          onClick={onSettingsClick}
          className={cn(
            "w-9 h-9 flex items-center justify-center rounded-lg mb-1.5 transition-all duration-200",
            "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
          )}
          title="设置"
        >
          <Settings className="w-[18px] h-[18px]" />
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 min-w-0">
        {activeTab === 'explorer' && renderExplorer()}
        {activeTab === 'search' && renderSearch()}
        {activeTab === 'git' && renderGit()}
      </div>
    </div>
  );
};
