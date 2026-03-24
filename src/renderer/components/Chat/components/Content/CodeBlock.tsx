/**
 * CodeBlock 组件
 * 增强的代码块展示
 */

import React, { useState } from 'react';
import { Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { extractLanguageFromFilename } from '../../utils/messageParser';

interface CodeBlockProps {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
  showCopyButton?: boolean;
  showExpandButton?: boolean;
  maxLines?: number;
  onCopy?: (code: string) => void;
  copiedCode?: string | null;
  className?: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  code,
  language = 'text',
  showLineNumbers = true,
  showCopyButton = true,
  showExpandButton = true,
  maxLines = 20,
  onCopy,
  copiedCode,
  className = '',
}) => {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const lines = code.split('\n');
  const shouldCollapse = lines.length > maxLines;
  const displayCode = shouldCollapse && !isExpanded
    ? lines.slice(0, maxLines).join('\n') + '\n...'
    : code;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      onCopy?.(code);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const displayLanguage = language === 'text' || !language
    ? extractLanguageFromFilename(language)
    : language;

  return (
    <div
      className={cn(
        'my-3 rounded-lg border border-border overflow-hidden bg-muted/50',
        className
      )}
    >
      <div className="flex items-center justify-between px-3 py-2 bg-muted border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium text-muted-foreground uppercase">
            {displayLanguage}
          </span>
          {shouldCollapse && (
            <span className="text-[10px] text-muted-foreground">
              ({lines.length} 行)
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {showExpandButton && shouldCollapse && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-6 px-2 text-xs"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="w-3 h-3 mr-1" />
                  收起
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3 mr-1" />
                  展开
                </>
              )}
            </Button>
          )}

          {showCopyButton && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-6 px-2 text-xs"
            >
              {copied || copiedCode === code ? (
                <>
                  <Check className="w-3 h-3 mr-1" />
                  已复制
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3 mr-1" />
                  复制
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      <div className="relative overflow-x-auto">
        <pre className="p-3 text-xs leading-relaxed overflow-x-auto">
          {showLineNumbers && (
            <div className="flex">
              <div className="flex-shrink-0 pr-4 select-none text-muted-foreground/50 text-right">
                {displayCode.split('\n').map((_, i) => (
                  <div key={i} className="h-[1.6rem]">
                    {i + 1}
                  </div>
                ))}
              </div>
              <code className="flex-1 font-mono whitespace-pre">{displayCode}</code>
            </div>
          )}

          {!showLineNumbers && (
            <code className="font-mono whitespace-pre">{displayCode}</code>
          )}
        </pre>
      </div>
    </div>
  );
};
