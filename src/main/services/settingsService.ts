import { Settings } from '../../shared/types';
import * as fs from 'fs/promises';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { app } from 'electron';

const defaultSettings: Settings = {
  theme: 'light',
  fontSize: 14,
  fontFamily: 'JetBrains Mono, Fira Code, Consolas, monospace',
  tabSize: 2,
  wordWrap: true,
  minimap: true,
  aiProvider: 'openai',
  aiModel: 'gpt-4',
  aiApiKey: '',
  language: 'zh-CN',
};

export class SettingsService {
  private configPath: string;
  private settings: Settings;
  private loaded: boolean = false;

  constructor() {
    const userData = this.getWritableDataPath();
    this.configPath = path.join(userData, 'config', 'settings.json');
    this.settings = { ...defaultSettings };
    this.loadSettingsSync();
  }

  // 获取可写的数据目录（支持多个备选路径）
  private getWritableDataPath(): string {
    const possiblePaths = [
      // 首选：Electron 标准用户数据目录
      (() => {
        try {
          return app.getPath('userData');
        } catch {
          return null;
        }
      })(),
      // 备选1：应用所在目录
      path.join(process.cwd(), '.ywcoder-data'),
      // 备选2：用户主目录
      path.join(os.homedir(), '.ywcoder-data'),
      // 备选3：临时目录
      path.join(os.tmpdir(), 'ywcoder-data'),
    ].filter(Boolean) as string[];

    for (const testPath of possiblePaths) {
      try {
        const testFile = path.join(testPath, '.test-write');
        // 确保目录存在
        if (!existsSync(testPath)) {
          mkdirSync(testPath, { recursive: true });
        }
        // 测试写入权限
        writeFileSync(testFile, 'test');
        // 清理测试文件
        try {
          require('fs').unlinkSync(testFile);
        } catch {
          // 忽略清理错误
        }
        console.log('[SettingsService] Using data path:', testPath);
        return testPath;
      } catch (e) {
        console.warn('[SettingsService] Path not writable:', testPath, e);
        continue;
      }
    }

    // 如果所有路径都失败，使用内存模式（不保存到磁盘）
    console.error('[SettingsService] No writable path found, using memory mode');
    return '';
  }

  getDataPath(): string {
    return path.dirname(path.dirname(this.configPath));
  }

  private loadSettingsSync(): void {
    try {
      const data = readFileSync(this.configPath, 'utf-8');
      this.settings = { ...defaultSettings, ...JSON.parse(data) };
      this.loaded = true;
    } catch {
      // 文件不存在或读取失败，使用默认设置
      this.settings = { ...defaultSettings };
      this.loaded = true;
    }
  }

  private async saveSettings(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.configPath), { recursive: true });
      await fs.writeFile(this.configPath, JSON.stringify(this.settings, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }

  private saveSettingsSync(): void {
    try {
      mkdirSync(path.dirname(this.configPath), { recursive: true });
      writeFileSync(this.configPath, JSON.stringify(this.settings, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save settings sync:', error);
    }
  }

  get(key?: string): any {
    if (key) {
      return this.settings[key as keyof Settings];
    }
    return this.settings;
  }

  set(key: string, value: any): void {
    (this.settings as any)[key] = value;
    this.saveSettingsSync();
  }

  getAll(): Settings {
    return this.settings;
  }

  reset(): void {
    this.settings = { ...defaultSettings };
    this.saveSettingsSync();
  }
}
