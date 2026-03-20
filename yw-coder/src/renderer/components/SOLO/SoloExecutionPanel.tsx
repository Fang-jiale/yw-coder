/**
 * SOLO 模式执行面板 (动态计划版)
 * 支持 AI 动态生成的执行计划，滚动时置顶
 */

import React, { useState, useEffect, useRef } from 'react';
import { useUnifiedAgentStore } from '../../store/unifiedAgentStore';
import type { ExecutionPlanStep } from '../../store/unifiedAgentStore';
import { CheckCircle, Circle, Loader2, ChevronDown, ChevronRight, Lightbulb, List } from 'lucide-react';

interface SoloExecutionPanelProps {
  taskId: string;
}

// 步骤类型配置
const STEP_TYPE_CONFIG: Record<ExecutionPlanStep['type'], { label: string; color: string; bgColor: string }> = {
  analysis: { label: '分析', color: 'text-blue-600', bgColor: 'bg-blue-50' },
  planning: { label: '规划', color: 'text-purple-600', bgColor: 'bg-purple-50' },
  coding: { label: '编码', color: 'text-green-600', bgColor: 'bg-green-50' },
  testing: { label: '测试', color: 'text-orange-600', bgColor: 'bg-orange-50' },
  review: { label: '审查', color: 'text-yellow-600', bgColor: 'bg-yellow-50' },
  documentation: { label: '文档', color: 'text-teal-600', bgColor: 'bg-teal-50' },
  custom: { label: '自定义', color: 'text-gray-600', bgColor: 'bg-gray-50' },
};

export const SoloExecutionPanel: React.FC<SoloExecutionPanelProps> = ({ taskId }) => {
  const {
    executionProgress,
    isProcessing,
    tasks,
  } = useUnifiedAgentStore();

  // 使用任务的 executionPlan，而不是全局的
  const task = tasks.find(t => t.id === taskId);
  const executionPlan = task?.executionPlan;

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [isSticky, setIsSticky] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const placeholderRef = useRef<HTMLDivElement>(null);
  const originalTopRef = useRef<number>(0);

  // 监听滚动，实现置顶效果
  useEffect(() => {
    const handleScroll = () => {
      if (!panelRef.current || !placeholderRef.current) return;

      const scrollContainer = panelRef.current.closest('.overflow-y-auto, [data-scroll-container]');
      if (!scrollContainer) return;

      const scrollTop = scrollContainer.scrollTop;
      const panelTop = originalTopRef.current;

      // 当滚动位置超过面板原始位置时，设置为置顶状态
      const shouldBeSticky = scrollTop > panelTop;
      if (isSticky !== shouldBeSticky) {
        setIsSticky(shouldBeSticky);
      }
    };

    // 使用 setTimeout 确保 DOM 已经渲染
    const timer = setTimeout(() => {
      const scrollContainer = panelRef.current?.closest('.overflow-y-auto, [data-scroll-container]');
      if (scrollContainer) {
        // 记录面板的原始位置
        const updateOriginalTop = () => {
          if (placeholderRef.current) {
            originalTopRef.current = placeholderRef.current.offsetTop;
            console.log('[SoloExecutionPanel] originalTop:', originalTopRef.current);
            // 更新后立即检查一次滚动位置
            handleScroll();
          }
        };
        
        updateOriginalTop();
        scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
        window.addEventListener('resize', updateOriginalTop);

        // 返回清理函数
        return () => {
          scrollContainer.removeEventListener('scroll', handleScroll);
          window.removeEventListener('resize', updateOriginalTop);
        };
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [isCollapsed, isSticky]); // 当折叠状态或悬浮状态变化时重新计算

  const toggleStep = (stepId: string) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  };

  // 如果没有执行计划，不显示面板
  if (!executionPlan) {
    return null;
  }

  const { steps, goal, reasoning, currentStepIndex } = executionPlan;
  const currentStep = steps[currentStepIndex];
  const completedCount = steps.filter(s => s.status === 'completed').length;

  const getStepStatus = (step: ExecutionPlanStep, index: number): 'completed' | 'active' | 'pending' | 'failed' => {
    if (step.status === 'completed') return 'completed';
    if (step.status === 'failed') return 'failed';
    if (index === currentStepIndex) return 'active';
    if (index < currentStepIndex) return 'completed';
    return 'pending';
  };

  // 计算面板高度（用于占位元素）
  const panelHeight = panelRef.current?.offsetHeight || (isCollapsed ? 56 : 300);

  return (
    <>
      {/* 占位元素，防止置顶时内容跳动 */}
      <div 
        ref={placeholderRef} 
        className="transition-all duration-200" 
        style={{ height: isSticky ? panelHeight : 0 }}
      />
      
      <div 
        ref={panelRef}
        className={`border rounded-lg bg-card mb-4 overflow-hidden transition-all duration-200 ${
          isSticky 
            ? 'sticky top-0 z-50 shadow-xl border-primary/30' 
            : 'relative'
        }`}
      >
        {/* 可折叠的头部 - 始终显示 */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full px-4 py-3 bg-muted/30 border-b flex items-center justify-between hover:bg-muted/40 transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* 折叠图标 */}
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            )}
            
            {/* 目标标题 */}
            <div className="text-sm font-medium truncate text-left" title={goal}>
              {goal}
            </div>
          </div>

          {/* 右侧信息 */}
          <div className="flex items-center gap-3 flex-shrink-0 ml-2">
            {/* 进度信息 */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="hidden sm:inline">
                {completedCount}/{steps.length}
              </span>
              <span className="font-medium text-foreground">{executionProgress}%</span>
            </div>

            {/* 当前步骤类型标签（折叠时显示） */}
            {isCollapsed && currentStep && (
              <span className={`text-xs px-1.5 py-0.5 rounded ${STEP_TYPE_CONFIG[currentStep.type].bgColor} ${STEP_TYPE_CONFIG[currentStep.type].color}`}>
                {isProcessing && <Loader2 className="w-3 h-3 animate-spin inline mr-1" />}
                {STEP_TYPE_CONFIG[currentStep.type].label}
              </span>
            )}

            {/* 步骤列表图标 */}
            <List className="w-4 h-4 text-muted-foreground" />
          </div>
        </button>

        {/* 可折叠内容 */}
        {!isCollapsed && (
          <>
            {/* 执行策略（如果有） */}
            {reasoning && (
              <div className="px-4 py-2 border-b bg-muted/10">
                <button
                  onClick={() => setShowReasoning(!showReasoning)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Lightbulb className="w-3 h-3" />
                  <span>执行策略</span>
                  {showReasoning ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>
                {showReasoning && (
                  <div className="mt-2 text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                    {reasoning}
                  </div>
                )}
              </div>
            )}

            {/* 进度概览 */}
            <div className="px-4 py-3 border-b">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {currentStep ? (
                    <>
                      <span className={`text-sm font-medium ${STEP_TYPE_CONFIG[currentStep.type].color}`}>
                        {isProcessing && <Loader2 className="w-4 h-4 animate-spin inline mr-1" />}
                        {currentStep.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({currentStepIndex + 1} / {steps.length})
                      </span>
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">等待开始...</span>
                  )}
                </div>
              </div>

              {/* 进度条 */}
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${executionProgress}%` }}
                />
              </div>
            </div>

            {/* 执行步骤列表 - 限制高度 */}
            <div className="max-h-48 overflow-y-auto">
              {steps.map((step, index) => {
                const status = getStepStatus(step, index);
                const typeConfig = STEP_TYPE_CONFIG[step.type];
                const isExpanded = expandedSteps.has(step.id);

                return (
                  <div
                    key={step.id}
                    className={`border-b last:border-b-0 ${
                      status === 'active' ? 'bg-primary/5' : ''
                    }`}
                  >
                    <button
                      onClick={() => toggleStep(step.id)}
                      className="w-full px-4 py-2 flex items-start gap-3 text-left hover:bg-muted/30 transition-colors"
                    >
                      {/* 状态图标 */}
                      <div className="mt-0.5 flex-shrink-0">
                        {status === 'completed' ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : status === 'active' ? (
                          <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        ) : status === 'failed' ? (
                          <Circle className="w-4 h-4 text-red-500" />
                        ) : (
                          <Circle className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>

                      {/* 步骤内容 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${typeConfig.bgColor} ${typeConfig.color}`}>
                            {typeConfig.label}
                          </span>
                          <span className={`text-sm font-medium ${
                            status === 'completed' ? 'text-muted-foreground line-through' : ''
                          }`}>
                            {step.name}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {step.description}
                        </p>
                      </div>

                      {/* 展开图标 */}
                      <div className="flex-shrink-0 mt-1">
                        {isExpanded ? (
                          <ChevronDown className="w-3 h-3 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-3 h-3 text-muted-foreground" />
                        )}
                      </div>
                    </button>

                    {/* 展开详情 */}
                    {isExpanded && (
                      <div className="px-4 pb-3 pl-11">
                        {step.reasoning && (
                          <div className="text-xs text-muted-foreground mb-2">
                            <span className="font-medium">执行理由：</span>
                            {step.reasoning}
                          </div>
                        )}
                        {step.estimatedTime && (
                          <div className="text-xs text-muted-foreground">
                            <span className="font-medium">预计时间：</span>
                            {Math.round(step.estimatedTime / 60)} 分钟
                          </div>
                        )}
                        {step.dependencies && step.dependencies.length > 0 && (
                          <div className="text-xs text-muted-foreground mt-1">
                            <span className="font-medium">依赖步骤：</span>
                            {step.dependencies.join(', ')}
                          </div>
                        )}
                        {step.result && (
                          <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
                            <span className="font-medium">执行结果：</span>
                            <pre className="mt-1 whitespace-pre-wrap">{JSON.stringify(step.result, null, 2)}</pre>
                          </div>
                        )}
                        {step.error && (
                          <div className="mt-2 p-2 bg-red-50 text-red-600 rounded text-xs">
                            <span className="font-medium">错误：</span>
                            {step.error}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default SoloExecutionPanel;
