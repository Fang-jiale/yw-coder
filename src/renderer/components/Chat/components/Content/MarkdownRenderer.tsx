/**
 * MarkdownRenderer 组件
 * 增强的 Markdown 渲染器，支持流式输出优化
 */

import React, { useMemo, useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MarkdownRendererProps {
  content: string;
  onCopy?: (code: string) => void;
  copiedCode?: string | null;
  className?: string;
  enableCodeCollapse?: boolean;
  enableLinkPreview?: boolean;
  maxCodeLines?: number;
  isStreaming?: boolean;
  streamingPlaceholder?: React.ReactNode;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  onCopy,
  copiedCode,
  className = '',
  enableCodeCollapse = true,
  maxCodeLines = 50,
  isStreaming = false,
  streamingPlaceholder,
}) => {
  // 所有 Hooks 必须在条件判断之前调用
  const [expandedCodeBlocks, setExpandedCodeBlocks] = useState<Set<number>>(new Set());
  const [copiedBlocks, setCopiedBlocks] = useState<Set<number>>(new Set());
  const codeBlockIndexRef = useRef(0);

  // useMemo 必须在条件判断之前调用
  const components = useMemo(
    () => ({
      code({
        node,
        inline,
        className,
        children,
        ...props
      }: {
        node?: unknown;
        inline?: boolean;
        className?: string;
        children?: React.ReactNode;
      }) {
        const match = /language-(\w+)/.exec(className || '');
        const code = String(children).replace(/\n$/, '');

        if (!inline && match) {
          const currentIndex = codeBlockIndexRef.current++;
          return (
            <EnhancedCodeBlock
              code={code}
              language={match[1]}
              onCopy={onCopy}
              copiedCode={copiedCode}
              enableCollapse={enableCodeCollapse}
              maxLines={maxCodeLines}
              expandedBlocks={expandedCodeBlocks}
              onToggleExpand={(index) => {
                const next = new Set(expandedCodeBlocks);
                if (next.has(index)) {
                  next.delete(index);
                } else {
                  next.add(index);
                }
                setExpandedCodeBlocks(next);
              }}
              copiedBlocks={copiedBlocks}
              onCopyBlock={(index) => {
                setCopiedBlocks(new Set([...copiedBlocks, index]));
                setTimeout(() => {
                  setCopiedBlocks((prev) => {
                    const next = new Set(prev);
                    next.delete(index);
                    return next;
                  });
                }, 2000);
              }}
              blockIndex={currentIndex}
            />
          );
        }

        return (
          <code
            className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono border border-border"
            {...props}
          >
            {children}
          </code>
        );
      },
      pre({ children }: { children?: React.ReactNode }) {
        return <>{children}</>;
      },
      a({ href, children }: { href?: string; children?: React.ReactNode }) {
        const isExternal = href?.startsWith('http');
        return (
          <a
            href={href}
            target={isExternal ? '_blank' : undefined}
            rel={isExternal ? 'noopener noreferrer' : undefined}
            className="text-blue-600 hover:text-blue-800 underline underline-offset-2"
          >
            {children}
          </a>
        );
      },
      table({ children }: { children?: React.ReactNode }) {
        return (
          <div className="overflow-x-auto my-2">
            <table className="min-w-full divide-y divide-border border border-border rounded-lg overflow-hidden">
              {children}
            </table>
          </div>
        );
      },
      thead({ children }: { children?: React.ReactNode }) {
        return <thead className="bg-muted/50">{children}</thead>;
      },
      th({ children }: { children?: React.ReactNode }) {
        return (
          <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {children}
          </th>
        );
      },
      td({ children }: { children?: React.ReactNode }) {
        return (
          <td className="px-4 py-2 text-sm">{children}</td>
        );
      },
      blockquote({ children }: { children?: React.ReactNode }) {
        return (
          <blockquote className="border-l-4 border-primary/50 pl-4 my-2 italic text-muted-foreground">
            {children}
          </blockquote>
        );
      },
      ul({ children }: { children?: React.ReactNode }) {
        return <ul className="list-disc list-inside space-y-1 my-2">{children}</ul>;
      },
      ol({ children }: { children?: React.ReactNode }) {
        return <ol className="list-decimal list-inside space-y-1 my-2">{children}</ol>;
      },
      li({ children }: { children?: React.ReactNode }) {
        return <li className="text-sm leading-relaxed">{children}</li>;
      },
      p({ children }: { children?: React.ReactNode }) {
        return <p className="my-2 text-sm leading-relaxed">{children}</p>;
      },
      h1({ children }: { children?: React.ReactNode }) {
        return <h1 className="text-2xl font-bold my-4">{children}</h1>;
      },
      h2({ children }: { children?: React.ReactNode }) {
        return <h2 className="text-xl font-bold my-3">{children}</h2>;
      },
      h3({ children }: { children?: React.ReactNode }) {
        return <h3 className="text-lg font-semibold my-2">{children}</h3>;
      },
      hr() {
        return <hr className="my-4 border-border" />;
      },
      img({ src, alt }: { src?: string; alt?: string }) {
        return (
          <img
            src={src}
            alt={alt}
            className="max-w-full h-auto rounded-lg my-2"
            loading="lazy"
          />
        );
      },
    }),
    // 优化依赖：只包含真正影响渲染逻辑的依赖
    [onCopy, copiedCode, enableCodeCollapse, maxCodeLines]
  );

  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
};

/**
 * 流式内容渲染组件
 * 使用轻量级渲染模式，避免频繁解析完整 Markdown
 */
interface StreamingContentProps {
  content: string;
  className?: string;
  streamingPlaceholder?: React.ReactNode;
}

const StreamingContent: React.FC<StreamingContentProps> = ({
  content,
  className = '',
  streamingPlaceholder,
}) => {
  // 解析内容，识别代码块和普通文本
  const segments = useMemo(() => {
    const result: Array<{
      type: 'text' | 'code';
      content: string;
      language?: string;
      isComplete: boolean;
    }> = [];

    const codeBlockRegex = /```(\w*)\n?([\s\S]*?)(?:```|$)/g;
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      // 添加代码块前的文本
      if (match.index > lastIndex) {
        result.push({
          type: 'text',
          content: content.slice(lastIndex, match.index),
          isComplete: true,
        });
      }

      const language = match[1] || 'text';
      const codeContent = match[2];
      // 代码块是否完整（以 ``` 结尾）
      const isComplete = match[0].endsWith('```');

      result.push({
        type: 'code',
        content: codeContent,
        language,
        isComplete,
      });

      lastIndex = match.index + match[0].length;
    }

    // 添加剩余文本
    if (lastIndex < content.length) {
      result.push({
        type: 'text',
        content: content.slice(lastIndex),
        isComplete: true,
      });
    }

    return result;
  }, [content]);

  // 默认占位符
  const defaultPlaceholder = (
    <div className="flex items-center gap-2 text-muted-foreground">
      <Loader2 className="w-4 h-4 animate-spin" />
      <span className="text-xs">生成中...</span>
    </div>
  );

  return (
    <div className={`streaming-content ${className}`}>
      {segments.map((segment, index) => {
        if (segment.type === 'code') {
          return (
            <StreamingCodeBlock
              key={index}
              code={segment.content}
              language={segment.language || 'text'}
              isComplete={segment.isComplete}
              placeholder={streamingPlaceholder || defaultPlaceholder}
            />
          );
        }

        // 普通文本直接渲染，使用简单的换行处理
        return (
          <StreamingTextBlock key={index} content={segment.content} />
        );
      })}
    </div>
  );
};

/**
 * 流式文本块 - 轻量级渲染
 */
interface StreamingTextBlockProps {
  content: string;
}

const StreamingTextBlock: React.FC<StreamingTextBlockProps> = ({ content }) => {
  // 简单处理：按行分割，保留基本格式
  const lines = content.split('\n');

  return (
    <div className="text-sm leading-relaxed whitespace-pre-wrap">
      {lines.map((line, index) => (
        <React.Fragment key={index}>
          {line}
          {index < lines.length - 1 && <br />}
        </React.Fragment>
      ))}
    </div>
  );
};

/**
 * 流式代码块 - 占位符框架 + 渐进填充
 */
interface StreamingCodeBlockProps {
  code: string;
  language: string;
  isComplete: boolean;
  placeholder: React.ReactNode;
}

const StreamingCodeBlock: React.FC<StreamingCodeBlockProps> = ({
  code,
  language,
  isComplete,
  placeholder,
}) => {
  const lines = code.split('\n');

  return (
    <div className="my-4 rounded-lg border border-border/60 overflow-hidden bg-[#1e1e1e] shadow-sm">
      {/* 头部区域 */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#2d2d2d] border-b border-border/40">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
            {language}
          </span>
          <span className="text-[11px] text-gray-500">
            {lines.length} 行
          </span>
        </div>

        {!isComplete && (
          <div className="flex items-center">
            {placeholder}
          </div>
        )}
      </div>

      {/* 代码区域 - 使用简单的 pre/code 标签 */}
      <div className="relative">
        <pre className="p-4 text-[13px] leading-6 overflow-x-auto bg-[#1e1e1e] m-0">
          <code className="font-mono text-gray-300 whitespace-pre">
            {code}
            {!isComplete && (
              <span className="inline-block w-2 h-4 bg-primary/50 ml-1 animate-pulse" />
            )}
          </code>
        </pre>
      </div>
    </div>
  );
};

interface EnhancedCodeBlockProps {
  code: string;
  language: string;
  onCopy?: (code: string) => void;
  copiedCode?: string | null;
  enableCollapse?: boolean;
  maxLines?: number;
  expandedBlocks?: Set<number>;
  onToggleExpand?: (index: number) => void;
  copiedBlocks?: Set<number>;
  onCopyBlock?: (index: number) => void;
  blockIndex?: number;
}

const EnhancedCodeBlock: React.FC<EnhancedCodeBlockProps> = ({
  code,
  language,
  onCopy,
  copiedCode,
  enableCollapse = true,
  maxLines = 50,
  expandedBlocks = new Set(),
  onToggleExpand,
  copiedBlocks = new Set(),
  onCopyBlock,
  blockIndex = 0,
}) => {
  const lines = code.split('\n');
  const shouldCollapse = enableCollapse && lines.length > maxLines;
  const isExpanded = expandedBlocks.has(blockIndex);
  const isCopied = copiedBlocks.has(blockIndex) || copiedCode === code;

  const displayCode = shouldCollapse && !isExpanded
    ? lines.slice(0, maxLines).join('\n')
    : code;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      onCopy?.(code);
      onCopyBlock?.(blockIndex);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleToggleExpand = () => {
    onToggleExpand?.(blockIndex);
  };

  return (
    <div className="my-4 rounded-lg border border-border/60 overflow-hidden bg-[#1e1e1e] shadow-sm">
      {/* 头部区域 - 更深的背景色 */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#2d2d2d] border-b border-border/40">
        <div className="flex items-center gap-3">
          {/* 语言标签 - 大写 */}
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
            {language}
          </span>
          {/* 代码行数 */}
          <span className="text-[11px] text-gray-500">
            {lines.length} 行
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* 折叠/展开按钮 */}
          {shouldCollapse && (
            <button
              onClick={handleToggleExpand}
              className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-gray-400 hover:text-gray-200 hover:bg-white/5 rounded transition-colors duration-150"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" />
                  <span>收起</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  <span>展开</span>
                </>
              )}
            </button>
          )}

          {/* 复制按钮 - 图标+文字 */}
          <button
            onClick={handleCopy}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded transition-all duration-200",
              isCopied
                ? "text-green-400 bg-green-400/10"
                : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
            )}
          >
            {isCopied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>已复制</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>复制</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 代码区域 */}
      <div className="relative">
        <pre className="p-4 text-[13px] leading-6 overflow-x-auto bg-[#1e1e1e]">
          <code className="font-mono text-gray-300 whitespace-pre">
            {displayCode}
          </code>
        </pre>

        {/* 折叠遮罩层 */}
        {shouldCollapse && !isExpanded && (
          <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-[#1e1e1e] to-transparent pointer-events-none" />
        )}
      </div>

      {/* 折叠提示信息 */}
      {shouldCollapse && !isExpanded && (
        <div className="px-4 py-2.5 bg-[#1e1e1e] border-t border-border/30 text-center">
          <span className="text-[11px] text-gray-500">
            还有 {lines.length - maxLines} 行代码被折叠
          </span>
        </div>
      )}
    </div>
  );
};
