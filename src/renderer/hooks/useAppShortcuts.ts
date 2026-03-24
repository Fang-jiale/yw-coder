import { useEffect } from 'react';
import { useKeyboardShortcut } from './useAccessibility';

export function useAppShortcuts(options: {
  onNewChat?: () => void;
  onOpenSettings?: () => void;
  onToggleSidebar?: () => void;
  onToggleTerminal?: () => void;
  onCommandPalette?: () => void;
  onSave?: () => void;
}) {
  const {
    onNewChat,
    onOpenSettings,
    onToggleSidebar,
    onToggleTerminal,
    onCommandPalette,
    onSave,
  } = options;

  useKeyboardShortcut({
    shortcuts: [
      {
        key: 'n',
        modifiers: ['ctrl', 'shift'],
        handler: () => onNewChat?.(),
        description: '新建对话',
      },
      {
        key: ',',
        modifiers: ['ctrl'],
        handler: () => onOpenSettings?.(),
        description: '打开设置',
      },
      {
        key: 'b',
        modifiers: ['ctrl'],
        handler: () => onToggleSidebar?.(),
        description: '切换侧边栏',
      },
      {
        key: '`',
        modifiers: ['ctrl', 'shift'],
        handler: () => onToggleTerminal?.(),
        description: '切换终端',
      },
      {
        key: 'p',
        modifiers: ['ctrl', 'shift'],
        handler: () => onCommandPalette?.(),
        description: '打开命令面板',
      },
      {
        key: 's',
        modifiers: ['ctrl'],
        handler: () => onSave?.(),
        description: '保存',
      },
    ],
  });
}
