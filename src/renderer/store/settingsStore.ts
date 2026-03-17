import { create } from 'zustand';
import { Settings, AIProviderConfig } from '../../shared/types';

interface SettingsState extends Settings {
  loadSettings: () => Promise<void>;
  updateSettings: (newSettings: Partial<Settings>) => Promise<void>;
  setTheme: (theme: Settings['theme']) => void;
  setFontSize: (size: number) => void;
  setWordWrap: (wrap: boolean) => void;
  setTabSize: (size: number) => void;
  setMinimap: (show: boolean) => void;
  setFontFamily: (family: string) => void;
  // AI Configs
  loadAIConfigs: () => Promise<void>;
  saveAIConfig: (config: AIProviderConfig) => Promise<void>;
  deleteAIConfig: (configId: string) => Promise<void>;
  setActiveConfigId: (configId: string) => Promise<void>;
  syncAgentActiveConfig: (aiConfigId: string) => Promise<void>;
}

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
  aiBaseUrl: '',
  aiGroupId: '',
  language: 'zh-CN',
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...defaultSettings,

  loadSettings: async () => {
    try {
      const savedSettings = await window.electronAPI?.settings?.get();
      if (savedSettings) {
        set({ ...defaultSettings, ...savedSettings });
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  },

  updateSettings: async (newSettings: Partial<Settings>) => {
    try {
      // Save each setting to main process
      for (const [key, value] of Object.entries(newSettings)) {
        console.log('Saving setting:', key, value);
        await window.electronAPI?.settings?.set(key, value);
      }
      
      // Update local state immediately
      set(newSettings as Partial<SettingsState>);
      console.log('Settings updated:', newSettings);
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  },

  setTheme: (theme) => {
    get().updateSettings({ theme });
    set({ theme });
  },

  setFontSize: (fontSize) => {
    get().updateSettings({ fontSize });
    set({ fontSize });
  },

  setWordWrap: (wordWrap) => {
    get().updateSettings({ wordWrap });
    set({ wordWrap });
  },

  setTabSize: (tabSize) => {
    get().updateSettings({ tabSize });
    set({ tabSize });
  },

  setMinimap: (minimap) => {
    get().updateSettings({ minimap });
    set({ minimap });
  },

  setFontFamily: (fontFamily) => {
    get().updateSettings({ fontFamily });
    set({ fontFamily });
  },

  // AI Configs
  loadAIConfigs: async () => {
    try {
      const result = await window.electronAPI?.ai?.getConfigs?.();
      if (result) {
        const configs = result.configs || [];
        let activeId = result.activeConfigId || '';
        // 如果没有活跃配置但有配置列表，自动选中第一个
        if (!activeId && configs.length > 0) {
          activeId = configs[0].id;
          // 同步更新主进程的活跃配置
          await window.electronAPI?.ai?.setActiveConfig?.(activeId);
        }
        set({ aiConfigs: configs, activeConfigId: activeId });
      }
    } catch (error) {
      console.error('Failed to load AI configs:', error);
    }
  },

  saveAIConfig: async (config: AIProviderConfig) => {
    try {
      await window.electronAPI?.ai?.saveConfig?.(config);
      // Reload configs after saving
      await get().loadAIConfigs();
    } catch (error) {
      console.error('Failed to save AI config:', error);
    }
  },

  deleteAIConfig: async (configId: string) => {
    try {
      await window.electronAPI?.ai?.deleteConfig?.(configId);
      // Reload configs after deleting
      await get().loadAIConfigs();
    } catch (error) {
      console.error('Failed to delete AI config:', error);
    }
  },

  setActiveConfigId: async (configId: string) => {
    try {
      await window.electronAPI?.ai?.setActiveConfig?.(configId);
      set({ activeConfigId: configId });
      // 同步更新 Agent 配置中的默认 AI 配置
      await get().syncAgentActiveConfig(configId);
    } catch (error) {
      console.error('Failed to set active config:', error);
    }
  },

  // 同步更新 Agent 配置中的默认 AI 配置
  syncAgentActiveConfig: async (aiConfigId: string) => {
    try {
      const aiConfig = get().aiConfigs?.find(c => c.id === aiConfigId);
      if (!aiConfig) return;

      // 调用主进程更新 Agent 配置的默认 AI 配置
      await window.electronAPI?.unifiedAgent?.updateDefaultAIConfig?.(aiConfig);
    } catch (error) {
      console.error('Failed to sync agent active config:', error);
    }
  },
}));
