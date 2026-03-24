import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { useIsMobile } from '@/hooks/useMediaQuery';

interface ResponsiveLayoutContextType {
  isMobile: boolean;
  activePanel: 'sidebar' | 'chat' | 'editor' | 'terminal';
  setActivePanel: (panel: 'sidebar' | 'chat' | 'editor' | 'terminal') => void;
  isSidebarVisible: boolean;
  setSidebarVisible: (visible: boolean) => void;
  isChatVisible: boolean;
  setChatVisible: (visible: boolean) => void;
  isEditorVisible: boolean;
  setEditorVisible: (visible: boolean) => void;
  isTerminalVisible: boolean;
  setTerminalVisible: (visible: boolean) => void;
}

const ResponsiveLayoutContext = createContext<ResponsiveLayoutContextType | null>(null);

export function useResponsiveLayout(): ResponsiveLayoutContextType {
  const context = useContext(ResponsiveLayoutContext);
  if (!context) {
    throw new Error('useResponsiveLayout must be used within ResponsiveLayoutProvider');
  }
  return context;
}

interface ResponsiveLayoutProviderProps {
  children: React.ReactNode;
  defaultSidebarVisible?: boolean;
  defaultChatVisible?: boolean;
  defaultEditorVisible?: boolean;
  defaultTerminalVisible?: boolean;
}

export function ResponsiveLayoutProvider({
  children,
  defaultSidebarVisible = true,
  defaultChatVisible = true,
  defaultEditorVisible = true,
  defaultTerminalVisible = true,
}: ResponsiveLayoutProviderProps) {
  const isMobile = useIsMobile();

  const [activePanel, setActivePanel] = useState<'sidebar' | 'chat' | 'editor' | 'terminal'>('chat');
  const [isSidebarVisible, setSidebarVisible] = useState(defaultSidebarVisible);
  const [isChatVisible, setChatVisible] = useState(defaultChatVisible);
  const [isEditorVisible, setEditorVisible] = useState(defaultEditorVisible);
  const [isTerminalVisible, setTerminalVisible] = useState(defaultTerminalVisible);

  useMemo(() => {
    if (isMobile) {
      setSidebarVisible(false);
    }
  }, [isMobile]);

  const value = useMemo<ResponsiveLayoutContextType>(
    () => ({
      isMobile,
      activePanel,
      setActivePanel,
      isSidebarVisible,
      setSidebarVisible,
      isChatVisible,
      setChatVisible,
      isEditorVisible,
      setEditorVisible,
      isTerminalVisible,
      setTerminalVisible,
    }),
    [
      isMobile,
      activePanel,
      isSidebarVisible,
      isChatVisible,
      isEditorVisible,
      isTerminalVisible,
    ]
  );

  return (
    <ResponsiveLayoutContext.Provider value={value}>
      {children}
    </ResponsiveLayoutContext.Provider>
  );
}

interface ResponsivePanelProps {
  panel: 'sidebar' | 'chat' | 'editor' | 'terminal';
  children: React.ReactNode;
  className?: string;
}

export function ResponsivePanel({ panel, children, className = '' }: ResponsivePanelProps) {
  const { isMobile, activePanel, setActivePanel, setSidebarVisible } = useResponsiveLayout();

  const handleClick = useCallback(() => {
    if (isMobile && activePanel !== panel) {
      setActivePanel(panel);
    }
  }, [isMobile, activePanel, panel, setActivePanel]);

  const isVisible =
    !isMobile || activePanel === panel;

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className={className}
      onClick={isMobile ? handleClick : undefined}
      data-panel={panel}
    >
      {children}
    </div>
  );
}

interface MobileNavigationProps {
  className?: string;
}

export function MobileNavigation({ className = '' }: MobileNavigationProps) {
  const { activePanel, setActivePanel } = useResponsiveLayout();

  const tabs = [
    { id: 'sidebar' as const, label: '文件', icon: '📁' },
    { id: 'chat' as const, label: '对话', icon: '💬' },
    { id: 'editor' as const, label: '编辑', icon: '📝' },
    { id: 'terminal' as const, label: '终端', icon: '⌨️' },
  ];

  return (
    <div
      className={`flex items-center justify-around bg-background border-t ${className}`}
      role="tablist"
      aria-label="面板导航"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activePanel === tab.id}
          onClick={() => setActivePanel(tab.id)}
          className={`flex flex-col items-center gap-1 px-4 py-3 transition-colors ${
            activePanel === tab.id
              ? 'text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <span className="text-lg">{tab.icon}</span>
          <span className="text-xs">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}

interface SwipeablePanelProps {
  children: React.ReactNode;
  direction: 'left' | 'right';
  onSwipe: () => void;
  threshold?: number;
  className?: string;
}

export function SwipeablePanel({
  children,
  direction,
  onSwipe,
  threshold = 50,
  className = '',
}: SwipeablePanelProps) {
  const [startX, setStartX] = useState(0);
  const [currentX, setCurrentX] = useState(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setStartX(e.touches[0].clientX);
    setCurrentX(e.touches[0].clientX);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    setCurrentX(e.touches[0].clientX);
  }, []);

  const handleTouchEnd = useCallback(() => {
    const diff = startX - currentX;

    if (direction === 'left' && diff > threshold) {
      onSwipe();
    } else if (direction === 'right' && diff < -threshold) {
      onSwipe();
    }

    setStartX(0);
    setCurrentX(0);
  }, [startX, currentX, direction, threshold, onSwipe]);

  return (
    <div
      className={className}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {children}
    </div>
  );
}
