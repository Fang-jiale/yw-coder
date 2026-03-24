import { useState, useEffect, useCallback } from 'react';
import { FolderOpen, MessageSquare, Code, Sparkles, Clock, X, Zap, Terminal, FileCode, Wand2, Bot, Code2 } from 'lucide-react';

interface WelcomeScreenProps {
  onOpenFolder: () => void;
  onOpenRecent: (path: string) => void;
  onQuickStart?: () => void;
}

const MAX_RECENT_WORKSPACES = 10;

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onOpenFolder,
  onOpenRecent,
  onQuickStart,
}) => {
  const [recentWorkspaces, setRecentWorkspaces] = useState<string[]>([]);

  useEffect(() => {
    const recent = localStorage.getItem('recentWorkspaces');
    if (recent) {
      try {
        const parsed = JSON.parse(recent);
        if (Array.isArray(parsed)) {
          setRecentWorkspaces(parsed);
        }
      } catch (e) {
        console.error('Failed to parse recent workspaces:', e);
        localStorage.removeItem('recentWorkspaces');
      }
    }
  }, []);

  const handleOpenRecent = useCallback((path: string) => {
    if (path) {
      onOpenRecent(path);
    }
  }, [onOpenRecent]);

  const handleRemoveRecent = useCallback((pathToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = recentWorkspaces.filter(path => path !== pathToRemove);
    setRecentWorkspaces(updated);
    localStorage.setItem('recentWorkspaces', JSON.stringify(updated));
  }, [recentWorkspaces]);

  const handleSkipWelcome = useCallback(() => {
    onQuickStart?.();
  }, [onQuickStart]);

  return (
    <div className="h-full w-full flex flex-col items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-8 overflow-auto">
      <div className="max-w-4xl w-full">
        {/* Logo and Title */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary/60 rounded-xl flex items-center justify-center shadow-lg glow-primary">
              <Code className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary via-blue-500 to-primary bg-clip-text text-transparent mb-2">
            ywcoder
          </h1>
          <p className="text-lg text-muted-foreground">
            AI驱动的智能编程工具
          </p>
        </div>

        {/* Main Actions - 优化布局 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          {/* 打开文件夹 */}
          <button
            onClick={onOpenFolder}
            className="group flex flex-col items-center p-6 rounded-2xl border border-border bg-card/50 hover:bg-card hover:border-primary/50 hover:shadow-lg transition-all duration-300 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-500/20 flex items-center justify-center mb-3 group-hover:scale-110 group-hover:shadow-lg transition-all duration-300">
              <FolderOpen className="w-7 h-7 text-blue-500" />
            </div>
            <h3 className="text-base font-semibold mb-1 relative z-10">打开文件夹</h3>
            <p className="text-xs text-muted-foreground text-center relative z-10">
              打开已有项目
            </p>
          </button>

          {/* 快速开始 */}
          <button
            onClick={onQuickStart}
            className="group flex flex-col items-center p-6 rounded-2xl border border-border bg-card/50 hover:bg-card hover:border-primary/50 hover:shadow-lg transition-all duration-300 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500/10 to-purple-500/20 flex items-center justify-center mb-3 group-hover:scale-110 group-hover:shadow-lg transition-all duration-300">
              <Wand2 className="w-7 h-7 text-purple-500" />
            </div>
            <h3 className="text-base font-semibold mb-1 relative z-10">快速开始</h3>
            <p className="text-xs text-muted-foreground text-center relative z-10">
              AI生成新项目
            </p>
          </button>

          {/* 跳过 - 直接进入AI对话 */}
          <button
            onClick={handleSkipWelcome}
            className="group flex flex-col items-center p-6 rounded-2xl border border-border bg-card/50 hover:bg-card hover:border-primary/50 hover:shadow-lg transition-all duration-300 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-500/10 to-green-500/20 flex items-center justify-center mb-3 group-hover:scale-110 group-hover:shadow-lg transition-all duration-300">
              <MessageSquare className="w-7 h-7 text-green-500" />
            </div>
            <h3 className="text-base font-semibold mb-1 relative z-10">AI 对话</h3>
            <p className="text-xs text-muted-foreground text-center relative z-10">
              直接开始对话
            </p>
          </button>
        </div>

        {/* Recent Workspaces */}
        {recentWorkspaces.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3 text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span className="text-sm font-medium">最近打开</span>
              <span className="text-xs text-muted-foreground/60 ml-auto">
                {recentWorkspaces.length} 个项目
              </span>
            </div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto scrollbar-thin">
              {recentWorkspaces.slice(0, MAX_RECENT_WORKSPACES).map((path, index) => (
                <button
                  key={index}
                  onClick={() => handleOpenRecent(path)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors text-left group border border-transparent hover:border-border"
                  title={path}
                >
                  <FolderOpen className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm truncate flex-1 text-foreground/80">{path}</span>
                  <span
                    onClick={(e) => handleRemoveRecent(path, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 rounded transition-all"
                    title="从历史记录中移除"
                  >
                    <X className="w-3 h-3" />
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Features - 优化展示 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <div className="group flex items-center gap-3 p-3 rounded-lg bg-gradient-to-br from-blue-500/5 to-blue-500/10 border border-transparent hover:border-blue-500/20 transition-all cursor-pointer">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/10 to-blue-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <MessageSquare className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h4 className="text-sm font-semibold">AI 对话</h4>
              <p className="text-xs text-muted-foreground">智能问答</p>
            </div>
          </div>
          <div className="group flex items-center gap-3 p-3 rounded-lg bg-gradient-to-br from-purple-500/5 to-purple-500/10 border border-transparent hover:border-purple-500/20 transition-all cursor-pointer">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/10 to-purple-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Bot className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <h4 className="text-sm font-semibold">代码构建</h4>
              <p className="text-xs text-muted-foreground">结构化开发</p>
            </div>
          </div>
          <div className="group flex items-center gap-3 p-3 rounded-lg bg-gradient-to-br from-green-500/5 to-green-500/10 border border-transparent hover:border-green-500/20 transition-all cursor-pointer">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500/10 to-green-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Zap className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <h4 className="text-sm font-semibold">Solo Coder</h4>
              <p className="text-xs text-muted-foreground">自主开发</p>
            </div>
          </div>
          <div className="group flex items-center gap-3 p-3 rounded-lg bg-gradient-to-br from-amber-500/5 to-amber-500/10 border border-transparent hover:border-amber-500/20 transition-all cursor-pointer">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500/10 to-amber-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Terminal className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h4 className="text-sm font-semibold">终端</h4>
              <p className="text-xs text-muted-foreground">集成命令行</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-muted-foreground/60">
          <p>ywcoder v1.0.0 | 按住 Shift 点击按钮可跳过工作区选择</p>
        </div>
      </div>
    </div>
  );
};
