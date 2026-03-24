import React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Bot, Code2, Zap, Settings, Check, Sparkles } from 'lucide-react';
import { useUnifiedAgentStore } from '@/store/unifiedAgentStore';
import { AgentType } from '../../../shared/types';

const AGENT_ICONS = {
  chat: Bot,
  builder: Code2,
  solocoder: Zap,
} as const;

const AGENT_COLORS = {
  chat: {
    bg: 'bg-gradient-to-br from-blue-500 to-blue-600',
    text: 'text-blue-500',
    border: 'border-blue-500/20',
  },
  builder: {
    bg: 'bg-gradient-to-br from-purple-500 to-purple-600',
    text: 'text-purple-500',
    border: 'border-purple-500/20',
  },
  solocoder: {
    bg: 'bg-gradient-to-br from-green-500 to-emerald-600',
    text: 'text-green-500',
    border: 'border-green-500/20',
  },
} as const;

const BUILT_IN_TYPES: AgentType[] = ['chat', 'solocoder'];

export function AgentSelector() {
  const configs = useUnifiedAgentStore((state) => state.configs || []);
  const activeConfigId = useUnifiedAgentStore((state) => state.activeConfigId);
  const setActiveConfig = useUnifiedAgentStore((state) => state.setActiveConfig);

  const activeConfig = configs.find((c) => c.id === activeConfigId);
  const builtInConfigs = configs.filter((c) => BUILT_IN_TYPES.includes(c.type as AgentType));
  const customConfigs = configs.filter((c) => !BUILT_IN_TYPES.includes(c.type as AgentType));

  const activeIcon = activeConfig ? (AGENT_ICONS[activeConfig.type as AgentType] || Bot) : Bot;
  const activeColor = activeConfig ? (AGENT_COLORS[activeConfig.type as AgentType]?.bg || 'bg-gray-500') : 'bg-gray-500';

  const handleSelectAgent = (id: string) => {
    if (setActiveConfig) {
      setActiveConfig(id);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="gap-2 hover:bg-accent/50 transition-colors"
        >
          <div className={`${activeColor} p-1.5 rounded-lg shadow-sm`}>
            {React.createElement(activeIcon, { className: 'w-3.5 h-3.5 text-white' })}
          </div>
          <span className="text-sm">{activeConfig ? activeConfig.name : '选择智能体'}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        {builtInConfigs.length > 0 && (
          <>
            <div className="px-4 py-2.5 text-xs text-muted-foreground font-semibold flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" />
              内置智能体
            </div>
            {builtInConfigs.map((agent) => {
              const Icon = AGENT_ICONS[agent.type as AgentType] || Bot;
              const Color = AGENT_COLORS[agent.type as AgentType] || AGENT_COLORS.chat;
              const isActive = agent.id === activeConfigId;

              return (
                <DropdownMenuItem
                  key={agent.id}
                  onClick={() => handleSelectAgent(agent.id)}
                  className={`flex items-center gap-3 p-3 cursor-pointer rounded-lg mx-2 my-1 transition-all hover:bg-accent/50 ${isActive ? 'bg-accent/30' : ''}`}
                >
                  <div className={`${Color.bg} p-2.5 rounded-lg shadow-sm flex-shrink-0`}>
                    {React.createElement(Icon, { className: 'w-4 h-4 text-white' })}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{agent.name}</div>
                    <div className="text-xs text-muted-foreground/80 line-clamp-2 mt-0.5">
                      {agent.description}
                    </div>
                  </div>
                  {isActive && (
                    <div className={`${Color.bg} p-1 rounded-full flex-shrink-0`}>
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </DropdownMenuItem>
              );
            })}
          </>
        )}

        {customConfigs.length > 0 && (
          <>
            <DropdownMenuSeparator className="my-2" />
            <div className="px-4 py-2.5 text-xs text-muted-foreground font-semibold flex items-center gap-1.5">
              <Bot className="w-3 h-3" />
              自定义智能体 ({customConfigs.length})
            </div>
            {customConfigs.map((agent) => {
              const isActive = agent.id === activeConfigId;

              return (
                <DropdownMenuItem
                  key={agent.id}
                  onClick={() => handleSelectAgent(agent.id)}
                  className={`flex items-center gap-3 p-3 cursor-pointer rounded-lg mx-2 my-1 transition-all hover:bg-accent/50 ${isActive ? 'bg-accent/30' : ''}`}
                >
                  <div className="bg-gradient-to-br from-gray-500 to-gray-600 p-2.5 rounded-lg shadow-sm flex-shrink-0">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{agent.name}</div>
                    <div className="text-xs text-muted-foreground/80 line-clamp-2 mt-0.5">
                      {agent.description || '自定义智能体'}
                    </div>
                  </div>
                  {isActive && (
                    <div className="bg-gradient-to-br from-gray-500 to-gray-600 p-1 rounded-full flex-shrink-0">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </DropdownMenuItem>
              );
            })}
          </>
        )}

        <DropdownMenuSeparator className="my-2" />
        <DropdownMenuItem className="p-3 cursor-pointer rounded-lg mx-2 my-1 hover:bg-accent/50 transition-colors">
          <Settings className="w-4 h-4 mr-3 text-muted-foreground" />
          <span className="text-sm">管理智能体</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
