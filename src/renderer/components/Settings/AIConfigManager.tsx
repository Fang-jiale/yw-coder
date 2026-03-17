import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Edit2, TestTube } from 'lucide-react';
import { AIProviderConfig } from '../../../shared/types';

interface AIConfigManagerProps {
  configs: AIProviderConfig[];
  activeConfigId: string;
  onSave: (config: AIProviderConfig) => void;
  onDelete: (configId: string) => void;
  onSetActive: (configId: string) => void;
  providers: Record<string, { name: string; defaultBaseUrl: string; models: string[]; defaultModel: string }>;
}

export const AIConfigManager: React.FC<AIConfigManagerProps> = ({
  configs,
  activeConfigId,
  onSave,
  onDelete,
  onSetActive,
  providers,
}) => {
  const [editingConfig, setEditingConfig] = useState<AIProviderConfig | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // 当 providers 加载完成时，如果正在编辑且模型为空，自动填充默认模型
  useEffect(() => {
    if (isEditing && editingConfig && Object.keys(providers).length > 0) {
      const providerInfo = providers[editingConfig.provider];
      if (providerInfo && !editingConfig.model) {
        setEditingConfig({
          ...editingConfig,
          model: providerInfo.defaultModel,
        });
      }
    }
  }, [providers, isEditing, editingConfig?.provider]);

  const createNewConfig = (): AIProviderConfig => ({
    id: Date.now().toString(),
    name: '',
    provider: 'openai',
    apiKey: '',
    baseUrl: '',
    model: '',
    isDefault: configs.length === 0,
    groupId: '',
  });

  const handleAdd = () => {
    setEditingConfig(createNewConfig());
    setIsEditing(true);
    setTestResult(null);
  };

  const handleEdit = (config: AIProviderConfig) => {
    setEditingConfig({ ...config });
    setIsEditing(true);
    setTestResult(null);
  };

  const handleSave = () => {
    if (editingConfig && editingConfig.name && editingConfig.apiKey) {
      const providerInfo = providers[editingConfig.provider];
      const configToSave = {
        ...editingConfig,
        model: editingConfig.model || providerInfo?.defaultModel || '',
        // 如果用户没有填写 baseUrl，使用 provider 的默认 baseUrl
        baseUrl: editingConfig.baseUrl || providerInfo?.defaultBaseUrl || '',
        // 确保保存高级设置字段
        supportsFunctionCall: editingConfig.supportsFunctionCall,
        contextLength: editingConfig.contextLength,
        maxTokens: editingConfig.maxTokens,
        apiFormat: editingConfig.apiFormat,
        // 确保 groupId 被保存
        groupId: editingConfig.groupId,
      };
      console.log('[AIConfigManager] Saving config:', configToSave);
      onSave(configToSave);
      setIsEditing(false);
      setEditingConfig(null);
    } else {
      alert(`保存失败：请填写配置名称和 API Key\n当前名称: ${editingConfig?.name || '空'}\n当前 API Key: ${editingConfig?.apiKey ? '已填写' : '空'}`);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingConfig(null);
    setTestResult(null);
  };

  const handleTest = async () => {
    if (!editingConfig) return;
    
    setIsTesting(true);
    setTestResult(null);
    
    try {
      const configId = editingConfig.id;
      const isNewConfig = !configs.find(c => c.id === configId);
      
      if (isNewConfig) {
        const providerInfo = providers[editingConfig.provider];
        const configToSave = {
          ...editingConfig,
          model: editingConfig.model || providerInfo?.defaultModel || '',
          baseUrl: editingConfig.baseUrl || providerInfo?.defaultBaseUrl || '',
        };
        await window.electronAPI?.ai?.saveConfig?.(configToSave);
        await window.electronAPI?.ai?.getConfigs?.();
      }
      
      const result = await window.electronAPI?.ai?.testConnection?.(configId);
      setTestResult(result || { success: false, message: 'Test failed' });
    } catch (error: any) {
      setTestResult({ success: false, message: error.message || 'Test failed' });
    } finally {
      setIsTesting(false);
    }
  };

  // 使用 useMemo 确保模型列表实时更新
  const currentProviderModels = useMemo(() => {
    if (!editingConfig) return [];
    return providers[editingConfig.provider]?.models || [];
  }, [providers, editingConfig?.provider]);

  if (isEditing && editingConfig) {
    return (
      <div className="space-y-4">
        <h4 className="font-medium">
          {configs.find(c => c.id === editingConfig.id) ? '编辑配置' : '添加配置'}
        </h4>
        
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1">配置名称</label>
            <Input
              value={editingConfig.name}
              onChange={(e) =>
                setEditingConfig({ ...editingConfig, name: e.target.value })
              }
              placeholder="例如：我的 OpenAI 配置"
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">提供商</label>
            <select
              value={editingConfig.provider}
              onChange={(e) =>
                setEditingConfig({
                  ...editingConfig,
                  provider: e.target.value,
                  model: providers[e.target.value]?.defaultModel || '',
                  baseUrl: '',
                })
              }
              className="w-full h-9 px-3 rounded-md border border-input bg-background"
            >
              {Object.entries(providers).map(([key, provider]) => (
                <option key={key} value={key}>
                  {provider.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">API Key</label>
            <Input
              type="password"
              value={editingConfig.apiKey}
              onChange={(e) =>
                setEditingConfig({ ...editingConfig, apiKey: e.target.value })
              }
              placeholder="输入 API Key"
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">模型</label>
            <select
              value={editingConfig.model}
              onChange={(e) =>
                setEditingConfig({ ...editingConfig, model: e.target.value })
              }
              className="w-full h-9 px-3 rounded-md border border-input bg-background"
            >
              <option value="">选择模型</option>
              {currentProviderModels.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
            {Object.keys(providers).length === 0 && (
              <p className="text-xs text-red-500 mt-1">正在加载模型列表...</p>
            )}
            {Object.keys(providers).length > 0 && currentProviderModels.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                该提供商暂无预设模型，请直接输入模型名称
              </p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">自定义 Base URL（可选）</label>
            <Input
              value={editingConfig.baseUrl}
              onChange={(e) =>
                setEditingConfig({ ...editingConfig, baseUrl: e.target.value })
              }
              placeholder={providers[editingConfig.provider]?.defaultBaseUrl}
            />
          </div>

          {editingConfig.provider === 'minimax' && (
            <div>
              <label className="text-sm font-medium block mb-1">Group ID（MiniMax 必需）</label>
              <Input
                value={editingConfig.groupId || ''}
                onChange={(e) =>
                  setEditingConfig({ ...editingConfig, groupId: e.target.value })
                }
                placeholder="输入 MiniMax Group ID"
              />
              <p className="text-xs text-muted-foreground mt-1">
                MiniMax 需要提供 Group ID 才能正常调用 API
              </p>
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isDefault"
              checked={editingConfig.isDefault}
              onChange={(e) =>
                setEditingConfig({ ...editingConfig, isDefault: e.target.checked })
              }
              className="rounded border-gray-300"
            />
            <label htmlFor="isDefault" className="text-sm cursor-pointer">
              设为默认配置
            </label>
          </div>

          <div className="border-t pt-4 mt-4">
            <h5 className="text-sm font-medium mb-3">高级设置</h5>

            <div className="mb-3">
              <label className="text-sm font-medium block mb-1">API 格式</label>
              <select
                value={editingConfig.apiFormat || 'openai'}
                onChange={(e) =>
                  setEditingConfig({ ...editingConfig, apiFormat: e.target.value as 'openai' | 'anthropic' })
                }
                className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="openai">OpenAI 格式</option>
                <option value="anthropic">Anthropic 格式</option>
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                选择模型支持的 API 格式，Anthropic 格式适用于 MiniMax M2.5 等模型
              </p>
            </div>

            <div className="flex items-center gap-2 mb-3">
              <input
                type="checkbox"
                id="supportsFunctionCall"
                checked={editingConfig.supportsFunctionCall ?? false}
                onChange={(e) =>
                  setEditingConfig({ ...editingConfig, supportsFunctionCall: e.target.checked })
                }
                className="rounded border-gray-300"
              />
              <label htmlFor="supportsFunctionCall" className="text-sm cursor-pointer">
                支持 Function Call (工具调用)
              </label>
            </div>

            <div className="mb-3">
              <label className="text-sm font-medium block mb-1">上下文长度 (Context Length)</label>
              <Input
                type="number"
                value={editingConfig.contextLength || ''}
                onChange={(e) =>
                  setEditingConfig({ ...editingConfig, contextLength: parseInt(e.target.value) || undefined })
                }
                placeholder="例如：4000, 8000, 32000"
              />
              <p className="text-xs text-muted-foreground mt-1">
                留空则使用默认值，常用值：4000, 8000, 32000, 128000
              </p>
            </div>

            <div>
              <label className="text-sm font-medium block mb-1">最大生成 Token 数 (Max Tokens)</label>
              <Input
                type="number"
                value={editingConfig.maxTokens || ''}
                onChange={(e) =>
                  setEditingConfig({ ...editingConfig, maxTokens: parseInt(e.target.value) || undefined })
                }
                placeholder="例如：4000"
              />
              <p className="text-xs text-muted-foreground mt-1">
                留空则使用默认值 4000
              </p>
            </div>
          </div>

          {testResult && (
            <div
              className={`p-3 rounded text-sm ${
                testResult.success
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              {testResult.message}
            </div>
          )}

          <div className="flex justify-between pt-2">
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={isTesting || !editingConfig.apiKey}
              size="sm"
            >
              <TestTube className="w-4 h-4 mr-1" />
              {isTesting ? '测试中...' : '测试连接'}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCancel} size="sm">
                取消
              </Button>
              <Button
                onClick={handleSave}
                disabled={!editingConfig?.name || !editingConfig?.apiKey}
                size="sm"
              >
                保存
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">AI 配置</h3>
        <Button onClick={handleAdd} size="sm">
          <Plus className="w-4 h-4 mr-1" />
          添加配置
        </Button>
      </div>

      {configs.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground border rounded-lg">
          暂无 AI 配置，请点击"添加配置"按钮创建
        </div>
      ) : (
        <div className="space-y-2">
          {configs.map((config) => (
            <div
              key={config.id}
              className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                activeConfigId === config.id
                  ? 'border-primary bg-primary/5'
                  : 'hover:bg-muted/50'
              }`}
              onClick={() => onSetActive(config.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{config.name}</span>
                    {config.isDefault && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                        默认
                      </span>
                    )}
                    {activeConfigId === config.id && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                        当前使用
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {providers[config.provider]?.name || config.provider} · {config.model}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(config);
                    }}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(config.id);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
