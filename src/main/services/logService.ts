import * as fs from 'fs/promises';
import * as path from 'path';
import { app } from 'electron';

/**
 * 日志服务 - 将日志输出到本地文件，方便离线环境排查问题
 */
class LogService {
  private logDir: string = '';
  private logFile: string = '';
  private maxLogSize: number = 10 * 1024 * 1024; // 10MB
  private maxLogFiles: number = 5;
  private initialized: boolean = false;

  constructor() {
    // 延迟初始化，在 app ready 之后再初始化路径
    this.initialize();
  }

  /**
   * 初始化日志路径
   */
  private initialize(): void {
    if (this.initialized) return;
    
    try {
      // 使用应用数据目录存放日志
      this.logDir = path.join(app.getPath('userData'), 'logs');
      this.logFile = path.join(this.logDir, 'app.log');
      this.ensureLogDir();
      this.initialized = true;
      console.log('[LogService] Initialized at:', this.logFile);
    } catch (error) {
      console.error('[LogService] Failed to initialize:', error);
      // 使用临时目录作为后备
      this.logDir = path.join(process.env.TEMP || '/tmp', 'ywcoder-logs');
      this.logFile = path.join(this.logDir, 'app.log');
      this.ensureLogDir();
    }
  }

  /**
   * 确保日志方法被调用时已初始化
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      this.initialize();
    }
  }

  private async ensureLogDir(): Promise<void> {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
    } catch (error) {
      console.error('[LogService] Failed to create log directory:', error);
    }
  }

  /**
   * 写入日志到文件
   */
  async writeLog(level: 'INFO' | 'ERROR' | 'WARN' | 'DEBUG', message: string, ...args: any[]): Promise<void> {
    // 确保已初始化
    this.ensureInitialized();
    
    try {
      const timestamp = new Date().toISOString();
      const argsStr = args.length > 0 ? ' ' + args.map(arg => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      }).join(' ') : '';
      
      const logLine = `[${timestamp}] [${level}] ${message}${argsStr}\n`;
      
      // 追加写入日志文件
      await fs.appendFile(this.logFile, logLine, 'utf-8');
      
      // 检查日志文件大小，如果超过限制则轮转
      await this.rotateLogIfNeeded();
    } catch (error) {
      // 如果写入失败，输出到控制台
      console.error('[LogService] Failed to write log:', error);
      console.log(`[${level}] ${message}`, ...args);
    }
  }

  /**
   * 日志轮转
   */
  private async rotateLogIfNeeded(): Promise<void> {
    try {
      const stats = await fs.stat(this.logFile);
      if (stats.size > this.maxLogSize) {
        // 轮转日志文件
        for (let i = this.maxLogFiles - 1; i > 0; i--) {
          const oldFile = `${this.logFile}.${i}`;
          const newFile = `${this.logFile}.${i + 1}`;
          try {
            await fs.rename(oldFile, newFile);
          } catch {
            // 文件可能不存在，忽略错误
          }
        }
        
        // 重命名当前日志文件
        try {
          await fs.rename(this.logFile, `${this.logFile}.1`);
        } catch {
          // 忽略错误
        }
      }
    } catch {
      // 文件可能不存在，忽略错误
    }
  }

  /**
   * 获取日志文件路径
   */
  getLogFilePath(): string {
    return this.logFile;
  }

  /**
   * 获取日志目录路径
   */
  getLogDir(): string {
    return this.logDir;
  }

  /**
   * 读取最近的日志内容
   */
  async readRecentLogs(lines: number = 100): Promise<string> {
    try {
      const content = await fs.readFile(this.logFile, 'utf-8');
      const allLines = content.split('\n');
      return allLines.slice(-lines).join('\n');
    } catch (error) {
      return `Failed to read logs: ${error}`;
    }
  }

  // 便捷方法
  info(message: string, ...args: any[]): void {
    this.writeLog('INFO', message, ...args);
  }

  error(message: string, ...args: any[]): void {
    this.writeLog('ERROR', message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    this.writeLog('WARN', message, ...args);
  }

  debug(message: string, ...args: any[]): void {
    this.writeLog('DEBUG', message, ...args);
  }
}

// 导出单例实例
export const logService = new LogService();

// 全局日志函数，替换 console.log
export function appLog(message: string, ...args: any[]): void {
  logService.info(message, ...args);
}

export function appError(message: string, ...args: any[]): void {
  logService.error(message, ...args);
}

export function appWarn(message: string, ...args: any[]): void {
  logService.warn(message, ...args);
}

export function appDebug(message: string, ...args: any[]): void {
  logService.debug(message, ...args);
}
