import { GitBranch, AlertCircle, CheckCircle, FileCode, Type, Hash, Zap } from 'lucide-react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useTaskStore } from '@/store/taskStore';
import { cn } from '@/lib/utils';

export const StatusBar: React.FC = () => {
  const { activeFilePath, openFiles } = useWorkspaceStore();
  const { tabSize, theme } = useSettingsStore();
  const { tasks, activeTaskId } = useTaskStore();

  const activeFile = openFiles.find(f => f.path === activeFilePath);
  const language = activeFile?.language || 'plaintext';
  const activeTask = tasks.find(t => t.id === activeTaskId);

  const getLanguageIcon = (lang: string) => {
    switch (lang.toLowerCase()) {
      case 'typescript':
      case 'ts':
        return <span className="text-blue-500 font-bold text-[10px]">TS</span>;
      case 'javascript':
      case 'js':
        return <span className="text-yellow-500 font-bold text-[10px]">JS</span>;
      case 'python':
      case 'py':
        return <span className="text-green-500 font-bold text-[10px]">PY</span>;
      case 'go':
        return <span className="text-cyan-500 font-bold text-[10px]">GO</span>;
      case 'rust':
      case 'rs':
        return <span className="text-orange-500 font-bold text-[10px]">RS</span>;
      case 'css':
      case 'scss':
        return <span className="text-pink-500 font-bold text-[10px]">CSS</span>;
      case 'html':
        return <span className="text-red-500 font-bold text-[10px]">HTML</span>;
      case 'json':
        return <span className="text-purple-500 font-bold text-[10px]">JSON</span>;
      case 'markdown':
      case 'md':
        return <span className="text-gray-500 font-bold text-[10px]">MD</span>;
      default:
        return <FileCode className="w-3.5 h-3.5 text-muted-foreground" />;
    }
  };

  return (
    <div className="h-7 bg-muted/40 border-t flex items-center px-3 text-xs select-none">
      {/* Left: File status */}
      <div className="flex items-center gap-3 flex-1">
        {activeFilePath && (
          <>
            <div className={cn(
              "flex items-center gap-1.5 px-2 py-0.5 rounded-md transition-colors",
              activeFile?.isModified 
                ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400" 
                : "bg-green-500/10 text-green-600 dark:text-green-400"
            )}>
              {activeFile?.isModified ? (
                <AlertCircle className="w-3 h-3" />
              ) : (
                <CheckCircle className="w-3 h-3" />
              )}
              <span className="font-medium">{activeFile?.isModified ? '已修改' : '已保存'}</span>
            </div>
            
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-muted/60 rounded-md text-foreground/70">
              {getLanguageIcon(language)}
              <span className="font-medium capitalize">{language}</span>
            </div>
            
            {activeFile && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <span>{activeFile.content.split('\n').length} 行</span>
                <span className="text-border">|</span>
                <span>{activeFile.content.length} 字符</span>
              </div>
            )}
          </>
        )}
        
        {/* Active task indicator */}
        {activeTask && (
          <div className={cn(
            "flex items-center gap-1.5 px-2 py-0.5 rounded-md",
            activeTask.status === 'running' && "bg-blue-500/10 text-blue-600 dark:text-blue-400",
            activeTask.status === 'completed' && "bg-green-500/10 text-green-600 dark:text-green-400",
            activeTask.status === 'error' && "bg-red-500/10 text-red-600 dark:text-red-400",
            activeTask.status === 'pending' && "bg-muted/60 text-muted-foreground"
          )}>
            <Zap className="w-3 h-3" />
            <span className="font-medium truncate max-w-[150px]">{activeTask.title}</span>
          </div>
        )}
      </div>
      
      {/* Right: Editor settings */}
      <div className="flex items-center gap-1">
        <div className="flex items-center gap-1.5 px-2 py-0.5 text-muted-foreground hover:bg-muted/60 rounded-md transition-colors cursor-pointer">
          <GitBranch className="w-3.5 h-3.5" />
          <span className="font-medium">main</span>
        </div>
        
        <div className="w-px h-3.5 bg-border mx-1" />
        
        <div className="flex items-center gap-1.5 px-2 py-0.5 text-muted-foreground hover:bg-muted/60 rounded-md transition-colors cursor-pointer">
          <Type className="w-3.5 h-3.5" />
          <span>UTF-8</span>
        </div>
        
        <div className="flex items-center gap-1.5 px-2 py-0.5 text-muted-foreground hover:bg-muted/60 rounded-md transition-colors cursor-pointer">
          <Hash className="w-3.5 h-3.5" />
          <span>{tabSize} 空格</span>
        </div>
        
        <div className="w-px h-3.5 bg-border mx-1" />
        
        <div className={cn(
          "flex items-center gap-1.5 px-2 py-0.5 rounded-md transition-colors",
          theme === 'dark' ? "bg-indigo-500/10 text-indigo-400" : "bg-amber-500/10 text-amber-600"
        )}>
          <div className={cn(
            "w-3.5 h-3.5 rounded-full flex items-center justify-center",
            theme === 'dark' ? "bg-indigo-500/20" : "bg-amber-500/20"
          )}>
            {theme === 'dark' ? (
              <span className="text-[8px]">🌙</span>
            ) : (
              <span className="text-[8px]">☀️</span>
            )}
          </div>
          <span className="font-medium">{theme === 'dark' ? '深色' : '浅色'}</span>
        </div>
      </div>
    </div>
  );
};
