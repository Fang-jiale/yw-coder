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

    console.log('[TerminalService] Creating terminal session:', {
      shell,
      cwd: cwd || homeDir,
      processEnvShell: process.env.SHELL,
      homedir: homeDir,
    });

    let ptyProcess: pty.IPty;
    try {
      ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-color',
        cols: 80,
        rows: 24,
        cwd: cwd || homeDir,
        env: process.env as { [key: string]: string },
      });
    } catch (error: any) {
      console.error('[TerminalService] pty.spawn failed:', {
        shell,
        error: error.message,
        code: error.code,
        errno: error.errno,
        syscall: error.syscall,
      });
      throw new Error(`Failed to create terminal: ${error.message}`);
    }

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

    console.log('[TerminalService] getShell called, platform:', platform, 'SHELL env:', process.env.SHELL);

    if (platform === 'win32') {
      return process.env.COMSPEC || 'cmd.exe';
    }

    if (platform === 'darwin') {
      const shells = [
        process.env.SHELL,
        '/bin/zsh',
        '/bin/bash',
        '/usr/local/bin/zsh',
        '/usr/local/bin/bash',
      ].filter(Boolean) as string[];

      for (const shell of shells) {
        try {
          const fs = require('fs');
          if (fs.existsSync(shell)) {
            console.log('[TerminalService] Selected shell:', shell);
            return shell;
          }
        } catch {
          // Continue to next shell
        }
      }

      console.log('[TerminalService] No valid shell found, using fallback: /bin/zsh');
      return '/bin/zsh';
    }

    return process.env.SHELL || '/bin/bash';
  }
}
