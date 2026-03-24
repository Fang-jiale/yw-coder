import { useState, useEffect } from 'react';
import { AgentConfig, AgentType, BUILT_IN_AGENTS } from '../../../shared/types';
import { useUnifiedAgentStore } from '@/store/unifiedAgentStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { 
  Settings, 
  Bot, 
  Copy, 
  Trash2, 
  Check, 
  X, 
  Plus,
  Sparkles,
  Code2,
  Zap,
  Loader2,
  Info,
} from 'lucide-react';

interface AgentManagerProps {
  onClose?: () => void;
}

const AGENT_ICONS: Record<AgentType, any> = {
  chat: Bot,
  builder: Code2,
  solocoder: Zap,
};

const AGENT_COLORS: Record<AgentType, string> = {
  chat: 'bg-gradient-to-br from-blue-500 to-blue-600',
  builder: 'bg-gradient-to-br from-purple-500 to-purple-600',
  solocoder: 'bg-gradient-to-br from-green-500 to-emerald-600',
};

const AGENT_TEXT_COLORS: Record<AgentType, string> = {
  chat: 'text-blue-500',
  builder: 'text-purple-500',
  solocoder: 'text-green-500',
};

export function AgentManager({ onClose }: AgentManagerProps) {
  const { 
    configs, 
    activeConfigId, 
    loadConfigs, 
    setActiveConfig,
    updateConfig,
    deleteConfig,
  } = useUnifiedAgentStore();

  const [selectedAgent, setSelectedAgent] = useState<AgentConfig | null>(null);
  const [editingConfig, setEditingConfig] = useState<Partial<AgentConfig> | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  useEffect(() => {
    if (configs.length > 0 && !selectedAgent) {
      const active = configs.find(c => c.id === activeConfigId);
      setSelectedAgent(active || configs[0]);
    }
  }, [configs, activeConfigId, selectedAgent]);

  const handleSelectAgent = (agent: AgentConfig) => {
    setSelectedAgent(agent);
    setIsEditing(false);
    setEditingConfig(null);
  };

  const handleEditAgent = () => {
    if (selectedAgent) {
      setEditingConfig({ ...selectedAgent });
      setIsEditing(true);
    }
  };

  const handleSaveEdit = async () => {
    if (editingConfig && selectedAgent) {
      await updateConfig(selectedAgent.id, editingConfig);
      setIsEditing(false);
      setEditingConfig(null);
      const updated = configs.find(c => c.id === selectedAgent.id);
      if (updated) {
        setSelectedAgent(updated);
      }
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingConfig(null);
  };

  const handleCloneAgent = async () => {
    if (selectedAgent) {
      const clonedConfig: Partial<AgentConfig> = {
        ...selectedAgent,
        id: `agent-${Date.now()}`,
        name: `${selectedAgent.name} (副本)`,
        isBuiltIn: false,
      };
      await updateConfig(selectedAgent.id, clonedConfig);
      loadConfigs();
    }
  };

  const handleDeleteAgent = async () => {
    if (selectedAgent && !selectedAgent.isBuiltIn) {
      await deleteConfig(selectedAgent.id);
      const remaining = configs.filter(c => c.id !== selectedAgent.id);
      if (remaining.length > 0) {
        setSelectedAgent(remaining[0]);
      }
    }
  };

  const handleAgentSwitch = async (agent: AgentConfig) => {
    await setActiveConfig(agent.id);
  };

  return (
    <div className="flex h-full">
      {/* Agent List */}
      <div className="w-80 border-r flex flex-col bg-gradient-to-b from-background to-muted/10">
        <div className="p-4 border-b bg-background/50 backdrop-blur">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            智能体管理
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            选择和配置你的 AI 智能体
          </p>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-3 space-y-1">
            {configs.map((agent) => {
              const Icon = AGENT_ICONS[agent.type];
              const isActive = agent.id === activeConfigId;
              const isSelected = selectedAgent?.id === agent.id;
              
              return (
                <div
                  key={agent.id}
                  className={`group flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                    isActive 
                      ? 'bg-primary/10 border border-primary/20 shadow-sm' 
                      : 'hover:bg-accent/50 border border-transparent'
                  } ${isSelected ? 'ring-2 ring-primary/50' : ''}`}
                  onClick={() => handleSelectAgent(agent)}
                >
                  <div className={`${AGENT_COLORS[agent.type]} p-2 rounded-lg shadow-sm flex-shrink-0 group-hover:scale-105 transition-transform`}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{agent.name}</div>
                    <div className="text-xs text-muted-foreground/80 truncate mt-0.5">
                      {BUILT_IN_AGENTS[agent.type]?.description || agent.description}
                    </div>
                  </div>
                  {agent.isBuiltIn && (
                    <Badge variant="outline" className="text-xs px-1.5 py-0.5 border-primary/30 text-primary">
                      内置
                    </Badge>
                  )}
                  {isActive && (
                    <div className="bg-primary/20 p-1 rounded-full">
                      <Check className="w-3 h-3 text-primary" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <div className="p-4 border-t bg-background/50 backdrop-blur">
          <Button 
            variant="outline" 
            className="w-full hover:bg-primary/10 hover:border-primary/30 transition-all"
            onClick={handleCloneAgent}
            disabled={!selectedAgent || selectedAgent.isBuiltIn}
          >
            <Plus className="w-4 h-4 mr-2" />
            复制智能体
          </Button>
        </div>
      </div>

      {/* Agent Configuration */}
      <div className="flex-1 flex flex-col bg-gradient-to-br from-background via-background to-muted/5">
        {selectedAgent ? (
          <>
            <div className="p-6 border-b bg-background/50 backdrop-blur-sm flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`${AGENT_COLORS[selectedAgent.type]} p-3 rounded-xl shadow-lg`}>
                  {React.createElement(AGENT_ICONS[selectedAgent.type], { className: 'w-6 h-6 text-white' })}
                </div>
                <div>
                  <h3 className="text-xl font-semibold flex items-center gap-2">
                    {selectedAgent.name}
                    {selectedAgent.isBuiltIn && (
                      <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                        内置
                      </Badge>
                    )}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedAgent.isBuiltIn ? '内置智能体' : '自定义智能体'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isEditing ? (
                  <>
                    <Button 
                      variant="outline" 
                      onClick={handleCancelEdit}
                      className="hover:bg-destructive/10 hover:text-destructive"
                    >
                      <X className="w-4 h-4 mr-2" />
                      取消
                    </Button>
                    <Button 
                      onClick={handleSaveEdit}
                      className="bg-gradient-to-r from-primary to-primary/80"
                    >
                      <Check className="w-4 h-4 mr-2" />
                      保存
                    </Button>
                  </>
                ) : (
                  <>
                    {selectedAgent.id !== activeConfigId && (
                      <Button 
                        onClick={() => handleAgentSwitch(selectedAgent)}
                        className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
                      >
                        <Check className="w-4 h-4 mr-2" />
                        使用此智能体
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      onClick={handleEditAgent}
                      className="hover:bg-accent"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      配置
                    </Button>
                    {!selectedAgent.isBuiltIn && (
                      <Button 
                        variant="destructive" 
                        size="icon"
                        onClick={handleDeleteAgent}
                        className="hover:bg-destructive/90"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-6">
                {isEditing && editingConfig ? (
                  <AgentConfigForm
                    agent={editingConfig as AgentConfig}
                    onChange={setEditingConfig}
                  />
                ) : (
                  <AgentConfigView agent={selectedAgent} />
                )}
              </div>
            </ScrollArea>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            选择一个智能体以查看配置
          </div>
        )}
      </div>
    </div>
  );
}

function AgentConfigView({ agent }: { agent: AgentConfig }) {
  return (
    <div className="space-y-6">
      <Card className="border-l-4 border-l-primary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            基本信息
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-2 border-b">
            <div className="flex items-center gap-2">
              <Label className="text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                类型
              </Label>
            </div>
            <Badge variant="outline" className={AGENT_TEXT_COLORS[agent.type]}>
              {BUILT_IN_AGENTS[agent.type]?.name || agent.type}
            </Badge>
          </div>
          <div className="py-2 border-b">
            <Label className="text-muted-foreground flex items-center gap-1.5 mb-2">
              <Info className="w-3.5 h-3.5" />
              描述
            </Label>
            <p className="text-sm mt-1 text-foreground/80">{agent.description}</p>
          </div>
          <div className="py-2">
            <Label className="text-muted-foreground flex items-center gap-1.5 mb-2">
              <Code2 className="w-3.5 h-3.5" />
              AI 配置
            </Label>
            <p className="text-sm font-medium mt-1 flex items-center gap-2">
              <span className="px-2 py-1 bg-primary/10 rounded text-primary text-xs">
                {agent.aiConfig.name}
              </span>
              <span className="text-muted-foreground">
                via {agent.aiConfig.provider}
              </span>
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-purple-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-purple-500" />
            行为配置
          </CardTitle>
          <CardDescription>控制智能体的行为方式</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-border/50">
            <div>
              <p className="font-medium text-sm">自动执行工具</p>
              <p className="text-xs text-muted-foreground">自动执行工具调用，无需确认</p>
            </div>
            <Switch checked={agent.behavior.autoExecuteTools} disabled />
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border/50">
            <div>
              <p className="font-medium text-sm">执行前确认</p>
              <p className="text-xs text-muted-foreground">在执行操作前请求用户确认</p>
            </div>
            <Switch checked={agent.behavior.askBeforeExecute} disabled />
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border/50">
            <div>
              <p className="font-medium text-sm">自动修复错误</p>
              <p className="text-xs text-muted-foreground">遇到错误时自动尝试修复</p>
            </div>
            <Switch checked={agent.behavior.autoFixErrors} disabled />
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border/50">
            <div>
              <p className="font-medium text-sm">显示思考过程</p>
              <p className="text-xs text-muted-foreground">在回复中显示思考过程</p>
            </div>
            <Switch checked={agent.behavior.showThinking} disabled />
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border/50">
            <div>
              <p className="font-medium text-sm">启用待办事项</p>
              <p className="text-xs text-muted-foreground">跟踪和管理任务列表</p>
            </div>
            <Switch checked={agent.behavior.enableTodoList} disabled />
          </div>
          <div className="py-2">
            <p className="font-medium text-sm">最大自动重试次数</p>
            <p className="text-xs text-muted-foreground mt-1">
              <Badge variant="secondary">{agent.behavior.maxAutoRetries} 次</Badge>
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-green-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-green-500" />
            能力配置
          </CardTitle>
          <CardDescription>控制智能体可以执行的操作</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-border/50">
            <p className="font-medium text-sm">文件编辑</p>
            <Switch checked={agent.capabilities.canEditFiles} disabled />
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border/50">
            <p className="font-medium text-sm">执行命令</p>
            <Switch checked={agent.capabilities.canExecuteCommands} disabled />
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border/50">
            <p className="font-medium text-sm">代码重构</p>
            <Switch checked={agent.capabilities.canRefactorCode} disabled />
          </div>
          <div className="py-2 border-b border-border/50">
            <p className="font-medium text-sm mb-1">最大上下文消息数</p>
            <Badge variant="secondary">{agent.capabilities.maxContextMessages} 条</Badge>
          </div>
          <div className="py-2">
            <p className="font-medium text-sm mb-3">启用的工具</p>
            <div className="flex flex-wrap gap-2">
              {agent.capabilities.enabledTools.map((tool) => (
                <Badge key={tool} variant="secondary" className="text-xs px-2.5 py-1">
                  {tool}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-amber-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            系统提示
          </CardTitle>
          <CardDescription>定义智能体的角色和行为</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={agent.systemPrompt}
            readOnly
            className="min-h-[250px] font-mono text-sm bg-muted/30"
          />
        </CardContent>
      </Card>
    </div>
  );
}

function AgentConfigForm({
  agent,
  onChange,
}: {
  agent: Partial<AgentConfig>;
  onChange: (config: Partial<AgentConfig>) => void;
}) {
  const updateBehavior = (key: string, value: unknown) => {
    const currentBehavior = (agent.behavior || {}) as Record<string, unknown>;
    onChange({
      ...agent,
      behavior: {
        ...currentBehavior,
        [key]: value,
      } as unknown as AgentConfig['behavior'],
    });
  };

  const updateCapabilities = (key: string, value: unknown) => {
    const currentCapabilities = (agent.capabilities || {}) as Record<string, unknown>;
    onChange({
      ...agent,
      capabilities: {
        ...currentCapabilities,
        [key]: value,
      } as unknown as AgentConfig['capabilities'],
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>基本信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="name">名称</Label>
            <Input
              id="name"
              value={agent.name || ''}
              onChange={(e) => onChange({ ...agent, name: e.target.value })}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="description">描述</Label>
            <Input
              id="description"
              value={agent.description || ''}
              onChange={(e) => onChange({ ...agent, description: e.target.value })}
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>行为配置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">自动执行工具</p>
              <p className="text-sm text-muted-foreground">自动执行工具调用，无需确认</p>
            </div>
            <Switch
              checked={agent.behavior?.autoExecuteTools || false}
              onCheckedChange={(checked) => updateBehavior('autoExecuteTools', checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">执行前确认</p>
              <p className="text-sm text-muted-foreground">在执行操作前请求用户确认</p>
            </div>
            <Switch
              checked={agent.behavior?.askBeforeExecute ?? true}
              onCheckedChange={(checked) => updateBehavior('askBeforeExecute', checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">自动修复错误</p>
              <p className="text-sm text-muted-foreground">遇到错误时自动尝试修复</p>
            </div>
            <Switch
              checked={agent.behavior?.autoFixErrors || false}
              onCheckedChange={(checked) => updateBehavior('autoFixErrors', checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">显示思考过程</p>
              <p className="text-sm text-muted-foreground">在回复中显示思考过程</p>
            </div>
            <Switch
              checked={agent.behavior?.showThinking ?? true}
              onCheckedChange={(checked) => updateBehavior('showThinking', checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">启用待办事项</p>
              <p className="text-sm text-muted-foreground">跟踪和管理任务列表</p>
            </div>
            <Switch
              checked={agent.behavior?.enableTodoList ?? true}
              onCheckedChange={(checked) => updateBehavior('enableTodoList', checked)}
            />
          </div>
          <div>
            <p className="font-medium mb-2">最大自动重试次数</p>
            <Slider
              value={[agent.behavior?.maxAutoRetries || 0]}
              onValueChange={([value]) => updateBehavior('maxAutoRetries', value)}
              min={0}
              max={10}
              step={1}
            />
            <p className="text-sm text-muted-foreground mt-1">
              {agent.behavior?.maxAutoRetries || 0} 次
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>能力配置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-medium">文件编辑</p>
            <Switch
              checked={agent.capabilities?.canEditFiles ?? true}
              onCheckedChange={(checked) => updateCapabilities('canEditFiles', checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <p className="font-medium">执行命令</p>
            <Switch
              checked={agent.capabilities?.canExecuteCommands ?? true}
              onCheckedChange={(checked) => updateCapabilities('canExecuteCommands', checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <p className="font-medium">代码重构</p>
            <Switch
              checked={agent.capabilities?.canRefactorCode ?? true}
              onCheckedChange={(checked) => updateCapabilities('canRefactorCode', checked)}
            />
          </div>
          <div>
            <p className="font-medium mb-2">最大上下文消息数</p>
            <Slider
              value={[agent.capabilities?.maxContextMessages || 20]}
              onValueChange={([value]) => updateCapabilities('maxContextMessages', value)}
              min={5}
              max={50}
              step={5}
            />
            <p className="text-sm text-muted-foreground mt-1">
              {agent.capabilities?.maxContextMessages || 20} 条
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>系统提示</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={agent.systemPrompt || ''}
            onChange={(e) => onChange({ ...agent, systemPrompt: e.target.value })}
            className="min-h-[200px] font-mono text-sm"
          />
        </CardContent>
      </Card>
    </div>
  );
}
