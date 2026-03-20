/**
 * Agent 模式选择器
 * 对标 Trae 的智能体选择界面
 */

import React, { useState, useEffect } from 'react';
import { useUnifiedAgentStore } from '@/store/unifiedAgentStore';
import { useSettingsStore } from '@/store/settingsStore';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Bot,
  MessageCircle,
  Sparkles,
  Settings,
  Plus,
  Check,
  ChevronDown,
  Trash2,
  Edit3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AgentRuntimeMode, AgentConfig } from '../../../shared/agentTypes';
import { AIProviderConfig } from '../../../shared/types';

interface AgentModeSelectorProps {
  className?: string;
}

// 预设智能体配置
const PRESET_AGENTS = [
  {
    id: 'chat',
    name: '对话',
    mode: 'chat' as AgentRuntimeMode,
    description: '对话式AI助手',
    icon: MessageCircle,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
  {
    id: 'solo',
    name: 'SOLO',
    mode: 'solo' as AgentRuntimeMode,
    description: '全自动开发模式',
    icon: Sparkles,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    badge: 'Auto',
  },
];

export const AgentModeSelector: React.FC<AgentModeSelectorProps> = ({
  className,
}) => {
  const {
    configs,
    activeConfigId,
    setActiveConfig,
    createConfig,
    updateConfig,
    deleteConfig,
  } = useUnifiedAgentStore();

  const { aiConfigs, loadAIConfigs } = useSettingsStore();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingConfig, setEditingConfig] = useState<AgentConfig | null>(null);
  const [newConfigName, setNewConfigName] = useState('');
  const [newConfigMode, setNewConfigMode] = useState<AgentRuntimeMode>('chat');
  const [selectedAiConfigId, setSelectedAiConfigId] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const activeConfig = configs.find((c) => c.id === activeConfigId);

  // 获取当前选中的预设
  const activePreset = PRESET_AGENTS.find(p =>
    activeConfig?.runtimeMode === p.mode &&
    (activeConfig?.name?.toLowerCase().includes(p.name.toLowerCase()) ||
     (p.id === 'chat' && activeConfig?.runtimeMode === 'chat') ||
     (p.id === 'solo' && activeConfig?.runtimeMode === 'solo'))
  ) || PRESET_AGENTS[0];

  // 加载 AI 配置
  useEffect(() => {
    loadAIConfigs();
  }, []);

  // 当 aiConfigs 变化时，更新选中的 AI 配置
  useEffect(() => {
    if (aiConfigs && aiConfigs.length > 0 && !selectedAiConfigId) {
      setSelectedAiConfigId(aiConfigs[0].id);
    }
  }, [aiConfigs]);

  // 获取模式图标
  const getModeIcon = (mode: AgentRuntimeMode) => {
    switch (mode) {
      case 'chat':
        return <MessageCircle className="w-4 h-4" />;
      case 'agent':
        return <Bot className="w-4 h-4" />;
      case 'solo':
        return <Sparkles className="w-4 h-4" />;
      default:
        return <Bot className="w-4 h-4" />;
    }
  };

  // 获取模式标签
  const getModeLabel = (mode: AgentRuntimeMode) => {
    switch (mode) {
      case 'chat':
        return '对话模式';
      case 'agent':
        return 'Agent 模式';
      case 'solo':
        return 'SOLO 模式';
      default:
        return mode;
    }
  };

  // 获取模式描述
  const getModeDescription = (mode: AgentRuntimeMode) => {
    switch (mode) {
      case 'chat':
        return '简单的问答和代码生成';
      case 'agent':
        return 'Plan-Build-Review 循环';
      case 'solo':
        return '全流程自动化开发';
      default:
        return '';
    }
  };

  // 选择预设
  const handleSelectPreset = async (preset: typeof PRESET_AGENTS[0]) => {
    // 查找或创建对应配置 - 使用preset.name匹配（'对话'或'SOLO'）
    const existingConfig = configs.find(c =>
      c.runtimeMode === preset.mode &&
      c.name === preset.name
    );

    if (existingConfig) {
      setActiveConfig(existingConfig.id);
    } else {
      // 创建新配置
      const aiConfig = aiConfigs?.[0];
      if (aiConfig) {
        const newConfig = await createConfig(preset.mode, aiConfig, preset.name);
        // 创建后自动设置为活跃配置
        if (newConfig) {
          setActiveConfig(newConfig.id);
        }
      }
    }
    setIsOpen(false);
  };

  // 创建新配置
  const handleCreateConfig = async () => {
    if (!newConfigName.trim() || !selectedAiConfigId) return;

    const aiConfig = aiConfigs?.find((c) => c.id === selectedAiConfigId);
    if (!aiConfig) return;

    await createConfig(newConfigMode, aiConfig, newConfigName.trim());
    setShowCreateDialog(false);
    setNewConfigName('');
  };

  // 删除配置
  const handleDeleteConfig = async (configId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('确定要删除这个配置吗？')) {
      await deleteConfig(configId);
    }
  };

  // 编辑配置
  const handleEditConfig = (config: AgentConfig, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingConfig(config);
    setNewConfigName(config.name || '');
    setNewConfigMode(config.runtimeMode || 'chat');
    setSelectedAiConfigId(config.aiConfigId || '');
    setShowEditDialog(true);
  };

  // 保存编辑后的配置
  const handleSaveEditConfig = async () => {
    if (!editingConfig || !newConfigName.trim() || !selectedAiConfigId) return;

    await updateConfig(editingConfig.id, {
      name: newConfigName.trim(),
      runtimeMode: newConfigMode,
      aiConfigId: selectedAiConfigId,
    });
    setShowEditDialog(false);
    setEditingConfig(null);
    setNewConfigName('');
    setNewConfigMode('chat');
    setSelectedAiConfigId('');
  };

  const ActiveIcon = activePreset.icon;

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'h-8 gap-2 px-3 font-normal rounded-lg transition-all',
              'hover:bg-accent',
              activePreset?.color,
              className
            )}
          >
            <div className={cn(
              'w-6 h-6 rounded-md flex items-center justify-center',
              activePreset?.bgColor
            )}>
              <ActiveIcon className="w-3.5 h-3.5" />
            </div>
            <span className="font-medium">{activePreset?.name || '选择模式'}</span>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent 
          align="end" 
          className="w-72 p-2"
          sideOffset={8}
        >
          {/* 内置智能体 */}
          <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground px-2 py-1.5">
            内置智能体
          </DropdownMenuLabel>
          <DropdownMenuGroup className="space-y-0.5">
            {PRESET_AGENTS.map((preset) => {
              const Icon = preset.icon;
              const isActive = activePreset?.id === preset.id;
              
              return (
                <DropdownMenuItem
                  key={preset.id}
                  className={cn(
                    'flex items-center gap-3 px-2 py-2.5 rounded-md cursor-pointer',
                    'hover:bg-accent transition-colors',
                    isActive && 'bg-accent'
                  )}
                  onClick={() => handleSelectPreset(preset)}
                >
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                    preset.bgColor
                  )}>
                    <Icon className={cn('w-4 h-4', preset.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{preset.name}</span>
                      {preset.badge && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                          {preset.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {preset.description}
                    </p>
                  </div>
                  {isActive && (
                    <Check className="w-4 h-4 text-primary flex-shrink-0" />
                  )}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>

          <DropdownMenuSeparator className="my-2" />

          {/* 自定义配置 */}
          {configs.length > 0 && (
            <>
              <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground px-2 py-1.5">
                自定义配置
              </DropdownMenuLabel>
              <DropdownMenuGroup className="space-y-0.5">
                {configs.map((config) => (
                  <DropdownMenuItem
                    key={config.id}
                    className={cn(
                      'flex items-center gap-3 px-2 py-2 rounded-md cursor-pointer group',
                      'hover:bg-accent transition-colors',
                      activeConfigId === config.id && 'bg-accent'
                    )}
                    onClick={() => {
                      setActiveConfig(config.id);
                      setIsOpen(false);
                    }}
                  >
                    <div className={cn(
                      'w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0',
                      config.runtimeMode === 'chat' && 'bg-blue-500/10 text-blue-500',
                      config.runtimeMode === 'agent' && 'bg-purple-500/10 text-purple-500',
                      config.runtimeMode === 'solo' && 'bg-amber-500/10 text-amber-500',
                    )}>
                      {getModeIcon(config.runtimeMode)}
                    </div>
                    <span className="flex-1 text-sm truncate">{config.name}</span>
                    {activeConfigId === config.id ? (
                      <Check className="w-4 h-4 text-primary flex-shrink-0" />
                    ) : (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => handleEditConfig(config, e)}
                          className="p-1 hover:bg-background rounded"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                        {!config.isDefault && (
                          <button
                            onClick={(e) => handleDeleteConfig(config.id, e)}
                            className="p-1 hover:bg-background rounded text-destructive"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
              <DropdownMenuSeparator className="my-2" />
            </>
          )}

          {/* 操作按钮 */}
          <DropdownMenuGroup className="space-y-0.5">
            <DropdownMenuItem 
              className="flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer hover:bg-accent"
              onClick={() => {
                setShowCreateDialog(true);
                setIsOpen(false);
              }}
            >
              <div className="w-7 h-7 rounded-md flex items-center justify-center bg-muted">
                <Plus className="w-3.5 h-3.5" />
              </div>
              <span className="text-sm">创建智能体</span>
            </DropdownMenuItem>
            
            <DropdownMenuItem 
              className="flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer hover:bg-accent"
              onClick={() => setIsOpen(false)}
            >
              <div className="w-7 h-7 rounded-md flex items-center justify-center bg-muted">
                <Settings className="w-3.5 h-3.5" />
              </div>
              <span className="text-sm">管理智能体</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 创建配置对话框 */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>创建智能体</DialogTitle>
            <DialogDescription>
              配置一个新的AI智能体，选择运行模式和模型
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">智能体名称</Label>
              <Input
                id="name"
                placeholder="例如：我的代码助手"
                value={newConfigName}
                onChange={(e) => setNewConfigName(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label>运行模式</Label>
              <div className="grid grid-cols-3 gap-2">
                {(['chat', 'agent', 'solo'] as AgentRuntimeMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setNewConfigMode(mode)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all',
                      newConfigMode === mode
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-accent'
                    )}
                  >
                    {getModeIcon(mode)}
                    <span className="text-xs font-medium">{getModeLabel(mode)}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {getModeDescription(newConfigMode)}
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="ai-config">AI 模型</Label>
              <Select value={selectedAiConfigId} onValueChange={setSelectedAiConfigId}>
                <SelectTrigger id="ai-config">
                  <SelectValue placeholder="选择 AI 配置" />
                </SelectTrigger>
                <SelectContent>
                  {aiConfigs?.map((config) => (
                    <SelectItem key={config.id} value={config.id}>
                      {config.name} ({config.model})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              取消
            </Button>
            <Button
              onClick={handleCreateConfig}
              disabled={!newConfigName.trim() || !selectedAiConfigId}
            >
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑配置对话框 */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>编辑智能体</DialogTitle>
            <DialogDescription>
              修改智能体的名称、运行模式和模型
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">智能体名称</Label>
              <Input
                id="edit-name"
                placeholder="例如：我的代码助手"
                value={newConfigName}
                onChange={(e) => setNewConfigName(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label>运行模式</Label>
              <div className="grid grid-cols-3 gap-2">
                {(['chat', 'agent', 'solo'] as AgentRuntimeMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setNewConfigMode(mode)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all',
                      newConfigMode === mode
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-accent'
                    )}
                  >
                    {getModeIcon(mode)}
                    <span className="text-xs font-medium">{getModeLabel(mode)}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {getModeDescription(newConfigMode)}
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-ai-config">AI 模型</Label>
              <Select value={selectedAiConfigId} onValueChange={setSelectedAiConfigId}>
                <SelectTrigger id="edit-ai-config">
                  <SelectValue placeholder="选择 AI 配置" />
                </SelectTrigger>
                <SelectContent>
                  {aiConfigs?.map((config) => (
                    <SelectItem key={config.id} value={config.id}>
                      {config.name} ({config.model})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              取消
            </Button>
            <Button
              onClick={handleSaveEditConfig}
              disabled={!newConfigName.trim() || !selectedAiConfigId}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AgentModeSelector;
