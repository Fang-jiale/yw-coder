/**
 * Keyboard Shortcuts Hook
 * 参考 OpenCode 的快捷键系统设计
 * 提供 Vim-like 的键盘操作体验
 */

import React, { useEffect, useCallback, useRef } from 'react';

export type ShortcutModifier = 'ctrl' | 'alt' | 'shift' | 'meta' | 'cmd';

export interface ShortcutConfig {
  key: string;
  modifiers?: ShortcutModifier[];
  description: string;
  action: () => void;
  preventDefault?: boolean;
  stopPropagation?: boolean;
  condition?: () => boolean;
}

export interface ShortcutGroup {
  name: string;
  shortcuts: ShortcutConfig[];
}

// 默认快捷键配置
export const DEFAULT_SHORTCUTS: ShortcutGroup[] = [
  {
    name: '全局',
    shortcuts: [
      {
        key: 'k',
        modifiers: ['ctrl'],
        description: '打开命令面板',
        action: () => {},
      },
      {
        key: ',',
        modifiers: ['ctrl'],
        description: '打开设置',
        action: () => {},
      },
      {
        key: 'n',
        modifiers: ['ctrl'],
        description: '新建对话',
        action: () => {},
      },
      {
        key: 'b',
        modifiers: ['ctrl'],
        description: '切换侧边栏',
        action: () => {},
      },
      {
        key: 'p',
        modifiers: ['ctrl'],
        description: '查找文件',
        action: () => {},
      },
    ],
  },
  {
    name: '聊天',
    shortcuts: [
      {
        key: 'Enter',
        description: '发送消息',
        action: () => {},
      },
      {
        key: 'Enter',
        modifiers: ['shift'],
        description: '换行',
        action: () => {},
      },
      {
        key: 'x',
        modifiers: ['ctrl'],
        description: '取消生成',
        action: () => {},
      },
      {
        key: 'l',
        modifiers: ['ctrl'],
        description: '清空对话',
        action: () => {},
      },
    ],
  },
  {
    name: '编辑器',
    shortcuts: [
      {
        key: 's',
        modifiers: ['ctrl'],
        description: '保存文件',
        action: () => {},
      },
      {
        key: 'f',
        modifiers: ['ctrl'],
        description: '查找',
        action: () => {},
      },
      {
        key: 'h',
        modifiers: ['ctrl'],
        description: '替换',
        action: () => {},
      },
      {
        key: 'z',
        modifiers: ['ctrl'],
        description: '撤销',
        action: () => {},
      },
      {
        key: 'z',
        modifiers: ['ctrl', 'shift'],
        description: '重做',
        action: () => {},
      },
      {
        key: '/',
        modifiers: ['ctrl'],
        description: '切换行注释',
        action: () => {},
      },
      {
        key: 'f',
        description: '格式化代码',
        action: () => {},
        condition: () => false, // 需要 Alt+Shift+F，这里简化处理
      },
    ],
  },
  {
    name: 'SOLO 模式',
    shortcuts: [
      {
        key: ' ',
        modifiers: ['ctrl'],
        description: '开始/暂停任务',
        action: () => {},
      },
      {
        key: 'Escape',
        description: '停止任务',
        action: () => {},
      },
      {
        key: 'f',
        modifiers: ['ctrl'],
        description: '切换跟随模式',
        action: () => {},
      },
    ],
  },
];

// 快捷键管理器
class ShortcutManager {
  private shortcuts: Map<string, ShortcutConfig> = new Map();
  private enabled: boolean = true;
  private inputElements = ['INPUT', 'TEXTAREA', 'SELECT'];

  // 生成快捷键的唯一标识
  private getShortcutId(key: string, modifiers?: ShortcutModifier[]): string {
    const sortedModifiers = modifiers?.sort() || [];
    return [...sortedModifiers, key.toLowerCase()].join('+');
  }

  // 从键盘事件生成标识
  private getEventId(event: KeyboardEvent): string {
    const modifiers: string[] = [];
    if (event.ctrlKey) modifiers.push('ctrl');
    if (event.altKey) modifiers.push('alt');
    if (event.shiftKey) modifiers.push('shift');
    if (event.metaKey) modifiers.push('meta');
    return [...modifiers, event.key.toLowerCase()].join('+');
  }

  // 检查是否在输入元素中
  private isInInputElement(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    return (
      this.inputElements.includes(target.tagName) ||
      target.isContentEditable
    );
  }

  // 注册快捷键
  register(shortcut: ShortcutConfig): void {
    const id = this.getShortcutId(shortcut.key, shortcut.modifiers);
    this.shortcuts.set(id, shortcut);
  }

  // 注销快捷键
  unregister(key: string, modifiers?: ShortcutModifier[]): void {
    const id = this.getShortcutId(key, modifiers);
    this.shortcuts.delete(id);
  }

  // 批量注册
  registerGroup(group: ShortcutGroup): void {
    group.shortcuts.forEach((shortcut) => this.register(shortcut));
  }

  // 启用/禁用
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  // 处理键盘事件
  handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.enabled) return;

    const id = this.getEventId(event);
    const shortcut = this.shortcuts.get(id);

    if (!shortcut) return;

    // 检查条件
    if (shortcut.condition && !shortcut.condition()) return;

    // 如果在输入元素中，只响应带修饰键的快捷键
    if (this.isInInputElement(event.target) && !shortcut.modifiers?.length) {
      return;
    }

    // 执行动作
    shortcut.action();

    // 阻止默认行为
    if (shortcut.preventDefault !== false) {
      event.preventDefault();
    }

    // 停止冒泡
    if (shortcut.stopPropagation) {
      event.stopPropagation();
    }
  };

  // 获取所有快捷键
  getAllShortcuts(): ShortcutGroup[] {
    const groups = new Map<string, ShortcutConfig[]>();

    this.shortcuts.forEach((shortcut) => {
      // 这里简化处理，实际应该按组分类
      const groupName = '自定义';
      if (!groups.has(groupName)) {
        groups.set(groupName, []);
      }
      groups.get(groupName)!.push(shortcut);
    });

    return Array.from(groups.entries()).map(([name, shortcuts]) => ({
      name,
      shortcuts,
    }));
  }

  // 格式化快捷键显示
  static formatShortcut(shortcut: ShortcutConfig): string {
    const parts: string[] = [];

    if (shortcut.modifiers?.includes('ctrl')) parts.push('Ctrl');
    if (shortcut.modifiers?.includes('alt')) parts.push('Alt');
    if (shortcut.modifiers?.includes('shift')) parts.push('Shift');
    if (shortcut.modifiers?.includes('meta') || shortcut.modifiers?.includes('cmd')) {
      parts.push('⌘');
    }

    // 特殊键处理
    const keyMap: Record<string, string> = {
      Enter: '↵',
      Escape: 'Esc',
      ArrowUp: '↑',
      ArrowDown: '↓',
      ArrowLeft: '←',
      ArrowRight: '→',
      ' ': 'Space',
    };

    parts.push(keyMap[shortcut.key] || shortcut.key.toUpperCase());

    return parts.join('+');
  }
}

// 全局快捷键管理器实例
const globalShortcutManager = new ShortcutManager();

// React Hook
export function useKeyboardShortcuts(
  shortcuts: ShortcutConfig[],
  options?: {
    enabled?: boolean;
    deps?: React.DependencyList;
  }
) {
  const managerRef = useRef(new ShortcutManager());

  useEffect(() => {
    if (options?.enabled === false) return;

    const manager = managerRef.current;

    // 注册快捷键
    shortcuts.forEach((shortcut) => manager.register(shortcut));

    // 添加事件监听
    const handleKeyDown = (e: KeyboardEvent) => manager.handleKeyDown(e);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // 清理快捷键
      shortcuts.forEach((shortcut) =>
        manager.unregister(shortcut.key, shortcut.modifiers)
      );
    };
  }, options?.deps || [shortcuts]);

  return managerRef.current;
}

// 全局快捷键 Hook
export function useGlobalShortcuts(
  shortcuts: ShortcutConfig[],
  deps?: React.DependencyList
) {
  useEffect(() => {
    // 注册到全局管理器
    shortcuts.forEach((shortcut) => globalShortcutManager.register(shortcut));

    // 确保事件监听已添加
    document.addEventListener('keydown', globalShortcutManager.handleKeyDown);

    return () => {
      // 清理
      shortcuts.forEach((shortcut) =>
        globalShortcutManager.unregister(shortcut.key, shortcut.modifiers)
      );
    };
  }, deps || []);
}

// 快捷键帮助面板 Hook
export function useShortcutHelp() {
  const [isOpen, setIsOpen] = React.useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+? 或 Ctrl+Shift+/ 打开帮助
      if ((e.ctrlKey && e.key === '?') || (e.ctrlKey && e.shiftKey && e.key === '/')) {
        setIsOpen((prev) => !prev);
        e.preventDefault();
      }

      // Escape 关闭帮助
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return { isOpen, setIsOpen, shortcuts: DEFAULT_SHORTCUTS };
}

// 导出管理器实例
export { globalShortcutManager, ShortcutManager };

// 辅助函数：创建快捷键配置
export function createShortcut(
  key: string,
  modifiers: ShortcutModifier[] | undefined,
  description: string,
  action: () => void,
  options?: Partial<ShortcutConfig>
): ShortcutConfig {
  return {
    key,
    modifiers,
    description,
    action,
    preventDefault: true,
    ...options,
  };
}

export default useKeyboardShortcuts;
