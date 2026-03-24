import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { Plus, Trash2, X, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import 'xterm/css/xterm.css';

interface TerminalPanelProps {
  onCollapse?: () => void;
}

interface TerminalSession {
  id: string;
  name: string;
  terminal: Terminal;
  fitAddon: FitAddon;
}

export const TerminalPanel: React.FC<TerminalPanelProps> = ({ onCollapse }) => {
  const [sessions, setSessions] = useState<TerminalSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const createTerminal = async () => {
    const terminal = new Terminal({
      fontSize: 14,
      fontFamily: 'JetBrains Mono, Fira Code, Consolas, monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        selectionBackground: '#264f78',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
      },
      cursorBlink: true,
      scrollback: 10000,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    const sessionId = `terminal-${Date.now()}`;
    
    const newSession: TerminalSession = {
      id: sessionId,
      name: `终端 ${sessions.length + 1}`,
      terminal,
      fitAddon,
    };

    setSessions(prev => [...prev, newSession]);
    setActiveSessionId(sessionId);

    // Create terminal session in main process
    try {
      const session = await window.electronAPI?.terminal?.create();
      if (session) {
        // Handle data from terminal
        window.electronAPI?.terminal?.onData((id, data) => {
          if (id === session.id) {
            terminal.write(data);
          }
        });

        // Handle terminal exit
        window.electronAPI?.terminal?.onExit((id) => {
          if (id === session.id) {
            closeTerminal(sessionId);
          }
        });

        // Send input to terminal
        terminal.onData((data) => {
          window.electronAPI?.terminal?.write(session.id, data);
        });

        // Resize terminal
        terminal.onResize(({ cols, rows }) => {
          window.electronAPI?.terminal?.resize(session.id, cols, rows);
        });
      }
    } catch (error) {
      console.error('Failed to create terminal session:', error);
    }
  };

  const closeTerminal = (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      session.terminal.dispose();
    }
    
    const newSessions = sessions.filter(s => s.id !== sessionId);
    setSessions(newSessions);
    
    if (activeSessionId === sessionId) {
      setActiveSessionId(newSessions.length > 0 ? newSessions[0].id : null);
    }
  };

  useEffect(() => {
    if (sessions.length === 0) {
      createTerminal();
    }
  }, []);

  useEffect(() => {
    if (containerRef.current && activeSessionId) {
      const session = sessions.find(s => s.id === activeSessionId);
      if (session && !session.terminal.element) {
        session.terminal.open(containerRef.current);
        session.fitAddon.fit();
        session.terminal.focus();
      }
    }
  }, [activeSessionId, sessions]);

  useEffect(() => {
    const handleResize = () => {
      sessions.forEach(session => {
        session.fitAddon.fit();
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [sessions]);

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e]">
      {/* Tabs */}
      <div className="flex items-center bg-muted border-b">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 ml-1 mr-1"
          onClick={onCollapse}
          title="收起终端"
        >
          <ChevronDown className="w-3 h-3" />
        </Button>
        {sessions.map(session => (
          <div
            key={session.id}
            onClick={() => setActiveSessionId(session.id)}
            className={cn(
              "group flex items-center gap-2 px-3 py-1.5 cursor-pointer border-r transition-colors",
              activeSessionId === session.id
                ? "bg-[#1e1e1e] text-white"
                : "hover:bg-accent"
            )}
          >
            <span className="text-xs">{session.name}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeTerminal(session.id);
              }}
              className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-muted rounded"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 ml-1"
          onClick={createTerminal}
        >
          <Plus className="w-3 h-3" />
        </Button>
        
        {sessions.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 ml-auto mr-1"
            onClick={() => {
              sessions.forEach(s => closeTerminal(s.id));
            }}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        )}
      </div>

      {/* Terminal Container */}
      <div 
        ref={containerRef} 
        className="flex-1 p-2 overflow-hidden"
      />
    </div>
  );
};
