import { Settings, Code2, FolderOpen, Minus, Square, X, Maximize2, Minimize2 } from 'lucide-react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TitleBarProps {
  onSettingsClick?: () => void;
  isWindows?: boolean;
}

export const TitleBar: React.FC<TitleBarProps> = ({ onSettingsClick, isWindows = false }) => {
  const { workspacePath } = useWorkspaceStore();

  const workspaceName = workspacePath 
    ? workspacePath.split('/').pop() || workspacePath.split('\\').pop() 
    : '无工作区';

  const handleMinimize = () => {
    window.electronAPI?.window?.minimize?.();
  };

  const handleMaximize = () => {
    window.electronAPI?.window?.maximize?.();
  };

  const handleClose = () => {
    window.electronAPI?.window?.close?.();
  };

  return (
    <div className="h-11 bg-background/95 backdrop-blur-xl border-b flex items-center px-4 drag-region">
      {/* Left: Logo and workspace info */}
      <div className="flex items-center gap-3 no-drag-region">
        <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-primary/20 to-primary/5 rounded-lg ring-1 ring-primary/20">
          <Code2 className="w-4 h-4 text-primary" />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-foreground">ywcoder</span>
          {workspacePath && (
            <>
              <span className="text-muted-foreground/40">/</span>
              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-muted/50 rounded-md">
                <FolderOpen className="w-3 h-3 text-muted-foreground" />
                <span className="text-xs text-foreground/70 truncate max-w-[200px] font-medium">
                  {workspaceName}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Center: Window title (empty for now) */}
      <div className="flex-1" />

      {/* Right: Actions */}
      <div className="flex items-center gap-1 no-drag-region">
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 hover:bg-accent/80 rounded-lg"
          onClick={onSettingsClick}
          title="设置"
        >
          <Settings className="w-4 h-4 text-muted-foreground" />
        </Button>

        {isWindows && (
          <div className="flex items-center ml-2 -mr-2">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 hover:bg-accent/80 rounded-lg"
              onClick={handleMinimize}
              title="最小化"
            >
              <Minus className="w-4 h-4 text-muted-foreground" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 hover:bg-accent/80 rounded-lg"
              onClick={handleMaximize}
              title="最大化"
            >
              <Square className="w-3.5 h-3.5 text-muted-foreground" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 hover:bg-red-500/80 hover:text-white rounded-lg"
              onClick={handleClose}
              title="关闭"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
