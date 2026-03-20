import * as pty from 'node-pty';
import { TerminalSession } from '../../shared/types';
import * as os from 'os';
import * as path from 'path';

export class TerminalService {
  private sessions: Map<string, pty.IPty> = new Map();
  private dataCallbacks: Map<string, (data: string) => void> = new Map();
  private exitCallbacks: Map<string, (code: number) => void> = new Map();

  createSession(cwd?: string): TerminalSession {
    const id = `terminal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const shell = this.getShell();
    const homeDir = os.homedir();
    
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-color',
      cols: 80,
      rows: 24,
      cwd: cwd || homeDir,
      env: process.env as { [key: string]: string },
    });

    this.sessions.set(id, ptyProcess);

    ptyProcess.onData((data) => {
      const callback = this.dataCallbacks.get(id);
      if (callback) {
        callback(data);
      }
    });

    ptyProcess.onExit(({ exitCode }) => {
      const callback = this.exitCallbacks.get(id);
      if (callback) {
        callback(exitCode);
      }
      this.sessions.delete(id);
    });

    return {
      id,
      name: `Terminal ${this.sessions.size}`,
      cwd: cwd || homeDir,
    };
  }

  write(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.write(data);
    }
  }

  resize(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.resize(cols, rows);
    }
  }

  kill(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.kill();
      this.sessions.delete(sessionId);
    }
  }

  onData(sessionId: string, callback: (data: string) => void): void {
    this.dataCallbacks.set(sessionId, callback);
  }

  onExit(sessionId: string, callback: (code: number) => void): void {
    this.exitCallbacks.set(sessionId, callback);
  }

  disposeAll(): void {
    for (const [id, session] of this.sessions) {
      session.kill();
    }
    this.sessions.clear();
    this.dataCallbacks.clear();
    this.exitCallbacks.clear();
  }

  private getShell(): string {
    const platform = os.platform();
    
    if (platform === 'win32') {
      return process.env.COMSPEC || 'cmd.exe';
    }
    
    if (platform === 'darwin') {
      // macOS: try to find available shell
      const shells = [
        process.env.SHELL,
        '/bin/zsh',
        '/bin/bash',
        '/usr/local/bin/zsh',
        '/usr/local/bin/bash',
      ].filter(Boolean) as string[];
      
      for (const shell of shells) {
        try {
          // Check if shell exists using require('fs')
          const fs = require('fs');
          if (fs.existsSync(shell)) {
            return shell;
          }
        } catch {
          // Continue to next shell
        }
      }
      
      return '/bin/zsh'; // Default fallback
    }
    
    return process.env.SHELL || '/bin/bash';
  }
}
