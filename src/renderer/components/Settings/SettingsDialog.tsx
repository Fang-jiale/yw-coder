import { useState, useEffect } from 'react';
import { 
  Settings, X, Moon, Sun, Monitor, Type, WrapText, Indent, 
  Bot, Shield, Terminal, Bell, Keyboard, Code, FileCode,
  ChevronRight, User, Globe, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AIConfigManager } from './AIConfigManager';
import { AIProviderConfig } from '../../../shared/types';
import { useSettingsStore } from '@/store/settingsStore';
import { cn } from '@/lib/utils';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SettingsTab = 'ai' | 'general' | 'agent' | 'mcp' | 'rules' | 'shortcuts';

interface SettingsSection {
  id: SettingsTab;
  label: string;
  icon: React.ElementType;
  description: string;
}

const SETTINGS_SECTIONS: SettingsSection[] = [
  { id: 'ai', label: 'AI 配置', icon: Bot, description: '管理 AI 模型和 API 设置' },
  { id: 'general', label: '通用设置', icon: Settings, description: '编辑器外观和行为设置' },
  { id: 'agent', label: '智能体', icon: Zap, description: 'Agent 行为和工作流设置' },
  { id: 'mcp', label: 'MCP 工具', icon: Code, description: 'MCP 服务器和工具配置' },
  { id: 'rules', label: '规则与技能', icon: FileCode, description: '自定义系统提示词和规则' },
  { id: 'shortcuts', label: '快捷键', icon: Keyboard, description: '键盘快捷键配置' },
];

export const SettingsDialog: React.FC<SettingsDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('ai');
  const [providers, setProviders] = useState<Record<string, { name: string; defaultBaseUrl: string; models: string[]; defaultModel: string }>>({});
  
  // 通用设置和AI配置
  const settings = useSettingsStore();
  const { aiConfigs, activeConfigId, loadAIConfigs, saveAIConfig, deleteAIConfig, setActiveConfigId } = useSettingsStore();
  const [localSettings, setLocalSettings] = useState({
    theme: settings.theme,
    fontSize: settings.fontSize,
    wordWrap: settings.wordWrap,
    tabSize: settings.tabSize,
    minimap: settings.minimap,
    fontFamily: settings.fontFamily,
  });

  // Agent 设置
  const [agentSettings, setAgentSettings] = useState({
    autoRun: false,
    autoApprove: false,
    showThinking: true,
    maxIterations: 30,
    enableCheckpoint: true,
    checkpointInterval: 30,
  });

  // MCP 设置
  const [mcpSettings, setMcpSettings] = useState({
    enabled: true,
    autoApproveTools: false,
    toolTimeout: 60000,
    maxToolCalls: 50,
  });

  useEffect(() => {
    if (open) {
      loadAIConfigs();
      loadProviders();
      setLocalSettings({
        theme: settings.theme,
        fontSize: settings.fontSize,
        wordWrap: settings.wordWrap,
        tabSize: settings.tabSize,
        minimap: settings.minimap,
        fontFamily: settings.fontFamily,
      });
    }
  }, [open, settings]);

  const loadProviders = async () => {
    try {
      const result = await window.electronAPI?.ai?.getProviders?.();
      console.log('Loaded providers:', result);
      if (result) {
        setProviders(result);
      }
    } catch (error) {
      console.error('Failed to load providers:', error);
    }
  };

  const handleSaveConfig = async (config: AIProviderConfig) => {
    try {
      console.log('Saving config:', config);
      await saveAIConfig(config);
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  };

  const handleDeleteConfig = async (configId: string) => {
    try {
      await deleteAIConfig(configId);
    } catch (error) {
      console.error('Failed to delete config:', error);
    }
  };

  const handleSetActiveConfig = async (configId: string) => {
    try {
      await setActiveConfigId(configId);
    } catch (error) {
      console.error('Failed to set active config:', error);
    }
  };

  const handleSaveGeneralSettings = () => {
    settings.setTheme(localSettings.theme);
    settings.setFontSize(localSettings.fontSize);
    settings.setWordWrap(localSettings.wordWrap);
    settings.setTabSize(localSettings.tabSize);
    settings.setMinimap(localSettings.minimap);
    settings.setFontFamily(localSettings.fontFamily);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'ai':
        return (
          <AIConfigManager
            configs={aiConfigs || []}
            activeConfigId={activeConfigId || ''}
            onSave={handleSaveConfig}
            onDelete={handleDeleteConfig}
            onSetActive={handleSetActiveConfig}
            providers={providers}
          />
        );
      
      case 'general':
        return (
          <div className="space-y-6">
            {/* Theme - 仅显示浅色模式 */}
            <div className="space-y-3">
              <label className="text-sm font-medium flex items-center gap-2">
                <Sun className="w-4 h-4" />
                主题
              </label>
              <div className="flex items-center gap-2 px-4 py-2 rounded-md border border-primary bg-primary/10 text-primary w-fit">
                <Sun className="w-4 h-4" />
                浅色模式
              </div>
              <p className="text-xs text-muted-foreground">当前仅支持浅色模式</p>
            </div>

            {/* Font Size */}
            <div className="space-y-3">
              <label className="text-sm font-medium flex items-center gap-2">
                <Type className="w-4 h-4" />
                字体大小
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="12"
                  max="20"
                  value={localSettings.fontSize}
                  onChange={(e) => setLocalSettings({ ...localSettings, fontSize: parseInt(e.target.value) })}
                  className="flex-1"
                />
                <span className="text-sm w-12 text-right">{localSettings.fontSize}px</span>
              </div>
            </div>

            {/* Context Budget - 上下文限制 */}
            <div className="space-y-3">
              <label className="text-sm font-medium flex items-center gap-2">
                <Bot className="w-4 h-4" />
                上下文限制
              </label>
              <div className="flex items-center gap-2 px-4 py-2 rounded-md border border-primary bg-primary/10 text-primary w-fit">
                32KB
              </div>
              <p className="text-xs text-muted-foreground">当前上下文窗口限制为 32KB，更多选项即将推出</p>
            </div>

            {/* Font Family */}
            <div className="space-y-3">
              <label className="text-sm font-medium flex items-center gap-2">
                <Code className="w-4 h-4" />
                字体
              </label>
              <select
                value={localSettings.fontFamily}
                onChange={(e) => setLocalSettings({ ...localSettings, fontFamily: e.target.value })}
                className="w-full px-3 py-2 rounded-md border border-input bg-background"
              >
                <option value="JetBrains Mono, Fira Code, Consolas, monospace">JetBrains Mono</option>
                <option value="Fira Code, Consolas, monospace">Fira Code</option>
                <option value="Consolas, Monaco, monospace">Consolas</option>
                <option value="Monaco, monospace">Monaco</option>
                <option value="Source Code Pro, monospace">Source Code Pro</option>
              </select>
            </div>

            {/* Tab Size */}
            <div className="space-y-3">
              <label className="text-sm font-medium flex items-center gap-2">
                <Indent className="w-4 h-4" />
                缩进大小
              </label>
              <div className="flex gap-2">
                {[2, 4].map((size) => (
                  <button
                    key={size}
                    onClick={() => setLocalSettings({ ...localSettings, tabSize: size })}
                    className={cn(
                      "px-4 py-2 rounded-md border transition-all",
                      localSettings.tabSize === size
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-input hover:bg-accent'
                    )}
                  >
                    {size} 空格
                  </button>
                ))}
              </div>
            </div>

            {/* Word Wrap */}
            <div className="space-y-3">
              <label className="text-sm font-medium flex items-center gap-2">
                <WrapText className="w-4 h-4" />
                自动换行
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="wordWrap"
                  checked={localSettings.wordWrap}
                  onChange={(e) => setLocalSettings({ ...localSettings, wordWrap: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <label htmlFor="wordWrap" className="text-sm cursor-pointer">
                  启用自动换行
                </label>
              </div>
            </div>

            {/* Minimap */}
            <div className="space-y-3">
              <label className="text-sm font-medium flex items-center gap-2">
                <Globe className="w-4 h-4" />
                代码缩略图
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="minimap"
                  checked={localSettings.minimap}
                  onChange={(e) => setLocalSettings({ ...localSettings, minimap: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <label htmlFor="minimap" className="text-sm cursor-pointer">
                  显示代码缩略图
                </label>
              </div>
            </div>

            <Button onClick={handleSaveGeneralSettings} className="w-full">
              保存设置
            </Button>
          </div>
        );

      case 'agent':
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Agent 行为设置
              </h3>
              
              <div className="space-y-3 p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">自动运行</div>
                    <div className="text-xs text-muted-foreground">Agent 自动执行代码生成和修改</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={agentSettings.autoRun}
                    onChange={(e) => setAgentSettings({ ...agentSettings, autoRun: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">自动批准</div>
                    <div className="text-xs text-muted-foreground">自动批准工具调用，无需确认</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={agentSettings.autoApprove}
                    onChange={(e) => setAgentSettings({ ...agentSettings, autoApprove: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">显示思考过程</div>
                    <div className="text-xs text-muted-foreground">展示 AI 的思考过程</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={agentSettings.showThinking}
                    onChange={(e) => setAgentSettings({ ...agentSettings, showThinking: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                </div>
              </div>

              <div className="space-y-3 p-4 border rounded-lg">
                <div>
                  <label className="text-sm font-medium">最大迭代次数</label>
                  <div className="text-xs text-muted-foreground mb-2">Agent 单轮对话最大工具调用次数</div>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={agentSettings.maxIterations}
                    onChange={(e) => setAgentSettings({ ...agentSettings, maxIterations: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 rounded-md border border-input bg-background"
                  />
                </div>
              </div>

              <div className="space-y-3 p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">启用 Checkpoint</div>
                    <div className="text-xs text-muted-foreground">自动保存任务状态，支持恢复</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={agentSettings.enableCheckpoint}
                    onChange={(e) => setAgentSettings({ ...agentSettings, enableCheckpoint: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                </div>

                {agentSettings.enableCheckpoint && (
                  <div>
                    <label className="text-sm font-medium">保存间隔（秒）</label>
                    <input
                      type="number"
                      min="10"
                      max="300"
                      value={agentSettings.checkpointInterval}
                      onChange={(e) => setAgentSettings({ ...agentSettings, checkpointInterval: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 rounded-md border border-input bg-background mt-2"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 'mcp':
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Code className="w-4 h-4" />
                MCP 工具配置
              </h3>
              
              <div className="space-y-3 p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">启用 MCP</div>
                    <div className="text-xs text-muted-foreground">使用 MCP 工具扩展 AI 能力</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={mcpSettings.enabled}
                    onChange={(e) => setMcpSettings({ ...mcpSettings, enabled: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                </div>
              </div>

              <div className="space-y-3 p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">自动批准工具</div>
                    <div className="text-xs text-muted-foreground">无需确认直接执行工具</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={mcpSettings.autoApproveTools}
                    onChange={(e) => setMcpSettings({ ...mcpSettings, autoApproveTools: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">工具超时（毫秒）</label>
                  <input
                    type="number"
                    min="1000"
                    max="300000"
                    step="1000"
                    value={mcpSettings.toolTimeout}
                    onChange={(e) => setMcpSettings({ ...mcpSettings, toolTimeout: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 rounded-md border border-input bg-background mt-2"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">最大工具调用次数</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={mcpSettings.maxToolCalls}
                    onChange={(e) => setMcpSettings({ ...mcpSettings, maxToolCalls: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 rounded-md border border-input bg-background mt-2"
                  />
                </div>
              </div>

              <div className="p-4 border rounded-lg bg-muted/50">
                <div className="text-sm font-medium mb-2">内置工具列表</div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Code className="w-4 h-4 text-muted-foreground" />
                    <span>read_file - 读取文件内容</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Code className="w-4 h-4 text-muted-foreground" />
                    <span>write_file - 写入文件</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Code className="w-4 h-4 text-muted-foreground" />
                    <span>edit_file - 编辑文件</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Code className="w-4 h-4 text-muted-foreground" />
                    <span>search_files - 搜索文件内容</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Code className="w-4 h-4 text-muted-foreground" />
                    <span>execute_command - 执行命令</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Code className="w-4 h-4 text-muted-foreground" />
                    <span>grep_search - Grep 搜索</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Code className="w-4 h-4 text-muted-foreground" />
                    <span>glob_search - Glob 搜索</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'rules':
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <FileCode className="w-4 h-4" />
                自定义规则
              </h3>
              
              <div className="p-4 border rounded-lg">
                <div className="text-sm font-medium mb-2">系统提示词</div>
                <textarea
                  className="w-full h-40 px-3 py-2 rounded-md border border-input bg-background font-mono text-sm"
                  placeholder="输入自定义系统提示词，这将影响 AI 的行为和回复风格..."
                  defaultValue={""}
                />
                <div className="text-xs text-muted-foreground mt-2">
                  自定义系统提示词将追加到默认提示词之后
                </div>
              </div>

              <div className="p-4 border rounded-lg">
                <div className="text-sm font-medium mb-2">代码风格规则</div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="rounded border-gray-300" />
                    <span className="text-sm">使用单引号</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="rounded border-gray-300" />
                    <span className="text-sm">省略分号</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="rounded border-gray-300" />
                    <span className="text-sm">使用箭头函数</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="rounded border-gray-300" />
                    <span className="text-sm">添加 JSDoc 注释</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        );

      case 'shortcuts':
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Keyboard className="w-4 h-4" />
                快捷键设置
              </h3>
              
              <div className="space-y-2">
                {[
                  { action: '打开设置', shortcut: 'Cmd/Ctrl + ,' },
                  { action: '新建对话', shortcut: 'Cmd/Ctrl + N' },
                  { action: '发送消息', shortcut: 'Enter' },
                  { action: '换行', shortcut: 'Shift + Enter' },
                  { action: '打开命令面板', shortcut: 'Cmd/Ctrl + Shift + P' },
                  { action: '切换侧边栏', shortcut: 'Cmd/Ctrl + B' },
                  { action: '格式化代码', shortcut: 'Shift + Alt + F' },
                  { action: '查找文件', shortcut: 'Cmd/Ctrl + P' },
                ].map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <span className="text-sm">{item.action}</span>
                    <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">{item.shortcut}</kbd>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background w-full max-w-4xl max-h-[85vh] overflow-hidden rounded-lg shadow-lg flex">
        {/* Sidebar */}
        <div className="w-64 border-r bg-muted/30 flex flex-col">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Settings className="w-5 h-5" />
              设置
            </h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2">
            <nav className="space-y-1">
              {SETTINGS_SECTIONS.map((section) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveTab(section.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors text-left",
                      activeTab === section.id
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {section.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div>
              <h3 className="font-semibold">
                {SETTINGS_SECTIONS.find(s => s.id === activeTab)?.label}
              </h3>
              <p className="text-xs text-muted-foreground">
                {SETTINGS_SECTIONS.find(s => s.id === activeTab)?.description}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  );
};
