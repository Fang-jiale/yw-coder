/**
 * 统一日志工具模块
 * 支持同时输出到控制台和文件，JSON 格式，按天滚动
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface LogEntry {
  ts: string;
  level: LogLevel;
  event: string;
  traceId?: string;
  message?: string;
  [key: string]: any;
}

class Logger {
  private static instance: Logger;
  private logDir: string = '';
  private currentLogFile: string = '';
  private currentDate: string = '';
  private initialized: boolean = false;

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * 初始化日志系统
   * 应在应用启动时调用一次
   */
  init(): void {
    if (this.initialized) return;

    try {
      // 使用 Electron 的 userData 目录
      const userDataPath = app.getPath('userData');
      this.logDir = path.join(userDataPath, 'logs');

      // 确保日志目录存在
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }

      this.updateLogFile();
      this.initialized = true;

      this.info('logger_initialized', { logDir: this.logDir });
    } catch (error) {
      console.error('[Logger] 初始化失败:', error);
    }
  }

  /**
   * 更新当前日志文件路径（按天滚动）
   */
  private updateLogFile(): void {
    const date = new Date().toISOString().split('T')[0];
    if (date !== this.currentDate) {
      this.currentDate = date;
      this.currentLogFile = path.join(this.logDir, `ywcoder-${date}.log`);
    }
  }

  /**
   * 写入日志
   */
  private writeLog(entry: LogEntry): void {
    // 构建日志行
    const logLine = JSON.stringify(entry);

    if (!this.initialized) {
      // 未初始化时只输出到控制台
      console.log(logLine);
      return;
    }

    try {
      // 检查是否需要滚动
      this.updateLogFile();

      // 同时输出到控制台和文件
      const consoleMethod = entry.level === 'ERROR' ? console.error :
                           entry.level === 'WARN' ? console.warn :
                           entry.level === 'DEBUG' ? console.debug : console.log;
      consoleMethod(logLine);

      // 写入文件
      fs.appendFileSync(this.currentLogFile, logLine + '\n');
    } catch (error) {
      console.error('[Logger] 写入日志失败:', error);
    }
  }

  /**
   * 生成 traceId
   */
  generateTraceId(prefix: string = 'chat'): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}_${timestamp}_${random}`;
  }

  /**
   * 记录 DEBUG 级别日志
   */
  debug(event: string, data: Omit<LogEntry, 'ts' | 'level' | 'event'> = {}): void {
    this.writeLog({
      ts: new Date().toISOString(),
      level: 'DEBUG',
      event,
      ...data
    });
  }

  /**
   * 记录 INFO 级别日志
   */
  info(event: string, data: Omit<LogEntry, 'ts' | 'level' | 'event'> = {}): void {
    this.writeLog({
      ts: new Date().toISOString(),
      level: 'INFO',
      event,
      ...data
    });
  }

  /**
   * 记录 WARN 级别日志
   */
  warn(event: string, data: Omit<LogEntry, 'ts' | 'level' | 'event'> = {}): void {
    this.writeLog({
      ts: new Date().toISOString(),
      level: 'WARN',
      event,
      ...data
    });
  }

  /**
   * 记录 ERROR 级别日志
   */
  error(event: string, data: Omit<LogEntry, 'ts' | 'level' | 'event'> = {}): void {
    this.writeLog({
      ts: new Date().toISOString(),
      level: 'ERROR',
      event,
      ...data
    });
  }

  /**
   * 获取当前日志文件路径
   */
  getCurrentLogFile(): string {
    return this.currentLogFile;
  }

  /**
   * 获取日志目录
   */
  getLogDir(): string {
    return this.logDir;
  }
}

// 导出单例实例
export const logger = Logger.getInstance();

// 为了兼容现有代码，也导出 Logger 类
export { Logger };
