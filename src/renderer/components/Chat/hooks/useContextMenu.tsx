/**
 * useContextMenu Hook
 * 右键菜单管理
 */

import { useState, useCallback, useEffect } from 'react';

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  danger?: boolean;
  action: () => void;
}

interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  items: ContextMenuItem[];
}

interface UseContextMenuReturn {
  contextMenu: ContextMenuState;
  openContextMenu: (
    event: React.MouseEvent,
    items: ContextMenuItem[]
  ) => void;
  closeContextMenu: () => void;
  renderContextMenu: () => React.ReactNode;
}

export function useContextMenu(): UseContextMenuReturn {
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    x: 0,
    y: 0,
    items: [],
  });

  const openContextMenu = useCallback(
    (event: React.MouseEvent, items: ContextMenuItem[]) => {
      event.preventDefault();

      const x = event.clientX;
      const y = event.clientY;

      setContextMenu({
        isOpen: true,
        x,
        y,
        items,
      });
    },
    []
  );

  const closeContextMenu = useCallback(() => {
    setContextMenu({
      isOpen: false,
      x: 0,
      y: 0,
      items: [],
    });
  }, []);

  useEffect(() => {
    const handleClick = () => {
      closeContextMenu();
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeContextMenu();
      }
    };

    if (contextMenu.isOpen) {
      document.addEventListener('click', handleClick);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [contextMenu.isOpen, closeContextMenu]);

  const renderContextMenu = useCallback(() => {
    if (!contextMenu.isOpen) return null;

    const { x, y, items } = contextMenu;

    return (
      <div
        className="fixed z-50 min-w-[12rem] bg-popover border border-border rounded-lg shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150"
        style={{ left: x, top: y }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="py-1">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                if (!item.disabled) {
                  item.action();
                  closeContextMenu();
                }
              }}
              disabled={item.disabled}
              className={`
                w-full px-3 py-2 text-sm text-left flex items-center gap-2
                transition-colors
                ${
                  item.disabled
                    ? 'opacity-50 cursor-not-allowed'
                    : item.danger
                    ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
                    : 'hover:bg-accent'
                }
              `}
            >
              {item.icon && <span className="w-4 h-4">{item.icon}</span>}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }, [contextMenu, closeContextMenu]);

  return {
    contextMenu,
    openContextMenu,
    closeContextMenu,
    renderContextMenu,
  };
}
