/**
 * Shortcut Help Panel Component
 * 参考 OpenCode 的快捷键帮助设计
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { X, Keyboard, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ShortcutGroup, ShortcutConfig, ShortcutManager } from '@/hooks/useKeyboardShortcuts';

interface ShortcutHelpPanelProps {
  isOpen: boolean;
  onClose: () => void;
  shortcuts: ShortcutGroup[];
  className?: string;
}

const ShortcutItem: React.FC<{ shortcut: ShortcutConfig }> = ({ shortcut }) => {
  const formatShortcut = (s: ShortcutConfig): string => {
    const parts: string[] = [];

    if (s.modifiers?.includes('ctrl')) parts.push('Ctrl');
    if (s.modifiers?.includes('alt')) parts.push('Alt');
    if (s.modifiers?.includes('shift')) parts.push('Shift');
    if (s.modifiers?.includes('meta') || s.modifiers?.includes('cmd')) {
      parts.push('⌘');
    }

    const keyMap: Record<string, string> = {
      Enter: '↵',
      Escape: 'Esc',
      ArrowUp: '↑',
      ArrowDown: '↓',
      ArrowLeft: '←',
      ArrowRight: '→',
      ' ': 'Space',
      Backspace: '⌫',
      Delete: 'Del',
      Tab: 'Tab',
    };

    parts.push(keyMap[s.key] || s.key.toUpperCase());

    return parts.join('+');
  };

  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors">
      <span className="text-sm">{shortcut.description}</span>
      <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono border border-border">
        {formatShortcut(shortcut)}
      </kbd>
    </div>
  );
};

export const ShortcutHelpPanel: React.FC<ShortcutHelpPanelProps> = ({
  isOpen,
  onClose,
  shortcuts,
  className,
}) => {
  const [searchQuery, setSearchQuery] = React.useState('');

  if (!isOpen) return null;

  // 过滤快捷键
  const filteredGroups = shortcuts
    .map((group) => ({
      ...group,
      shortcuts: group.shortcuts.filter(
        (s) =>
          s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.key.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    }))
    .filter((group) => group.shortcuts.length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className={cn(
          'bg-background w-full max-w-2xl max-h-[80vh] rounded-xl shadow-2xl flex flex-col',
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">快捷键帮助</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Search */}
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="搜索快捷键..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 p-4">
          {filteredGroups.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              没有找到匹配的快捷键
            </div>
          ) : (
            <div className="space-y-6">
              {filteredGroups.map((group) => (
                <div key={group.name}>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2 px-3">
                    {group.name}
                  </h3>
                  <div className="space-y-1">
                    {group.shortcuts.map((shortcut, idx) => (
                      <ShortcutItem key={`${shortcut.key}-${idx}`} shortcut={shortcut} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t text-xs text-muted-foreground text-center">
          按 <kbd className="px-1 py-0.5 bg-muted rounded">Esc</kbd> 关闭此面板
        </div>
      </div>
    </div>
  );
};

export default ShortcutHelpPanel;
