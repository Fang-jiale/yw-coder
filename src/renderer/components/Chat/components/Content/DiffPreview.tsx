/**
 * DiffPreview 组件
 * 代码差异预览
 */

import React, { useMemo } from 'react';
import { Diff, Plus, Minus, Equal } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DiffLine {
  type: 'add' | 'remove' | 'unchanged';
  content: string;
  lineNumber: number;
}

interface DiffPreviewProps {
  original: string;
  modified: string;
  filePath?: string;
  className?: string;
}

export const DiffPreview: React.FC<DiffPreviewProps> = ({
  original,
  modified,
  filePath,
  className = '',
}) => {
  const diff = useMemo(() => {
    const originalLines = original.split('\n');
    const modifiedLines = modified.split('\n');
    const result: DiffLine[] = [];

    let originalIndex = 0;
    let modifiedIndex = 0;

    while (originalIndex < originalLines.length || modifiedIndex < modifiedLines.length) {
      const originalLine = originalLines[originalIndex];
      const modifiedLine = modifiedLines[modifiedIndex];

      if (originalLine === modifiedLine) {
        result.push({
          type: 'unchanged',
          content: originalLine,
          lineNumber: modifiedIndex + 1,
        });
        originalIndex++;
        modifiedIndex++;
      } else if (originalIndex < originalLines.length && !modifiedLines.includes(originalLine)) {
        result.push({
          type: 'remove',
          content: originalLine,
          lineNumber: originalIndex + 1,
        });
        originalIndex++;
      } else if (modifiedIndex < modifiedLines.length) {
        result.push({
          type: 'add',
          content: modifiedLine,
          lineNumber: modifiedIndex + 1,
        });
        modifiedIndex++;
      }
    }

    return result;
  }, [original, modified]);

  const stats = useMemo(() => {
    const added = diff.filter((line) => line.type === 'add').length;
    const removed = diff.filter((line) => line.type === 'remove').length;
    return { added, removed };
  }, [diff]);

  return (
    <div className={cn('rounded-lg border border-border overflow-hidden', className)}>
      <div className="bg-muted px-4 py-2 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Diff className="w-4 h-4" />
          <span className="text-sm font-medium">
            {filePath || '代码差异'}
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
            <Plus className="w-3 h-3" />
            <span>{stats.added}</span>
          </div>
          <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
            <Minus className="w-3 h-3" />
            <span>{stats.removed}</span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
        <table className="w-full text-xs font-mono">
          <tbody>
            {diff.map((line, index) => (
              <tr
                key={index}
                className={cn(
                  'hover:bg-accent/50 transition-colors',
                  line.type === 'add' && 'bg-green-50 dark:bg-green-900/10',
                  line.type === 'remove' && 'bg-red-50 dark:bg-red-900/10'
                )}
              >
                <td className="w-12 px-2 py-1 text-right text-muted-foreground select-none border-r border-border">
                  {line.type !== 'add' ? line.lineNumber : ''}
                </td>
                <td className="w-8 px-2 py-1 text-center select-none">
                  {line.type === 'add' ? (
                    <Plus className="w-3 h-3 text-green-600 dark:text-green-400" />
                  ) : line.type === 'remove' ? (
                    <Minus className="w-3 h-3 text-red-600 dark:text-red-400" />
                  ) : (
                    <Equal className="w-3 h-3 text-muted-foreground/30" />
                  )}
                </td>
                <td className="px-3 py-1 whitespace-pre">{line.content}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
