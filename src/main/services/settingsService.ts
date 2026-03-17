import { Settings } from '../../shared/types';
import * as fs from 'fs/promises';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import * as path from 'path';
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
    let userData: string;
    try {
      userData = app.getPath('userData');
      const testWrite = path.join(userData, '.test-write');
      require('fs').writeFileSync(testWrite, 'test');
      require('fs').unlinkSync(testWrite);
    } catch {
      userData = path.join(process.cwd(), '.ywcoder-data');
    }
    this.configPath = path.join(userData, 'config', 'settings.json');
    this.settings = { ...defaultSettings };
    this.loadSettingsSync();
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
