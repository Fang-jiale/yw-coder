/**
 * Configuration Manager - 统一配置管理服务
 * 集中管理所有配置：AI、Agent、应用设置
 */

import { SettingsService } from './settingsService';
import { AIProviderConfig } from '../../shared/types';
import { 
  AgentConfig, 
  createAgentConfig,
  getBuiltInAgents,
  AgentType
} from '../../shared/types';
import * as fs from 'fs/promises';
import * as path from 'path';

export class ConfigManager {
  private settingsService: SettingsService;
  private agentConfigCache: AgentConfig[] | null = null;
  private agentConfigPath: string;

  constructor(settingsService: SettingsService) {
    this.settingsService = settingsService;
    this.agentConfigPath = path.join(
      this.settingsService.getDataPath(),
      'agent-configs.json'
    );
  }

  // AI 配置管理
  getAIConfigs(): AIProviderConfig[] {
    return (this.settingsService.get('aiConfigs') || []) as AIProviderConfig[];
  }

  getAIConfig(configId: string): AIProviderConfig | undefined {
    return this.getAIConfigs().find(c => c.id === configId);
  }

  getActiveAIConfig(): AIProviderConfig | null {
    const configs = this.getAIConfigs();
    const activeId = this.settingsService.get('activeConfigId');
    
    if (activeId) {
      const config = configs.find(c => c.id === activeId);
      if (config) return config;
    }
    
    const defaultConfig = configs.find(c => c.isDefault);
    if (defaultConfig) return defaultConfig;
    
    return configs.length > 0 ? configs[0] : null;
  }

  saveAIConfig(config: AIProviderConfig): void {
    const configs = this.getAIConfigs();
    const existingIndex = configs.findIndex(c => c.id === config.id);
    
    if (existingIndex >= 0) {
      configs[existingIndex] = config;
    } else {
      configs.push(config);
    }
    
    this.settingsService.set('aiConfigs', configs);

    if (configs.length === 1 || config.isDefault) {
      this.settingsService.set('activeConfigId', config.id);
    }

    // 清除 Agent 配置缓存（因为它们依赖 AI 配置）
    this.agentConfigCache = null;
  }

  deleteAIConfig(configId: string): void {
    const configs = this.getAIConfigs().filter(c => c.id !== configId);
    this.settingsService.set('aiConfigs', configs);
    
    const activeId = this.settingsService.get('activeConfigId');
    if (activeId === configId) {
      if (configs.length > 0) {
        this.settingsService.set('activeConfigId', configs[0].id);
      } else {
        this.settingsService.set('activeConfigId', '');
      }
    }

    // 清除 Agent 配置缓存
    this.agentConfigCache = null;
  }

  setActiveAIConfig(configId: string): void {
    this.settingsService.set('activeConfigId', configId);
  }

  // Agent 配置管理
  async getAgentConfigs(): Promise<AgentConfig[]> {
    if (this.agentConfigCache) {
      return this.agentConfigCache;
    }

    try {
      const data = await fs.readFile(this.agentConfigPath, 'utf-8');
      this.agentConfigCache = JSON.parse(data);
      return this.agentConfigCache || [];
    } catch {
      this.agentConfigCache = [];
      return [];
    }
  }

  async getAgentConfig(configId: string): Promise<AgentConfig | undefined> {
    const configs = await this.getAgentConfigs();
    return configs.find(c => c.id === configId);
  }

  async getAgentByType(type: AgentType): Promise<AgentConfig | undefined> {
    const configs = await this.getAgentConfigs();
    return configs.find(c => c.type === type);
  }

  async saveAgentConfig(config: AgentConfig): Promise<void> {
    let configs = await this.getAgentConfigs();
    const existingIndex = configs.findIndex(c => c.id === config.id);
    
    if (existingIndex >= 0) {
      configs[existingIndex] = {
        ...config,
        updatedAt: Date.now()
      };
    } else {
      configs.push(config);
    }

    await this.ensureConfigDir();
    await fs.writeFile(
      this.agentConfigPath, 
      JSON.stringify(configs, null, 2), 
      'utf-8'
    );
    this.agentConfigCache = configs;
  }

  async deleteAgentConfig(configId: string): Promise<void> {
    let configs = await this.getAgentConfigs();
    const agent = configs.find(c => c.id === configId);
    
    // 不能删除内置智能体
    if (agent?.isBuiltIn) {
      throw new Error('Cannot delete built-in agent');
    }

    configs = configs.filter(c => c.id !== configId);

    await this.ensureConfigDir();
    await fs.writeFile(
      this.agentConfigPath, 
      JSON.stringify(configs, null, 2), 
      'utf-8'
    );
    this.agentConfigCache = configs;
  }

  async setDefaultAgentConfig(configId: string): Promise<void> {
    let configs = await this.getAgentConfigs();
    configs = configs.map(c => ({
      ...c,
      isDefault: c.id === configId
    }));

    await this.ensureConfigDir();
    await fs.writeFile(
      this.agentConfigPath, 
      JSON.stringify(configs, null, 2), 
      'utf-8'
    );
    this.agentConfigCache = configs;
  }

  async syncAgentWithAIConfig(aiConfig: AIProviderConfig): Promise<void> {
    let configs = await this.getAgentConfigs();
    
    // 更新所有 Agent 配置的默认 AI 配置
    configs = configs.map(agentConfig => ({
      ...agentConfig,
      aiConfig,
      updatedAt: Date.now(),
    }));

    await this.ensureConfigDir();
    await fs.writeFile(
      this.agentConfigPath, 
      JSON.stringify(configs, null, 2), 
      'utf-8'
    );
    this.agentConfigCache = configs;
  }

  async createDefaultAgentConfigs(aiConfig?: AIProviderConfig): Promise<AgentConfig[]> {
    const configs = await this.getAgentConfigs();
    
    // 如果已经有配置，不创建默认配置
    if (configs.length > 0) {
      return configs;
    }

    const effectiveAIConfig = aiConfig || this.getActiveAIConfig();
    if (!effectiveAIConfig) {
      return [];
    }

    // 创建内置智能体配置
    const builtInAgents = getBuiltInAgents(effectiveAIConfig);
    
    await this.ensureConfigDir();
    await fs.writeFile(
      this.agentConfigPath, 
      JSON.stringify(builtInAgents, null, 2), 
      'utf-8'
    );
    this.agentConfigCache = builtInAgents;
    
    return builtInAgents;
  }

  async updateBuiltInAgent(type: AgentType, updates: Partial<AgentConfig>): Promise<AgentConfig | undefined> {
    let configs = await this.getAgentConfigs();
    const agentIndex = configs.findIndex(c => c.type === type && c.isBuiltIn);
    
    if (agentIndex === -1) {
      return undefined;
    }

    configs[agentIndex] = {
      ...configs[agentIndex],
      ...updates,
      id: configs[agentIndex].id, // 保持原有 ID
      type: configs[agentIndex].type, // 保持原有类型
      isBuiltIn: true, // 保持内置标志
      updatedAt: Date.now(),
    };

    await this.ensureConfigDir();
    await fs.writeFile(
      this.agentConfigPath, 
      JSON.stringify(configs, null, 2), 
      'utf-8'
    );
    this.agentConfigCache = configs;
    
    return configs[agentIndex];
  }

  async cloneAgentConfig(agentId: string, newName?: string): Promise<AgentConfig | undefined> {
    const configs = await this.getAgentConfigs();
    const agent = configs.find(c => c.id === agentId);
    
    if (!agent) {
      return undefined;
    }

    const now = Date.now();
    const clonedAgent: AgentConfig = {
      ...agent,
      id: `agent-${now}-${Math.random().toString(36).substr(2, 9)}`,
      name: newName || `${agent.name} (副本)`,
      isBuiltIn: false,
      isDefault: false,
      createdAt: now,
      updatedAt: now,
    };

    configs.push(clonedAgent);

    await this.ensureConfigDir();
    await fs.writeFile(
      this.agentConfigPath, 
      JSON.stringify(configs, null, 2), 
      'utf-8'
    );
    this.agentConfigCache = configs;
    
    return clonedAgent;
  }

  private async ensureConfigDir(): Promise<void> {
    const dir = path.dirname(this.agentConfigPath);
    await fs.mkdir(dir, { recursive: true });
  }

  // 应用设置管理
  getSetting<T = any>(key: string): T {
    return this.settingsService.get(key) as T;
  }

  setSetting<T = any>(key: string, value: T): void {
    this.settingsService.set(key, value);
  }

  // 清理缓存
  clearCache(): void {
    this.agentConfigCache = null;
  }
}

// 全局单例实例
let configManagerInstance: ConfigManager | null = null;

export function getConfigManager(settingsService: SettingsService): ConfigManager {
  if (!configManagerInstance) {
    configManagerInstance = new ConfigManager(settingsService);
  }
  return configManagerInstance;
}
