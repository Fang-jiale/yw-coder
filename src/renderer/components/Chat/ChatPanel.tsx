import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useUnifiedAgentStore, setupUnifiedAgentEventListeners } from '@/store/unifiedAgentStore';
import { ResultCard, FileResultCard, CommandResultCard, EnvCheckResultCard } from './ResultCards/ResultCard';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useCodeEditorStore } from '@/store/codeEditorStore';
import { useSettingsStore } from '@/store/settingsStore';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  Copy,
  Check,
  Loader2,
  X,
  FileCode,
  Sparkles,
  ChevronDown,
  Brain,
  Zap,
  Search,
  Code2,
  MessageCircle,
  Pencil,
  Bug,
  Send,
  Terminal,
  CheckCircle2,
  AlertCircle,
  XCircle,
  HelpCircle,
  Bot,
  Command,
  ChevronRight,
  Rocket,
  Square,
  Trash2,
  Circle,
  ListTodo,
  AtSign,
  Hash,
  Image,
  Settings,
  FileEdit,
  Timer,
  RotateCcw,
  MoreHorizontal,
  Download,
} from 'lucide-react';
import { DiffViewer } from '../DiffViewer/DiffViewer';
import { SoloExecutionPanel } from '../SOLO/SoloExecutionPanel';
import { CodeEditOperation } from '../../../shared/aiCommands';
import { AgentRuntimeMode, AgentStep, TodoItem, AgentMessage } from '../../../shared/agentTypes';

interface SlashCommand {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
}

const SLASH_COMMANDS: SlashCommand[] = [
  { id: 'mode', name: '模式', description: '/act 或 /plan 切换模式', icon: <Zap className="w-4 h-4" /> },
  { id: 'find', name: '查找', description: '查找代码', icon: <Search className="w-4 h-4" /> },
  { id: 'edit', name: '编辑', description: '编辑文件', icon: <Pencil className="w-4 h-4" /> },
  { id: 'code', name: '代码', description: '生成代码', icon: <Code2 className="w-4 h-4" /> },
  { id: 'ask', name: '询问', description: '询问问题', icon: <MessageCircle className="w-4 h-4" /> },
  { id: 'fix', name: '修复', description: '修复问题', icon: <Bug className="w-4 h-4" /> },
  { id: 'clear', name: '清空', description: '清空对话', icon: <X className="w-4 h-4" /> },
];

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  thinking?: string;
  toolCalls?: ToolCallInfo[];
  timestamp: number;
  streamingItems?: StreamingItem[];
  agentQuestions?: AgentQuestion[];
  steps?: AgentStep[];
  todoItems?: TodoItem[];
  isTaskMessage?: boolean;
  fileEdits?: FileEditInfo[];
}

interface ToolCallInfo {
  id: string;
  toolName: string;
  params: Record<string, any>;
  status: 'running' | 'completed' | 'error';
  result?: any;
  error?: string;
  startTime?: number;
  endTime?: number;
  duration?: number;
}

interface FileEditInfo {
  id: string;
  filePath: string;
  status: 'editing' | 'completed' | 'error';
  content?: string;
  progress?: number;
  startTime?: number;
  endTime?: number;
}

interface QuickAction {
  id: string;
  icon: React.ReactNode;
  label: string;
  action: () => void;
}

// 打字机效果 Hook - 优化版
function useTypewriterEffect(text: string, speed: number = 30) {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const textRef = useRef(text);
  const indexRef = useRef(0);
  const rafRef = useRef<number>();
  const lastTimeRef = useRef(0);
  const speedRef = useRef(speed);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    if (text !== textRef.current) {
      textRef.current = text;
      indexRef.current = 0;
      setDisplayedText('');
      setIsComplete(false);
      lastTimeRef.current = 0;
    }

    const animate = (currentTime: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = currentTime;
      const deltaTime = currentTime - lastTimeRef.current;

      if (deltaTime >= speedRef.current) {
        if (indexRef.current < textRef.current.length) {
          const nextIndex = Math.min(indexRef.current + 3, textRef.current.length);
          indexRef.current = nextIndex;
          setDisplayedText(textRef.current.slice(0, nextIndex));
          lastTimeRef.current = currentTime;
          rafRef.current = requestAnimationFrame(animate);
        } else {
          setIsComplete(true);
        }
      } else {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    if (!isComplete && indexRef.current < textRef.current.length) {
      rafRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [text, isComplete]);

  return { displayedText, isComplete };
}

// 代码块组件
const CodeBlock: React.FC<{ code: string; language: string; onCopy: (code: string) => void; copiedCode: string | null }> = ({
  code, language, onCopy, copiedCode
}) => {
  const isCopied = copiedCode === code;
  const [isExpanded, setIsExpanded] = useState(true);
  const [showActions, setShowActions] = useState(false);
  const { openFile, workspacePath } = useWorkspaceStore();

  // 检测是否是完整的文件代码（包含文件路径注释）
  const filePathMatch = code.match(/\/\/\s*([^\n]+\.(tsx?|jsx?|py|java|cpp|c|h|hpp|css|scss|less|html|json|yaml|yml|xml|md|rs|go|php|rb|swift|kt|dart|vue|svelte))/i);
  const detectedFilePath = filePathMatch ? filePathMatch[1] : null;

  // 应用到文件
  const applyToFile = async () => {
    if (!workspacePath) {
      alert('请先打开工作区');
      return;
    }

    const filePath = detectedFilePath || prompt('请输入文件路径：', '');
    if (!filePath) return;

    const fullPath = filePath.startsWith('/') ? filePath : `${workspacePath}/${filePath}`;

    try {
      await window.electronAPI?.file?.write?.(fullPath, code);
      await openFile(fullPath);
    } catch (error) {
      console.error('Failed to apply code to file:', error);
      alert('应用代码到文件失败');
    }
  };

  // 插入到当前光标位置（复制到剪贴板，用户可粘贴）
  const insertAtCursor = () => {
    onCopy(code);
    alert('代码已复制到剪贴板，请在编辑器中粘贴');
  };

  // 折叠/展开代码
  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="relative group my-2 rounded-lg overflow-hidden border bg-muted/50 shadow-sm">
      {/* 代码块头部 */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/80 border-b">
        <div className="flex items-center gap-2">
          <FileCode className="w-3.5 h-3.5 text-muted-foreground" />
          {detectedFilePath && (
            <span className="text-[10px] text-primary/70 bg-primary/10 px-1.5 py-0.5 rounded">
              {detectedFilePath}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* 更多操作按钮 */}
          <div className="relative">
            <button
              onClick={() => setShowActions(!showActions)}
              className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              title="更多操作"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
            {showActions && (
              <div className="absolute right-0 top-full mt-1 py-1 bg-popover border rounded-lg shadow-lg z-50 min-w-[140px]">
                <button
                  onClick={() => { insertAtCursor(); setShowActions(false); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent text-left"
                >
                  <Code2 className="w-3.5 h-3.5" />
                  插入到光标处
                </button>
                <button
                  onClick={() => { applyToFile(); setShowActions(false); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent text-left"
                >
                  <FileEdit className="w-3.5 h-3.5" />
                  应用到文件
                </button>
                <div className="h-px bg-border my-1" />
                <button
                  onClick={() => { toggleExpand(); setShowActions(false); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent text-left"
                >
                  {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  {isExpanded ? '折叠代码' : '展开代码'}
                </button>
              </div>
            )}
          </div>
          {/* 复制按钮 */}
          <button
            onClick={() => onCopy(code)}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-md transition-all duration-200",
              isCopied
                ? "bg-green-500/10 text-green-600"
                : "hover:bg-accent text-muted-foreground hover:text-foreground"
            )}
          >
            {isCopied ? (
              <>
                <Check className="w-3 h-3" />
                <span className="text-[10px]">已复制</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span className="text-[10px]">复制</span>
              </>
            )}
          </button>
        </div>
      </div>
      {/* 代码内容 */}
      {isExpanded && (
        <SyntaxHighlighter
          style={vscDarkPlus}
          language={language}
          PreTag="div"
          customStyle={{
            margin: 0,
            padding: '0.75rem',
            background: 'transparent',
            fontSize: '0.75rem',
            lineHeight: '1.5',
            maxHeight: '500px',
            overflow: 'auto',
          }}
        >
          {code}
        </SyntaxHighlighter>
      )}
      {/* 折叠时的提示 */}
      {!isExpanded && (
        <div className="px-3 py-2 text-xs text-muted-foreground bg-muted/30">
          <button
            onClick={toggleExpand}
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" />
            点击展开 {code.split('\n').length} 行代码
          </button>
        </div>
      )}
    </div>
  );
};

// Markdown 内容组件 - 优化版
const MarkdownContent = React.memo(({ content, onCopy, copiedCode }: { 
  content: string; 
  onCopy: (code: string) => void; 
  copiedCode: string | null;
}) => {
  // 使用 useMemo 缓存代码块组件
  const components = useMemo(() => ({
    code({ node, inline, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || '');
      const code = String(children).replace(/\n$/, '');

      if (!inline && match) {
        return <CodeBlock code={code} language={match[1]} onCopy={onCopy} copiedCode={copiedCode} />;
      }
      return (
        <code className="px-1 py-0.5 bg-muted rounded text-xs font-mono" {...props}>
          {children}
        </code>
      );
    },
  }), [onCopy, copiedCode]);

  return (
    <ReactMarkdown components={components}>
      {content}
    </ReactMarkdown>
  );
});
MarkdownContent.displayName = 'MarkdownContent';

// 思考过程组件
const ThinkingBlock: React.FC<{
  thinking: string;
  isStreaming?: boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
}> = ({ thinking, isStreaming, isExpanded: controlledExpanded, onToggle }) => {
  const [internalExpanded, setInternalExpanded] = useState(true);
  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;
  const setIsExpanded = onToggle || setInternalExpanded;
  const contentRef = useRef<HTMLPreElement>(null);
  const blockRef = useRef<HTMLDivElement>(null);
  const [isSticky, setIsSticky] = useState(false);

  // 流式模式下自动滚动到底部
  useEffect(() => {
    if (isStreaming && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [thinking, isStreaming]);

  // 监听滚动，实现置顶效果
  useEffect(() => {
    const handleScroll = () => {
      if (!blockRef.current) return;
      
      const scrollContainer = blockRef.current.closest('.overflow-y-auto');
      if (!scrollContainer) return;

      const blockRect = blockRef.current.getBoundingClientRect();
      const containerRect = scrollContainer.getBoundingClientRect();
      
      // 当思考过程顶部到达容器顶部时，设置为置顶状态
      setIsSticky(blockRect.top <= containerRect.top + 10 && blockRect.bottom > containerRect.top + 50);
    };

    const scrollContainer = blockRef.current?.closest('.overflow-y-auto');
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
      handleScroll(); // 初始检查
      
      return () => {
        scrollContainer.removeEventListener('scroll', handleScroll);
      };
    }
  }, []);

  if (isStreaming) {
    return (
      <div 
        ref={blockRef}
        className={cn(
          "p-3 bg-gradient-to-r from-purple-500/5 to-blue-500/5 rounded-lg text-xs text-muted-foreground border border-purple-500/20 font-mono transition-all duration-200",
          isSticky && "sticky top-12 z-40 shadow-lg border-purple-500/40 bg-background/95 backdrop-blur-sm"
        )}
      >
        <div className="flex items-center gap-1.5 mb-2 text-purple-600">
          <Brain className="w-3 h-3" />
          <span className="font-medium">思考中...</span>
          <div className="flex items-center gap-1 ml-auto">
            <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
        <pre
          ref={contentRef}
          className="whitespace-pre-wrap max-h-48 overflow-y-auto scrollbar-thin"
        >
          {thinking}
        </pre>
      </div>
    );
  }

  return (
    <div ref={blockRef} className="mb-3">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors group px-2 py-1 rounded-md",
          isSticky && "sticky top-12 z-40 bg-background/95 backdrop-blur-sm shadow-sm border border-border/50"
        )}
      >
        <div className="w-5 h-5 rounded-md bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
          <Brain className="w-3 h-3 text-purple-500" />
        </div>
        <span className="font-medium">思考过程</span>
        <ChevronDown
          className={cn(
            'w-3 h-3 transition-transform duration-200',
            isExpanded && 'rotate-180'
          )}
        />
      </button>
      {isExpanded && (
        <div className="mt-2 p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground border border-border/50 font-mono animate-in fade-in slide-in-from-top-1 duration-200">
          <pre className="whitespace-pre-wrap">{thinking}</pre>
        </div>
      )}
    </div>
  );
};

// 工具调用卡片组件 - 优化版
const ToolCallCard = React.memo(({ toolCall, isExpanded: controlledExpanded, onToggle }: {
  toolCall: ToolCallInfo;
  isExpanded?: boolean;
  onToggle?: () => void;
}) => {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;
  const setIsExpanded = onToggle || setInternalExpanded;

  // 使用 useMemo 缓存状态配置
  const statusConfig = useMemo(() => ({
    running: {
      icon: <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />,
      color: 'bg-blue-500/5 border-blue-500/20',
      bgColor: 'bg-blue-500/10',
      textColor: 'text-blue-600',
      label: '执行中'
    },
    completed: {
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />,
      color: 'bg-green-500/5 border-green-500/20',
      bgColor: 'bg-green-500/10',
      textColor: 'text-green-600',
      label: '已完成'
    },
    error: {
      icon: <AlertCircle className="w-3.5 h-3.5 text-red-600" />,
      color: 'bg-red-500/5 border-red-500/20',
      bgColor: 'bg-red-500/10',
      textColor: 'text-red-600',
      label: '失败'
    },
    pending: {
      icon: <Circle className="w-3.5 h-3.5 text-gray-600" />,
      color: 'bg-gray-500/5 border-gray-500/20',
      bgColor: 'bg-gray-500/10',
      textColor: 'text-gray-600',
      label: '等待中'
    },
  }), []);

  const config = statusConfig[toolCall.status as keyof typeof statusConfig] || statusConfig.pending;

  // 使用 useCallback 缓存函数
  const getToolDescription = useCallback(() => {
    if (!toolCall.params) return '';
    const { file_path, dir_path, query, command, path } = toolCall.params;
    return file_path || dir_path || path || query || command || Object.values(toolCall.params)[0] || '';
  }, [toolCall.params]);

  const handleToggle = useCallback(() => {
    setIsExpanded(!isExpanded);
  }, [isExpanded, setIsExpanded]);

  return (
    <div className={cn(
      'rounded-lg text-xs border overflow-hidden transition-all duration-200',
      config.color,
      toolCall.status === 'running' && 'shadow-sm'
    )}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2.5 transition-all duration-200",
          "hover:bg-black/5 dark:hover:bg-white/5",
          isExpanded && "bg-black/5 dark:bg-white/5"
        )}
      >
        <div className={cn("w-6 h-6 rounded-md flex items-center justify-center", config.bgColor)}>
          {config.icon}
        </div>
        <div className="flex flex-col items-start gap-0.5">
          <span className={cn("font-medium text-xs", config.textColor)}>
            {toolCall.toolName}
          </span>
          <span className="text-[10px] text-muted-foreground/70">
            {config.label}
          </span>
        </div>
        {getToolDescription() && (
          <span className="text-muted-foreground truncate flex-1 text-left ml-2 text-[11px]">
            {getToolDescription()}
          </span>
        )}
        {toolCall.duration && (
          <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
            <Timer className="w-3 h-3" />
            {formatDuration(toolCall.duration)}
          </span>
        )}
        <div className={cn(
          "w-5 h-5 rounded flex items-center justify-center transition-transform duration-200",
          isExpanded && "rotate-90"
        )}>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
      </button>

      {isExpanded && (
        <div className="px-3 py-2.5 border-t border-border/50 bg-black/5 dark:bg-white/5 animate-in slide-in-from-top-1 duration-200">
          <div className="mb-3">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1.5">
              <Settings className="w-3 h-3" />
              <span>参数</span>
            </div>
            <pre className="text-[10px] bg-background/80 p-2.5 rounded-md overflow-x-auto border border-border/30">
              {JSON.stringify(toolCall.params, null, 2)}
            </pre>
          </div>

          {toolCall.result && (
            <div className="mb-3">
              <div className="flex items-center gap-1.5 text-[10px] text-green-600 mb-1.5">
                <CheckCircle2 className="w-3 h-3" />
                <span>结果</span>
              </div>
              <pre className="text-[10px] bg-background/80 p-2.5 rounded-md overflow-x-auto max-h-32 overflow-y-auto border border-green-500/20">
                {typeof toolCall.result === 'string' ? toolCall.result : JSON.stringify(toolCall.result, null, 2)}
              </pre>
            </div>
          )}

          {toolCall.error && (
            <div>
              <div className="flex items-center gap-1.5 text-[10px] text-red-600 mb-1.5">
                <AlertCircle className="w-3 h-3" />
                <span>错误</span>
              </div>
              <div className="text-[10px] text-red-600 bg-red-50 dark:bg-red-950/30 p-2.5 rounded-md border border-red-500/20">
                {toolCall.error}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
ToolCallCard.displayName = 'ToolCallCard';

// 文件编辑组件
const FileEdits: React.FC<{ edits: FileEditInfo[] }> = ({ edits }) => (
  <div className="mb-3 space-y-2">
    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
      <FileEdit className="w-3.5 h-3.5" />
      <span>文件编辑</span>
      <span className="text-muted-foreground/60">({edits.length})</span>
    </div>
    {edits.map((edit) => (
      <div
        key={edit.id}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg text-xs border',
          edit.status === 'editing'
            ? 'bg-amber-500/5 border-amber-500/20 text-amber-600'
            : edit.status === 'completed'
            ? 'bg-green-500/5 border-green-500/20 text-green-600'
            : 'bg-red-500/5 border-red-500/20 text-red-600'
        )}
      >
        {edit.status === 'editing' ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : edit.status === 'completed' ? (
          <CheckCircle2 className="w-3.5 h-3.5" />
        ) : (
          <AlertCircle className="w-3.5 h-3.5" />
        )}
        <FileCode className="w-3.5 h-3.5" />
        <span className="font-medium truncate">{edit.filePath}</span>
        {edit.status === 'editing' && edit.progress !== undefined && (
          <div className="ml-auto flex items-center gap-1.5">
            <div className="w-16 h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 transition-all"
                style={{ width: `${edit.progress}%` }}
              />
            </div>
            <span className="text-[10px]">{edit.progress}%</span>
          </div>
        )}
        {edit.endTime && edit.startTime && (
          <span className="ml-auto text-[10px] opacity-60">
            {formatDuration(edit.endTime - edit.startTime)}
          </span>
        )}
      </div>
    ))}
  </div>
);

// 格式化时长
function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

// 问题类型定义
interface AgentQuestion {
  id: string;
  question: string;
  context?: string;
  status: 'pending' | 'answered';
  answer?: string;
  options?: Array<{id: string; label: string; value: string}>;
}

// 流式项目类型
interface StreamingItem {
  type: 'text' | 'tool';
  content?: string;
  toolCall?: ToolCallInfo;
}

// 统一的消息内容组件
interface MessageContentProps {
  content: string;
  thinking?: string;
  toolCalls?: ToolCallInfo[];
  fileEdits?: FileEditInfo[];
  agentQuestions?: AgentQuestion[];
  streamingItems?: StreamingItem[];
  todoItems?: TodoItem[];
  isStreaming?: boolean;
  onCopy: (code: string) => void;
  copiedCode: string | null;
  expandedThinkingMsgs: Set<string>;
  expandedToolCalls: Set<string>;
  onToggleThinking: (msgId: string) => void;
  onToggleToolCall: (toolCallId: string) => void;
  onAnswerQuestion?: (questionId: string, answer: string) => void;
  messageId: string;
}

// 流式内容渲染组件 - 支持实时Markdown渲染
const StreamingContent: React.FC<{ content: string; onCopy: (code: string) => void; copiedCode: string | null }> = ({
  content, onCopy, copiedCode
}) => {
  // 实时渲染Markdown，不需要打字机效果
  return (
    <div className="relative">
      <MarkdownContent content={content} onCopy={onCopy} copiedCode={copiedCode} />
      <span className="inline-block w-2 h-4 bg-primary ml-0.5 animate-pulse" />
    </div>
  );
}

const MessageContent: React.FC<MessageContentProps> = ({
  content, thinking, toolCalls, fileEdits, agentQuestions, streamingItems, todoItems, isStreaming, onCopy, copiedCode,
  expandedThinkingMsgs, expandedToolCalls, onToggleThinking, onToggleToolCall, onAnswerQuestion, messageId
}) => {
  const {
    resultCards,
    taskProgress,
    collapsedThinking,
    collapsedToolCalls,
    toggleCollapsedThinking,
    toggleCollapsedToolCalls,
  } = useUnifiedAgentStore();

  // 解析 content 中的各种标签
  const parsedContent = useMemo(() => {
    if (!content) return { thinking: null, todoItems: null, options: null, question: null, cleanedContent: '' };
    
    let cleaned = content;
    let parsedThinking: string | null = null;
    let parsedTodoItems: TodoItem[] | null = null;
    let parsedOptions: { id: string; label: string; value: string }[] | null = null;
    let parsedQuestion: { question: string; options: { id: string; label: string; value: string }[] } | null = null;
    
    // 解析 <thinking> 或 <think> 标签
    const thinkingMatch = content.match(/<(think|thinking)>([\s\S]*?)<\/(think|thinking)>/i);
    if (thinkingMatch) {
      parsedThinking = thinkingMatch[2].trim();
      cleaned = cleaned.replace(thinkingMatch[0], '');
    }
    
    // 解析 <question> 标签（包含问题文本和选项）
    const questionMatch = content.match(/<question>([\s\S]*?)<\/question>/i);
    if (questionMatch) {
      const questionContent = questionMatch[1];
      // 提取问题文本（第一个 <option 之前的文本）
      const questionTextMatch = questionContent.match(/^([^<]*)/);
      const questionText = questionTextMatch ? questionTextMatch[1].trim() : '';
      
      // 提取所有选项 - 支持属性之间有或无空格
      const options: { id: string; label: string; value: string }[] = [];
      const optionRegex = /<option\s*(?:id="([^"]+)")?\s*value="([^"]+)"[^>]*>([^<]*)<\/option>/gi;
      let match;
      let idx = 0;
      while ((match = optionRegex.exec(questionContent)) !== null) {
        options.push({
          id: match[1] || `option-${idx++}`,
          value: match[2],
          label: match[3].trim() || match[2]
        });
      }
      
      if (questionText || options.length > 0) {
        parsedQuestion = { question: questionText, options };
        if (options.length > 0) parsedOptions = options;
      }
      cleaned = cleaned.replace(questionMatch[0], '');
    }
    
    // 解析 <todo> 标签
    const todoMatch = content.match(/<todo>([\s\S]*?)<\/todo>/i);
    if (todoMatch) {
      const todoContent = todoMatch[1];
      const tasks: TodoItem[] = [];
      // 支持属性之间有或无空格: <task id="1" status="pending"> 或 <taskid="1"status="pending">
      const taskRegex = /<task\s*(?:id="([^"]+)")?\s*(?:status="([^"]+)")?[^>]*>([^<]*)<\/task>/g;
      let match;
      while ((match = taskRegex.exec(todoContent)) !== null) {
        const id = match[1] || `task-${tasks.length}`;
        const status = (match[2] || 'pending') as 'pending' | 'in_progress' | 'completed' | 'failed';
        const taskContent = match[3].trim();
        if (taskContent) {
          tasks.push({ id, status, content: taskContent });
        }
      }
      if (tasks.length > 0) parsedTodoItems = tasks;
      cleaned = cleaned.replace(todoMatch[0], '');
    }
    
    // 解析 <option> 标签
    const optionMatch = content.match(/<options>([\s\S]*?)<\/options>/i);
    if (optionMatch) {
      const optionsContent = optionMatch[1];
      const options: { id: string; label: string; value: string }[] = [];
      const optionRegex = /<option[^>]*value="([^"]+)"[^>]*>([^<]*)<\/option>/g;
      let match;
      let idx = 0;
      while ((match = optionRegex.exec(optionsContent)) !== null) {
        options.push({
          id: `option-${idx++}`,
          value: match[1],
          label: match[2].trim() || match[1]
        });
      }
      if (options.length > 0) parsedOptions = options;
      cleaned = cleaned.replace(optionMatch[0], '');
    }
    
    return { 
      thinking: parsedThinking, 
      todoItems: parsedTodoItems, 
      options: parsedOptions,
      question: parsedQuestion,
      cleanedContent: cleaned.trim() 
    };
  }, [content]);

  // 使用解析的 todo 或传入的 todo
  const effectiveTodoItems = todoItems || parsedContent.todoItems;
  
  // 解析的思考内容（优先使用 props，其次解析 content）
  const effectiveThinking = thinking || parsedContent.thinking;
  
  // 解析的 options
  const effectiveOptions = parsedContent.options;

  // 计算任务进度
  const todoProgress = useMemo(() => {
    if (!effectiveTodoItems || effectiveTodoItems.length === 0) return null;
    const completed = effectiveTodoItems.filter(t => t.status === 'completed').length;
    const total = effectiveTodoItems.length;
    return { completed, total, percentage: Math.round((completed / total) * 100) };
  }, [effectiveTodoItems]);

  // 如果有 streamingItems，按时间顺序渲染
  if (streamingItems && streamingItems.length > 0) {
    return (
      <>
        {/* Result Cards - 结果卡片区域 */}
        {resultCards && resultCards.length > 0 && (
          <div className="mb-4 space-y-2">
            {resultCards.map((card, index) => (
              <ResultCard
                key={`result-${index}`}
                title={card.title}
                status={card.status}
                description={card.description}
                timestamp={card.timestamp}
              />
            ))}
          </div>
        )}

        {/* Task Progress - 任务进度展示（基于真实 runtime 状态） */}
        {taskProgress && (
          <div className="my-3 p-3 bg-muted/50 rounded-lg border">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-xs font-medium">
                <ListTodo className="w-4 h-4 text-primary" />
                <span>任务进度</span>
              </div>
              {taskProgress.currentStep !== undefined && taskProgress.totalSteps !== undefined && (
                <span className="text-xs text-muted-foreground">
                  {taskProgress.currentStep}/{taskProgress.totalSteps}
                </span>
              )}
            </div>
            {taskProgress.totalSteps !== undefined && taskProgress.totalSteps > 0 && (
              <div className="w-full h-1.5 bg-muted rounded-full mb-2 overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${Math.round((taskProgress.currentStep / taskProgress.totalSteps) * 100)}%` }}
                />
              </div>
            )}
            {taskProgress.message && (
              <p className="text-xs text-muted-foreground">{taskProgress.message}</p>
            )}
          </div>
        )}

        {/* Tool Calls - 工具调用（默认折叠） */}
        <div className="mb-3">
          <button
            onClick={toggleCollapsedToolCalls}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2 px-2 py-1 rounded-md hover:bg-muted"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>工具调用</span>
            <span className="text-muted-foreground/60">({streamingItems.filter(i => i.type === 'tool').length})</span>
            <ChevronDown
              className={cn(
                'w-3 h-3 transition-transform duration-200 ml-auto',
                collapsedToolCalls && 'rotate-180'
              )}
            />
          </button>
          {!collapsedToolCalls && (
            <div className="space-y-2">
              {streamingItems.map((item, index) => {
                if (item.type === 'tool') {
                  const tc = item.toolCall as ToolCallInfo | undefined;
                  if (tc && tc.id) {
                    return (
                      <div key={`${tc.id}-${index}`}>
                        <ToolCallCard
                          toolCall={tc}
                          isExpanded={expandedToolCalls.has(tc.id)}
                          onToggle={() => onToggleToolCall(tc.id)}
                        />
                      </div>
                    );
                  }
                }
                return null;
              })}
            </div>
          )}
        </div>

        {/* Thinking Process - 思考内容（默认折叠） */}
        {effectiveThinking && (
          <div className="mb-3">
            <button
              onClick={toggleCollapsedThinking}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2 px-2 py-1 rounded-md hover:bg-muted"
            >
              <Brain className="w-3.5 h-3.5" />
              <span>思考过程</span>
              <ChevronDown
                className={cn(
                  'w-3 h-3 transition-transform duration-200 ml-auto',
                  collapsedThinking && 'rotate-180'
                )}
              />
            </button>
            {!collapsedThinking && (
              <ThinkingBlock
                thinking={effectiveThinking}
                isStreaming={isStreaming}
                isExpanded={expandedThinkingMsgs.has(messageId)}
                onToggle={() => onToggleThinking(messageId)}
              />
            )}
          </div>
        )}

        {/* File Edits - 文件编辑操作 */}
        {fileEdits && fileEdits.length > 0 && <FileEdits edits={fileEdits} />}

        {/* Agent Questions */}
        {agentQuestions && agentQuestions.length > 0 && onAnswerQuestion && (
          <div className="mb-3">
            <AgentQuestions questions={agentQuestions} onAnswer={onAnswerQuestion} />
          </div>
        )}

        {/* Todo Items - 任务进度展示（备用，当 taskProgress 不可用时） */}
        {effectiveTodoItems && effectiveTodoItems.length > 0 && !taskProgress && (
          <div className="my-3 p-3 bg-muted/50 rounded-lg border">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-xs font-medium">
                <ListTodo className="w-4 h-4 text-primary" />
                <span>任务进度</span>
              </div>
              {todoProgress && (
                <span className="text-xs text-muted-foreground">
                  {todoProgress.completed}/{todoProgress.total} ({todoProgress.percentage}%)
                </span>
              )}
            </div>
            {todoProgress && (
              <div className="w-full h-1.5 bg-muted rounded-full mb-3 overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${todoProgress.percentage}%` }}
                />
              </div>
            )}
            <div className="space-y-1.5">
              {effectiveTodoItems.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 rounded-md text-xs",
                    item.status === 'pending' && "bg-muted/50 text-muted-foreground border",
                    item.status === 'in_progress' && "bg-blue-500/10 text-blue-600 border border-blue-500/20",
                    item.status === 'completed' && "bg-green-500/10 text-green-600 line-through",
                    item.status === 'failed' && "bg-red-500/10 text-red-600 border border-red-500/20"
                  )}
                >
                  {item.status === 'pending' && <Circle className="w-3 h-3" />}
                  {item.status === 'in_progress' && <Loader2 className="w-3 h-3 animate-spin" />}
                  {item.status === 'completed' && <CheckCircle2 className="w-3 h-3" />}
                  {item.status === 'failed' && <XCircle className="w-3 h-3" />}
                  <span className="flex-1">{item.content}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Question - 问题展示 */}
        {parsedContent.question && (
          <div className="my-3 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2 text-xs font-medium text-amber-600">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>需要您的回答</span>
            </div>
            <p className="text-sm text-foreground mb-3">{parsedContent.question.question}</p>
          </div>
        )}

        {/* Options - 选项按钮展示 */}
        {effectiveOptions && effectiveOptions.length > 0 && onAnswerQuestion && (
          <div className="my-3 flex flex-wrap gap-2">
            {effectiveOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => onAnswerQuestion(option.id, option.value)}
                className="px-3 py-2 text-sm bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-lg transition-colors"
              >
                {option.label}
              </button>
            ))}
          </div>
        )}

        {/* Content - AI回复内容 */}
        <div className="prose prose-sm dark:prose-invert max-w-none">
          {isStreaming ? (
            <StreamingContent content={parsedContent.cleanedContent || content} onCopy={onCopy} copiedCode={copiedCode} />
          ) : (
            <MarkdownContent content={parsedContent.cleanedContent || content} onCopy={onCopy} copiedCode={copiedCode} />
          )}
        </div>
      </>
    );
  }

  // 没有 streamingItems，按传统方式渲染（历史消息）
  return (
    <>
      {/* Result Cards - 结果卡片区域 */}
      {resultCards && resultCards.length > 0 && (
        <div className="mb-4 space-y-2">
          {resultCards.map((card, index) => (
            <ResultCard
              key={`result-${index}`}
              title={card.title}
              status={card.status}
              description={card.description}
              timestamp={card.timestamp}
            />
          ))}
        </div>
      )}

      {/* Task Progress - 任务进度展示（基于真实 runtime 状态） */}
      {taskProgress && (
        <div className="my-3 p-3 bg-muted/50 rounded-lg border">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs font-medium">
              <ListTodo className="w-4 h-4 text-primary" />
              <span>任务进度</span>
            </div>
            {taskProgress.currentStep !== undefined && taskProgress.totalSteps !== undefined && (
              <span className="text-xs text-muted-foreground">
                {taskProgress.currentStep}/{taskProgress.totalSteps}
              </span>
            )}
          </div>
          {taskProgress.totalSteps !== undefined && taskProgress.totalSteps > 0 && (
            <div className="w-full h-1.5 bg-muted rounded-full mb-2 overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${Math.round((taskProgress.currentStep / taskProgress.totalSteps) * 100)}%` }}
              />
            </div>
          )}
          {taskProgress.message && (
            <p className="text-xs text-muted-foreground">{taskProgress.message}</p>
          )}
        </div>
      )}

      {/* File Edits - 文件编辑操作 */}
      {fileEdits && fileEdits.length > 0 && <FileEdits edits={fileEdits} />}

      {/* Tool Calls - 工具调用（默认折叠） */}
      {toolCalls && toolCalls.length > 0 && (
        <div className="mb-3">
          <button
            onClick={toggleCollapsedToolCalls}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2 px-2 py-1 rounded-md hover:bg-muted"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>工具调用</span>
            <span className="text-muted-foreground/60">({toolCalls.length})</span>
            <ChevronDown
              className={cn(
                'w-3 h-3 transition-transform duration-200 ml-auto',
                collapsedToolCalls && 'rotate-180'
              )}
            />
          </button>
          {!collapsedToolCalls && (
            <div className="space-y-2">
              {toolCalls.map((tc, index) => (
                <ToolCallCard
                  key={tc.id}
                  toolCall={tc}
                  isExpanded={expandedToolCalls.has(tc.id)}
                  onToggle={() => onToggleToolCall(tc.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Thinking Process - 思考内容（默认折叠） */}
      {effectiveThinking && (
        <div className="mb-3">
          <button
            onClick={toggleCollapsedThinking}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2 px-2 py-1 rounded-md hover:bg-muted"
          >
            <Brain className="w-3.5 h-3.5" />
            <span>思考过程</span>
            <ChevronDown
              className={cn(
                'w-3 h-3 transition-transform duration-200 ml-auto',
                collapsedThinking && 'rotate-180'
              )}
            />
          </button>
          {!collapsedThinking && (
            <ThinkingBlock
              thinking={effectiveThinking}
              isStreaming={isStreaming}
              isExpanded={expandedThinkingMsgs.has(messageId)}
              onToggle={() => onToggleThinking(messageId)}
            />
          )}
        </div>
      )}

      {/* Agent Questions - 问题在内容之前展示 */}
      {agentQuestions && agentQuestions.length > 0 && onAnswerQuestion && (
        <div className="mb-3">
          <AgentQuestions questions={agentQuestions} onAnswer={onAnswerQuestion} />
        </div>
      )}

      {/* Todo Items - 任务进度展示（备用，当 taskProgress 不可用时） */}
      {effectiveTodoItems && effectiveTodoItems.length > 0 && !taskProgress && (
        <div className="my-3 p-3 bg-muted/50 rounded-lg border">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs font-medium">
              <ListTodo className="w-4 h-4 text-primary" />
              <span>任务进度</span>
            </div>
            {todoProgress && (
              <span className="text-xs text-muted-foreground">
                {todoProgress.completed}/{todoProgress.total} ({todoProgress.percentage}%)
              </span>
            )}
          </div>
          {todoProgress && (
            <div className="w-full h-1.5 bg-muted rounded-full mb-3 overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${todoProgress.percentage}%` }}
              />
            </div>
          )}
          <div className="space-y-1.5">
            {effectiveTodoItems.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "flex items-center gap-2 px-2 py-1.5 rounded-md text-xs",
                  item.status === 'pending' && "bg-muted/50 text-muted-foreground border",
                  item.status === 'in_progress' && "bg-blue-500/10 text-blue-600 border border-blue-500/20",
                  item.status === 'completed' && "bg-green-500/10 text-green-600 line-through",
                  item.status === 'failed' && "bg-red-500/10 text-red-600 border border-red-500/20"
                )}
              >
                {item.status === 'pending' && <Circle className="w-3 h-3" />}
                {item.status === 'in_progress' && <Loader2 className="w-3 h-3 animate-spin" />}
                {item.status === 'completed' && <CheckCircle2 className="w-3 h-3" />}
                {item.status === 'failed' && <XCircle className="w-3 h-3" />}
                <span className="flex-1">{item.content}</span>
                {item.priority && (
                  <span className={cn(
                    "text-[10px] px-1 rounded",
                    item.priority === 'high' && "bg-red-100 text-red-600",
                    item.priority === 'medium' && "bg-yellow-100 text-yellow-600",
                    item.priority === 'low' && "bg-gray-100 text-gray-600"
                  )}>
                    {item.priority}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Question - 问题展示 */}
      {parsedContent.question && (
        <div className="my-3 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
          <div className="flex items-center gap-2 mb-2 text-xs font-medium text-amber-600">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>需要您的回答</span>
          </div>
          <p className="text-sm text-foreground mb-3">{parsedContent.question.question}</p>
        </div>
      )}

      {/* Options - 选项按钮展示 */}
      {effectiveOptions && effectiveOptions.length > 0 && onAnswerQuestion && (
        <div className="my-3 flex flex-wrap gap-2">
          {effectiveOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => onAnswerQuestion(option.id, option.value)}
              className="px-3 py-2 text-sm bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-lg transition-colors"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      {/* Content - AI回复内容最后展示 */}
      <div className="prose prose-sm dark:prose-invert max-w-none">
        {isStreaming ? (
          <StreamingContent content={parsedContent.cleanedContent || content} onCopy={onCopy} copiedCode={copiedCode} />
        ) : (
          <MarkdownContent content={parsedContent.cleanedContent || content} onCopy={onCopy} copiedCode={copiedCode} />
        )}
      </div>
    </>
  );
};

// AI 消息头部组件
const AIMessageHeader: React.FC<{ 
  timestamp: number; 
  isProcessing?: boolean;
  isSoloMode?: boolean;
  elapsedTime?: number;
  isRetrying?: boolean;
  sendRetryCount?: number;
}> = ({ timestamp, isProcessing, isSoloMode, elapsedTime, isRetrying, sendRetryCount }) => (
  <div className="flex items-center gap-2 mb-2">
    <div className={cn(
      'w-6 h-6 rounded-lg flex items-center justify-center ring-1',
      isSoloMode ? 'bg-gradient-to-br from-amber-500/20 to-amber-500/5 ring-amber-500/20' : 'bg-gradient-to-br from-primary/20 to-primary/5 ring-primary/20'
    )}>
      {isSoloMode ? <Rocket className="w-3.5 h-3.5 text-amber-500" /> : <Bot className="w-3.5 h-3.5 text-primary" />}
    </div>
    <span className="text-xs font-medium text-muted-foreground">
      {isSoloMode ? 'SOLO Coder' : 'AI 助手'}
    </span>
    <span className="text-xs text-muted-foreground/60">
      {new Date(timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
    </span>
    {isProcessing && elapsedTime !== undefined && elapsedTime > 0 && (
      <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1 ml-auto">
        <Timer className="w-3 h-3" />
        {formatDuration(elapsedTime)}
      </span>
    )}
    {isRetrying && sendRetryCount !== undefined && (
      <span className="text-[10px] text-amber-600 flex items-center gap-1">
        <RotateCcw className="w-3 h-3 animate-spin" />
        重试中 {sendRetryCount + 1}/3
      </span>
    )}
  </div>
);

// AI 消息组件
interface AIMessageProps {
  messageId: string;
  content: string;
  thinking?: string;
  toolCalls?: ToolCallInfo[];
  fileEdits?: FileEditInfo[];
  streamingItems?: StreamingItem[];
  todoItems?: TodoItem[];
  timestamp: number;
  isStreaming?: boolean;
  isSoloMode?: boolean;
  onCopy: (code: string) => void;
  copiedCode: string | null;
  copiedMessageId: string | null;
  onCopyMessage: (msgId: string, content: string) => void;
  agentQuestions?: AgentQuestion[];
  onAnswerQuestion?: (questionId: string, answer: string) => void;
  expandedThinkingMsgs: Set<string>;
  expandedToolCalls: Set<string>;
  onToggleThinking: (msgId: string) => void;
  onToggleToolCall: (toolCallId: string) => void;
  elapsedTime?: number;
  isRetrying?: boolean;
  sendRetryCount?: number;
  isProcessing?: boolean;
}

const AIMessage: React.FC<AIMessageProps> = ({
  messageId, content, thinking, toolCalls, fileEdits, streamingItems, todoItems, timestamp, isStreaming, isSoloMode,
  onCopy, copiedCode, copiedMessageId, onCopyMessage, agentQuestions, onAnswerQuestion,
  expandedThinkingMsgs, expandedToolCalls, onToggleThinking, onToggleToolCall,
  elapsedTime, isRetrying, sendRetryCount, isProcessing
}) => (
  <div className="px-4 py-3 group">
    <AIMessageHeader 
      timestamp={timestamp} 
      isProcessing={isProcessing}
      isSoloMode={isSoloMode}
      elapsedTime={elapsedTime}
      isRetrying={isRetrying}
      sendRetryCount={sendRetryCount}
    />
    <MessageContent
      content={content}
      thinking={thinking}
      toolCalls={toolCalls}
      fileEdits={fileEdits}
      agentQuestions={agentQuestions}
      streamingItems={streamingItems}
      todoItems={todoItems}
      isStreaming={isStreaming}
      onCopy={onCopy}
      copiedCode={copiedCode}
      expandedThinkingMsgs={expandedThinkingMsgs}
      expandedToolCalls={expandedToolCalls}
      onToggleThinking={onToggleThinking}
      onToggleToolCall={onToggleToolCall}
      onAnswerQuestion={onAnswerQuestion}
      messageId={messageId}
    />
    
    {/* Message Actions */}
    <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
      <button
        onClick={() => onCopyMessage(messageId, content)}
        className="flex items-center gap-1 px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
        title="复制消息"
      >
        {copiedMessageId === messageId ? (
          <>
            <Check className="w-3 h-3 text-green-500" />
            <span>已复制</span>
          </>
        ) : (
          <>
            <Copy className="w-3 h-3" />
            <span>复制</span>
          </>
        )}
      </button>
    </div>
  </div>
);

// 智能体提问组件
const AgentQuestions: React.FC<{
  questions: AgentQuestion[];
  onAnswer: (questionId: string, answer: string) => void;
}> = ({ questions, onAnswer }) => {
  // 为每个问题创建独立的 input ref
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  const setInputRef = (questionId: string, el: HTMLInputElement | null) => {
    if (el) {
      inputRefs.current.set(questionId, el);
    } else {
      inputRefs.current.delete(questionId);
    }
  };

  const handleAnswerClick = (questionId: string) => {
    const input = inputRefs.current.get(questionId);
    if (input) {
      const answer = input.value;
      if (answer.trim()) {
        onAnswer(questionId, answer);
        input.value = '';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, questionId: string) => {
    if (e.key === 'Enter') {
      const answer = e.currentTarget.value;
      if (answer.trim()) {
        onAnswer(questionId, answer);
        e.currentTarget.value = '';
      }
    }
  };

  if (!questions || questions.length === 0) return null;

  return (
    <div className="space-y-2">
      {questions.map((q) => (
        <div key={q.id} className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
          <div className="flex items-center gap-2 mb-2 text-xs font-medium text-amber-600">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>{q.status === 'pending' ? '需要您的回答' : '已回答'}</span>
          </div>
          <p className="text-sm text-foreground mb-3">{q.question || '无问题内容'}</p>
          {q.status === 'pending' ? (
            <div className="space-y-2">
              {q.options && q.options.length > 0 && (
                <div className="space-y-1.5">
                  {q.options.map((option) => (
                    <button
                      key={option.id}
                      className="w-full text-left px-3 py-2 text-xs bg-background border rounded-md hover:bg-primary/5 hover:border-primary/30 transition-colors"
                      onClick={() => onAnswer(q.id, option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  ref={(el) => setInputRef(q.id, el)}
                  type="text"
                  placeholder={q.options && q.options.length > 0 ? "或输入其他答案..." : "输入您的回答..."}
                  className="flex-1 px-3 py-1.5 text-xs bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20"
                  onKeyDown={(e) => handleKeyDown(e, q.id)}
                />
                <button
                  className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                  onClick={() => handleAnswerClick(q.id)}
                >
                  回答
                </button>
              </div>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">已回答: {q.answer}</div>
          )}
        </div>
      ))}
    </div>
  );
};

export const ChatPanel: React.FC = () => {
  const [input, setInput] = useState('');
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [pendingEdits, setPendingEdits] = useState<CodeEditOperation[]>([]);
  const [currentEditIndex, setCurrentEditIndex] = useState(0);
  const [expandedThinkingMsgs, setExpandedThinkingMsgs] = useState<Set<string>>(new Set());
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [expandedToolCalls, setExpandedToolCalls] = useState<Set<string>>(new Set());
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [processingStartTime, setProcessingStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [sendRetryCount, setSendRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  // 新增：编辑消息功能
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editInput, setEditInput] = useState('');

  // 新增：代码块操作状态
  const [hoveredCodeBlock, setHoveredCodeBlock] = useState<string | null>(null);

  // 新增：输入框高度自适应
  const [inputHeight, setInputHeight] = useState(80);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const editInputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const streamingEndRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);
  const isUserScrolling = useRef(false);

  const {
    configs,
    activeConfigId,
    tasks,
    activeTaskId,
    isCreating,
    isProcessing,
    streamingMessage,
    streamingThinking,
    streamingToolCalls,
    error,
    createTask,
    createConfig,
    sendMessage,
    loadConfigs,
    loadTasks,
    setError,
    clearError,
    startTask,
    stopTask,
    deleteTask,
    setIsProcessing,
    answerQuestion,
    resultCards,
    taskProgress,
    collapsedThinking,
    collapsedToolCalls,
    toggleCollapsedThinking,
    toggleCollapsedToolCalls,
  } = useUnifiedAgentStore();

  const { workspacePath, openFiles, activeFilePath, updateFileContent } = useWorkspaceStore();
  const { selection, clearSelection } = useCodeEditorStore();
  const { aiConfigs, activeConfigId: activeAIConfigId, loadSettings, updateSettings } = useSettingsStore();

  const activeAIConfig = aiConfigs?.find((c) => c.id === activeAIConfigId);
  const filteredConfigs = activeAIConfig
    ? configs.filter((c) => c.aiConfig?.id === activeAIConfig.id)
    : configs;
  const displayConfigs = filteredConfigs.length > 0 ? filteredConfigs : configs;
  const activeConfig = displayConfigs.find((c) => c.id === activeConfigId) || displayConfigs[0];
  const currentRuntimeMode: AgentRuntimeMode = activeConfig?.runtimeMode || 'chat';
  const isSoloMode = currentRuntimeMode === 'solo';

  const activeTask = activeTaskId ? tasks.find(t => t.id === activeTaskId) : null;

  // Setup event listeners
  useEffect(() => {
    setupUnifiedAgentEventListeners();
    loadConfigs();
    loadTasks();
    loadSettings();
  }, []);

  // Sync local messages with store and add streaming message as temporary message
  const displayMessages = useMemo(() => {
    if (!activeTaskId) return [];

    const task = tasks.find((t) => t.id === activeTaskId);
    if (!task) return [];

    const messages: Message[] = task.messages.map((m) => ({
      id: m.id,
      role: m.role as 'user' | 'assistant',
      content: m.content,
      thinking: m.thinking,
      toolCalls: m.toolCalls?.map(tc => ({
        id: tc.id,
        toolName: tc.toolName,
        params: tc.params,
        status: tc.status,
        result: tc.result,
        error: tc.error,
      })),
      timestamp: m.timestamp,
      streamingItems: m.streamingItems,
      agentQuestions: m.agentQuestions,
      steps: task.steps,
      todoItems: task.todoItems,
    }));

    if (isProcessing && (streamingMessage || streamingThinking || streamingToolCalls.length > 0)) {
      const streamingMsg: Message = {
        id: 'streaming',
        role: 'assistant',
        content: streamingMessage,
        thinking: streamingThinking,
        toolCalls: streamingToolCalls.map(tc => ({
          id: tc.id,
          toolName: tc.toolName,
          params: tc.params,
          status: tc.status,
          result: tc.result,
          error: tc.error,
        })),
        timestamp: Date.now(),
        steps: task.steps,
        todoItems: task.todoItems,
      };
      messages.push(streamingMsg);
    }

    return messages;
  }, [tasks, activeTaskId, streamingMessage, streamingThinking, streamingToolCalls, isProcessing]);

  // Smart auto scroll - optimized
  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
      shouldAutoScroll.current = isAtBottom;
      if (!isAtBottom) {
        isUserScrolling.current = true;
      }
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (streamingEndRef.current) {
      if (shouldAutoScroll.current || !isUserScrolling.current) {
        streamingEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
        isUserScrolling.current = false;
      }
    }
  }, [displayMessages.length, streamingMessage, streamingThinking]);

  // Processing timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isProcessing) {
      if (!processingStartTime) {
        setProcessingStartTime(Date.now());
      }
      interval = setInterval(() => {
        if (processingStartTime) {
          setElapsedTime(Date.now() - processingStartTime);
        }
      }, 100);
    } else {
      setProcessingStartTime(null);
      setElapsedTime(0);
    }
    return () => clearInterval(interval);
  }, [isProcessing, processingStartTime]);

  // Restore input focus when processing ends
  const wasProcessingRef = useRef(false);
  useEffect(() => {
    if (wasProcessingRef.current && !isProcessing) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
    wasProcessingRef.current = isProcessing;
  }, [isProcessing]);

  const handleSlashCommand = useCallback((cmd: string) => {
    const trimmed = cmd.trim().toLowerCase();
    if (trimmed === '/clear') {
      clearConversation();
      return true;
    }
    return false;
  }, []);

  // 优化后的输入框处理
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);
    setShowSlashMenu(value.startsWith('/'));

    // 更智能的自动调整高度
    const textarea = e.target;
    textarea.style.height = 'auto';
    const scrollHeight = textarea.scrollHeight;
    const newHeight = Math.min(Math.max(scrollHeight, 80), 300);
    textarea.style.height = `${newHeight}px`;
    setInputHeight(newHeight);
  };

  // 编辑消息功能
  const startEditMessage = (messageId: string, currentContent: string) => {
    setEditingMessageId(messageId);
    setEditInput(currentContent);
    setTimeout(() => {
      editInputRef.current?.focus();
      // 将光标移到末尾
      editInputRef.current?.setSelectionRange(currentContent.length, currentContent.length);
    }, 0);
  };

  const cancelEditMessage = () => {
    setEditingMessageId(null);
    setEditInput('');
  };

  const saveEditMessage = async (messageId: string) => {
    if (!editInput.trim() || !activeTaskId) return;

    // 找到并更新消息
    const task = tasks.find(t => t.id === activeTaskId);
    if (task) {
      const messageIndex = task.messages.findIndex(m => m.id === messageId);
      if (messageIndex !== -1) {
        // 更新消息内容
        task.messages[messageIndex].content = editInput.trim();
        // 删除该消息之后的所有消息
        task.messages = task.messages.slice(0, messageIndex + 1);
        // 重新发送
        await handleSend(editInput.trim());
      }
    }
    cancelEditMessage();
  };

  // 删除单条消息
  const deleteMessage = (messageId: string) => {
    if (!activeTaskId) return;
    const task = tasks.find(t => t.id === activeTaskId);
    if (task) {
      task.messages = task.messages.filter(m => m.id !== messageId);
    }
  };

  // 清空对话
  const clearConversation = () => {
    if (!activeTaskId) return;
    const task = tasks.find(t => t.id === activeTaskId);
    if (task) {
      task.messages = [];
    }
    setInput('');
    setShowSlashMenu(false);
  };

  // 导出对话
  const exportConversation = () => {
    if (!activeTaskId || displayMessages.length === 0) return;

    const task = tasks.find(t => t.id === activeTaskId);
    if (!task) return;

    const exportData = {
      title: task.title,
      mode: task.runtimeMode,
      exportedAt: new Date().toISOString(),
      messages: displayMessages.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
        thinking: msg.thinking,
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversation-${task.title}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.startsWith('/') && handleSlashCommand(input)) return;
      handleSend();
    }
    if (e.key === 'Escape') setShowSlashMenu(false);
  };

  const handleSend = async (retryContent?: string) => {
    if (isProcessing && !retryContent) {
      if (activeTaskId) {
        // 如果有流式消息，先保存到任务中
        if (streamingMessage || streamingThinking) {
          const { addMessage, tasks } = useUnifiedAgentStore.getState();
          const streamingMsg: AgentMessage = {
            id: Date.now().toString(),
            role: 'assistant',
            content: streamingMessage || '(已暂停)',
            timestamp: Date.now(),
            thinking: streamingThinking || undefined,
            toolCalls: streamingToolCalls.length > 0 ? streamingToolCalls : undefined,
          };
          addMessage(activeTaskId, streamingMsg);
          // 保存任务到磁盘
          const task = tasks.find((t) => t.id === activeTaskId);
          if (task) {
            await window.electronAPI?.unifiedAgent?.saveTask?.({ task });
          }
        }
        await stopTask(activeTaskId);
      }
      return;
    }

    const content = retryContent || input.trim();
    if (!content) return;

    const config = activeConfig || configs[0];
    const hasAIConfig = aiConfigs && aiConfigs.length > 0;
    if (!config && !hasAIConfig) {
      setError('请先配置 AI 设置');
      return;
    }

    let taskId = activeTaskId;
    if (!taskId) {
      taskId = await createTask(content.slice(0, 20) + (content.length > 20 ? '...' : ''), content);
    }

    if (!taskId) return;

    if (!retryContent) {
      setInput('');
      if (inputRef.current) {
        inputRef.current.style.height = '80px';
      }
    }

    // SOLO模式：通过 sendMessage 处理，它会自动启动任务
    if (isSoloMode) {
      // SOLO 模式的逻辑在 sendMessage 中统一处理
      // 不需要在这里额外调用 startTask
    }

    // Send message with retry
    const maxRetries = 3;
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        setSendRetryCount(attempt);
        if (attempt > 0) {
          setIsRetrying(true);
        }
        await sendMessage(taskId, content);
        setSendRetryCount(0);
        setIsRetrying(false);
        return;
      } catch (error: any) {
        lastError = error;
        console.error(`Send message attempt ${attempt + 1} failed:`, error);
        
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }
    
    setIsRetrying(false);
    setSendRetryCount(0);
    const errorMsg = lastError?.message || '未知错误';
    // 更友好的错误提示
    let friendlyError = '发送失败';
    if (errorMsg.includes('network') || errorMsg.includes('fetch')) {
      friendlyError = '网络错误，请检查网络连接';
    } else if (errorMsg.includes('API') || errorMsg.includes('key')) {
      friendlyError = 'API 配置错误，请检查 API Key';
    } else if (errorMsg.includes('timeout')) {
      friendlyError = '请求超时，请稍后重试';
    }
    setError(`${friendlyError}，已重试 ${maxRetries} 次`);
  };

  const handleRetry = (content: string) => {
    handleSend(content);
  };

  const copyToClipboard = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const copyMessageContent = async (msgId: string, content: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedMessageId(msgId);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  const toggleThinking = (msgId: string) => {
    setExpandedThinkingMsgs(prev => {
      const next = new Set(prev);
      if (next.has(msgId)) {
        next.delete(msgId);
      } else {
        next.add(msgId);
      }
      return next;
    });
  };

  const toggleStep = (stepId: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  };

  const toggleToolCall = (toolCallId: string) => {
    setExpandedToolCalls((prev) => {
      const next = new Set(prev);
      if (next.has(toolCallId)) {
        next.delete(toolCallId);
      } else {
        next.add(toolCallId);
      }
      return next;
    });
  };

  const handleApplyEdit = async () => {
    if (pendingEdits.length === 0 || !workspacePath) return;

    const edit = pendingEdits[currentEditIndex];
    const result = await window.electronAPI?.aicoder?.applyEdit({ edit, workspacePath });

    if (result?.success) {
      if (currentEditIndex < pendingEdits.length - 1) {
        setCurrentEditIndex((prev) => prev + 1);
      } else {
        setShowDiff(false);
        setPendingEdits([]);
        setCurrentEditIndex(0);
        clearSelection();

        if (activeFilePath) {
          const file = openFiles.find((f) => f.path === activeFilePath);
          if (file) {
            const readResult = await window.electronAPI?.aicoder?.readFile({
              filePath: activeFilePath,
              workspacePath,
            });
            if (readResult?.success && readResult.content) {
              updateFileContent(activeFilePath, readResult.content);
            }
          }
        }
      }
    } else {
      alert(`应用编辑失败: ${result?.error}`);
    }
  };

  const handleRejectEdit = () => {
    setShowDiff(false);
    setPendingEdits([]);
    setCurrentEditIndex(0);
  };

  const getCurrentEditDisplay = () => {
    if (pendingEdits.length === 0) return null;
    const edit = pendingEdits[currentEditIndex];
    return {
      originalCode: edit.originalCode || '',
      modifiedCode: edit.newCode,
      fileName: edit.filePath.split('/').pop() || 'code',
      description: edit.description,
      progress: `${currentEditIndex + 1} / ${pendingEdits.length}`,
    };
  };

  const currentEditDisplay = getCurrentEditDisplay();
  const hasConfig = (aiConfigs && aiConfigs.length > 0) || configs.length > 0;

  // Quick action buttons
  const quickActions: QuickAction[] = [
    { id: 'at', icon: <AtSign className="w-4 h-4" />, label: '提及', action: () => setInput(prev => prev + '@') },
    { id: 'hash', icon: <Hash className="w-4 h-4" />, label: '上下文', action: () => setInput(prev => prev + '#') },
    { id: 'image', icon: <Image className="w-4 h-4" />, label: '图片', action: () => {} },
  ];

  return (
    <div className="flex h-full bg-background overflow-hidden">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/20">
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center ring-1',
              isSoloMode ? 'bg-gradient-to-br from-amber-500/20 to-amber-500/5 ring-amber-500/20' : 'bg-gradient-to-br from-primary/20 to-primary/5 ring-primary/20'
            )}>
              {isSoloMode ? <Rocket className="w-4 h-4 text-amber-500" /> : <Bot className="w-4 h-4 text-primary" />}
            </div>
            <div>
              <span className="font-semibold text-sm">
                {isSoloMode ? 'SOLO Coder' : activeConfig?.name || 'AI 助手'}
              </span>
              <p className="text-xs text-muted-foreground">
                {isSoloMode ? 'AI 全流程自动化开发' : "输入 '/' 获取更多能力，如 '/plan', '/spec'"}
              </p>
            </div>
          </div>

          {/* Task Controls for SOLO mode */}
          {isSoloMode && activeTask && (activeTask.status === 'completed' || activeTask.status === 'failed') && (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => deleteTask(activeTask.id)} className="h-8 w-8 p-0" title="删除任务">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto scrollbar-thin" ref={scrollRef}>
          {displayMessages.length === 0 && !streamingMessage && !isProcessing ? (
            <div className="h-full flex flex-col items-center justify-center px-8">
              <div className={cn(
                'w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ring-1',
                isSoloMode ? 'bg-gradient-to-br from-amber-500/20 to-amber-500/5 ring-amber-500/20' : 'bg-gradient-to-br from-primary/20 to-primary/5 ring-primary/20'
              )}>
                {isSoloMode ? <Rocket className="w-8 h-8 text-amber-500" /> : <Sparkles className="w-8 h-8 text-primary" />}
              </div>
              <h2 className="text-xl font-semibold mb-1">
                {isSoloMode ? 'SOLO Coder' : 'ywcoder'}
              </h2>
              <p className="text-sm text-muted-foreground text-center mb-2">
                当前模式: {isSoloMode ? 'SOLO 模式' : currentRuntimeMode === 'chat' ? '对话模式' : 'Agent 模式'}
              </p>
              <p className="text-sm text-muted-foreground text-center mb-6">
                {isSoloMode ? '描述你想要开发的功能，AI 将自动完成从规划到部署的全流程' : "输入 / 查看可用命令"}
              </p>

              {/* Quick Commands */}
              {!isSoloMode && (
                <div className="flex flex-wrap justify-center gap-2 max-w-md">
                  {['/act', '/plan', '/find', '/edit', '/code', '/ask'].map((cmd) => (
                    <button
                      key={cmd}
                      onClick={() => {
                        setInput(cmd + ' ');
                        inputRef.current?.focus();
                      }}
                      className="px-3 py-1.5 text-xs bg-muted hover:bg-accent rounded-md transition-colors border border-transparent hover:border-border"
                    >
                      {cmd}
                    </button>
                  ))}
                </div>
              )}

              {/* SOLO Mode Examples */}
              {isSoloMode && (
                <div className="text-xs text-muted-foreground space-y-2 bg-muted/30 rounded-lg p-4 max-w-sm">
                  <p className="font-medium mb-2">例如：</p>
                  <p className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    "帮我创建一个待办事项应用"
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    "开发一个简单的博客系统"
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    "重构这个项目的代码结构"
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="py-4 space-y-1">
              {/* SOLO Mode: SoloExecutionPanel */}
              {isSoloMode && activeTask && (
                <div className="px-4 mb-4">
                  <SoloExecutionPanel taskId={activeTask.id} />
                </div>
              )}

              {/* Messages */}
              {displayMessages.map((msg, index) => {
                const isUser = msg.role === 'user';
                const isStreaming = msg.id === 'streaming';
                const isLastMessage = index === displayMessages.length - 1;

                if (isUser) {
                  const isEditing = editingMessageId === msg.id;
                  return (
                    <div key={msg.id} className="flex justify-end px-4 py-2 group/message">
                      <div className="max-w-[85%] bg-primary/10 rounded-2xl rounded-tr-sm px-4 py-2.5 relative">
                        {isEditing ? (
                          <div className="space-y-2">
                            <textarea
                              ref={editInputRef}
                              value={editInput}
                              onChange={(e) => setEditInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  saveEditMessage(msg.id);
                                } else if (e.key === 'Escape') {
                                  cancelEditMessage();
                                }
                              }}
                              className="w-full min-h-[60px] bg-background rounded px-2 py-1 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                              rows={2}
                            />
                            <div className="flex items-center gap-2 justify-end">
                              <button
                                onClick={cancelEditMessage}
                                className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                              >
                                取消
                              </button>
                              <button
                                onClick={() => saveEditMessage(msg.id)}
                                className="px-2 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
                              >
                                保存
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="text-sm">{msg.content}</p>
                            {/* 消息操作按钮 */}
                            <div className="absolute -left-20 top-1/2 -translate-y-1/2 opacity-0 group-hover/message:opacity-100 transition-opacity flex items-center gap-1">
                              <button
                                onClick={() => startEditMessage(msg.id, msg.content)}
                                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                                title="编辑"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleRetry(msg.content)}
                                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                                title="重新发送"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => deleteMessage(msg.id)}
                                className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                title="删除"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={msg.id}
                    className="px-4 py-3 group"
                    ref={isLastMessage ? streamingEndRef : undefined}
                  >
                    <AIMessage
                      messageId={msg.id}
                      content={msg.content}
                      thinking={msg.thinking}
                      toolCalls={msg.toolCalls}
                      fileEdits={msg.fileEdits}
                      streamingItems={msg.streamingItems}
                      timestamp={msg.timestamp}
                      isStreaming={isStreaming}
                      isSoloMode={isSoloMode}
                      onCopy={copyToClipboard}
                      copiedCode={copiedCode}
                      copiedMessageId={copiedMessageId}
                      onCopyMessage={copyMessageContent}
                      agentQuestions={msg.agentQuestions}
                      onAnswerQuestion={(questionId, answer) => {
                        // 找到消息在 task.messages 中的索引
                        const task = tasks.find((t) => t.id === activeTaskId);
                        if (task) {
                          const messageIndex = task.messages.findIndex((m) => m.id === msg.id);
                          if (messageIndex !== -1) {
                            // 更新问题状态为已回答
                            answerQuestion(activeTaskId!, messageIndex, questionId, answer);
                          }
                        }
                        // 设置输入并发送
                        setInput(answer);
                        setTimeout(() => handleSend(), 0);
                      }}
                      expandedThinkingMsgs={expandedThinkingMsgs}
                      expandedToolCalls={expandedToolCalls}
                      onToggleThinking={toggleThinking}
                      onToggleToolCall={toggleToolCall}
                      elapsedTime={isStreaming ? elapsedTime : undefined}
                      isRetrying={isStreaming ? isRetrying : undefined}
                      sendRetryCount={isStreaming ? sendRetryCount : undefined}
                      isProcessing={isStreaming ? isProcessing : undefined}
                    />

                    {/* Streaming indicator - 改进的加载状态 */}
                    {isStreaming && isProcessing && (
                      <div className="flex items-center gap-3 mt-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 bg-primary/60 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                          <span className="w-2 h-2 bg-primary/60 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                          <span className="w-2 h-2 bg-primary/60 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {msg.thinking ? '思考中...' : msg.content ? '生成中...' : '准备中...'}
                        </span>
                        {elapsedTime > 0 && (
                          <span className="text-[10px] text-muted-foreground/60">
                            {formatDuration(elapsedTime)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Slash Command Menu */}
        {showSlashMenu && (
          <div className="border-t bg-card p-2 flex-shrink-0">
            <div className="text-xs font-medium text-muted-foreground px-2 mb-2 flex items-center gap-1.5">
              <Command className="w-3 h-3" />
              可用命令
            </div>
            <div className="grid grid-cols-3 gap-1">
              {SLASH_COMMANDS.map((cmd) => (
                <button
                  key={cmd.id}
                  onClick={() => { setInput(`/${cmd.id} `); setShowSlashMenu(false); inputRef.current?.focus(); }}
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-left hover:bg-accent transition-colors"
                >
                  {cmd.icon}
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="font-medium text-xs">/{cmd.id}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{cmd.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="border-t bg-card p-4 flex-shrink-0">
          {/* Session Management Toolbar */}
          {displayMessages.length > 0 && (
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <MessageCircle className="w-3.5 h-3.5" />
                <span>{displayMessages.length} 条消息</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={exportConversation}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                  title="导出对话"
                >
                  <Download className="w-3.5 h-3.5" />
                  导出
                </button>
                <button
                  onClick={() => {
                    if (confirm('确定要清空当前对话吗？')) {
                      clearConversation();
                    }
                  }}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  title="清空对话"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  清空
                </button>
              </div>
            </div>
          )}

          {/* Error Display with Retry - Optimized */}
          {error && (
            <div className="mb-3 mx-4">
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-700 mb-1">发生错误</p>
                    <p className="text-xs text-red-600/80">{error}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {isProcessing && (
                      <button
                        onClick={() => {
                          clearError();
                          const lastUserMessage = displayMessages
                            .slice()
                            .reverse()
                            .find((m: Message) => m.role === 'user');
                          if (lastUserMessage) {
                            handleRetry(lastUserMessage.content);
                          }
                        }}
                        className="flex items-center gap-1 px-2 py-1 text-[10px] bg-red-500/20 hover:bg-red-500/30 text-red-700 rounded transition-colors"
                        title="重试"
                      >
                        <RotateCcw className="w-3 h-3" />
                        重试
                      </button>
                    )}
                    <button
                      onClick={clearError}
                      className="p-1.5 hover:bg-red-500/20 rounded transition-colors text-red-600"
                      title="关闭"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Selection Indicator */}
          {selection && (
            <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-primary/5 rounded-lg border border-primary/10">
              <FileCode className="w-4 h-4 text-primary flex-shrink-0" />
              <span className="text-sm text-primary flex-1 truncate">
                {selection.filePath.split('/').pop()}:{selection.startLine}-{selection.endLine}
              </span>
              <button
                onClick={clearSelection}
                className="p-1 hover:bg-primary/10 rounded transition-colors flex-shrink-0"
              >
                <X className="w-3.5 h-3.5 text-primary" />
              </button>
            </div>
          )}

          {/* Input Box Container */}
          <div className="relative bg-muted rounded-xl border border-border/50 focus-within:border-primary/30 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
            {/* Input */}
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={
                !hasConfig
                  ? '请先配置 AI 设置...'
                  : isCreating
                  ? '创建任务中...'
                  : isProcessing && isSoloMode
                  ? 'AI 正在开发中，请稍候...'
                  : isProcessing
                  ? '处理中...'
                  : isSoloMode
                  ? '描述你想要开发的功能，按回车开始...'
                  : "输入 / 查看命令，或直接输入消息..."
              }
              className="w-full min-h-[80px] max-h-[200px] px-4 py-3 pr-24 bg-transparent resize-none focus:outline-none transition-all scrollbar-thin text-sm"
              rows={1}
              disabled={isProcessing || isCreating || !hasConfig}
            />

            {/* Bottom Toolbar */}
            <div className="flex items-center justify-between px-3 py-2 border-t border-border/30">
              {/* Left: Quick Actions */}
              <div className="flex items-center gap-1">
                {quickActions.map((action) => (
                  <button
                    key={action.id}
                    onClick={action.action}
                    className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                    title={action.label}
                  >
                    {action.icon}
                  </button>
                ))}
              </div>

              {/* Right: Model Selector & Send */}
              <div className="flex items-center gap-2">
                {/* Model Selector */}
                <div className="relative">
                  <button
                    onClick={() => setShowModelSelector(!showModelSelector)}
                    className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                  >
                    <span className="truncate max-w-[120px]">
                      {activeAIConfig?.model || activeAIConfig?.name || '选择模型'}
                    </span>
                    <ChevronDown className="w-3 h-3" />
                  </button>

                  {/* Model Dropdown */}
                  {showModelSelector && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowModelSelector(false)}
                      />
                      <div className="absolute bottom-full right-0 mb-1 w-56 bg-popover border rounded-lg shadow-lg z-50 py-1">
                        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground border-b">
                          选择 AI 模型 ({aiConfigs?.length || 0})
                        </div>
                        {(!aiConfigs || aiConfigs.length === 0) ? (
                          <div className="px-3 py-2 text-xs text-muted-foreground">
                            暂无 AI 配置，请先添加
                          </div>
                        ) : (
                          aiConfigs.map((config) => (
                            <button
                              key={config.id}
                              onClick={() => {
                                updateSettings({ activeConfigId: config.id });
                                setShowModelSelector(false);
                              }}
                              className={cn(
                                'w-full px-3 py-2 text-xs text-left hover:bg-accent transition-colors flex items-center gap-2',
                                activeAIConfigId === config.id && 'bg-accent'
                              )}
                            >
                              <span className="flex-1 truncate">
                                {config.model || config.name}
                                {config.isDefault && (
                                  <span className="text-muted-foreground ml-1">(默认)</span>
                                )}
                              </span>
                              {activeAIConfigId === config.id && <Check className="w-3 h-3 text-primary flex-shrink-0" />}
                            </button>
                          ))
                        )}
                        <div className="border-t mt-1 pt-1">
                          <button
                            onClick={() => setShowModelSelector(false)}
                            className="w-full px-3 py-2 text-xs text-left hover:bg-accent transition-colors flex items-center gap-2 text-muted-foreground"
                          >
                            <Settings className="w-3 h-3" />
                            管理模型
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Send Button */}
                <Button
                  size="sm"
                  onClick={() => handleSend()}
                  disabled={isCreating || !hasConfig}
                  className={cn(
                    "h-7 w-7 p-0 rounded-lg transition-colors",
                    isProcessing && "bg-red-500 hover:bg-red-600 text-white"
                  )}
                >
                  {isProcessing ? (
                    <Square className="w-3.5 h-3.5 fill-current" />
                  ) : isCreating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Input Hint */}
          <div className="flex items-center justify-between mt-2 px-1">
            <div className="text-[10px] text-muted-foreground">
              {isSoloMode ? 'SOLO 模式：AI 将自动完成全流程开发' : `当前模式: ${currentRuntimeMode === 'chat' ? '对话' : 'Agent'}`}
            </div>
            <div className="text-[10px] text-muted-foreground">
              Shift + Enter 换行
            </div>
          </div>
        </div>
      </div>

      {/* Diff Viewer */}
      {showDiff && currentEditDisplay && (
        <DiffViewer
          originalCode={currentEditDisplay.originalCode}
          modifiedCode={currentEditDisplay.modifiedCode}
          language={activeFilePath?.split('.').pop() || 'typescript'}
          fileName={currentEditDisplay.fileName}
          isOpen={showDiff}
          onClose={handleRejectEdit}
          onApply={handleApplyEdit}
          onReject={handleRejectEdit}
          progress={currentEditDisplay.progress}
          description={currentEditDisplay.description}
        />
      )}
    </div>
  );
};

export default ChatPanel;
