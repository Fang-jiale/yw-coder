import { useState, useEffect } from 'react';
import { X, Check, FileCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  oldLineNumber?: number;
  newLineNumber?: number;
  content: string;
}

interface DiffViewerProps {
  originalCode: string;
  modifiedCode: string;
  language: string;
  fileName: string;
  isOpen: boolean;
  onClose: () => void;
  onApply: () => void;
  onReject: () => void;
  progress?: string;
  description?: string;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  originalCode,
  modifiedCode,
  fileName,
  isOpen,
  onClose,
  onApply,
  onReject,
  progress,
  description,
}) => {
  const [diffLines, setDiffLines] = useState<DiffLine[]>([]);
  const [stats, setStats] = useState({ added: 0, removed: 0 });

  useEffect(() => {
    if (!isOpen) return;

    const computeDiff = () => {
      const originalLines = originalCode.split('\n');
      const modifiedLines = modifiedCode.split('\n');
      
      const diff: DiffLine[] = [];
      let added = 0;
      let removed = 0;

      // Simple diff algorithm
      let i = 0;
      let j = 0;
      
      while (i < originalLines.length || j < modifiedLines.length) {
        const originalLine = originalLines[i];
        const modifiedLine = modifiedLines[j];

        if (i >= originalLines.length) {
          // Remaining lines are added
          diff.push({
            type: 'added',
            newLineNumber: j + 1,
            content: modifiedLine,
          });
          added++;
          j++;
        } else if (j >= modifiedLines.length) {
          // Remaining lines are removed
          diff.push({
            type: 'removed',
            oldLineNumber: i + 1,
            content: originalLine,
          });
          removed++;
          i++;
        } else if (originalLine === modifiedLine) {
          // Lines are the same
          diff.push({
            type: 'unchanged',
            oldLineNumber: i + 1,
            newLineNumber: j + 1,
            content: originalLine,
          });
          i++;
          j++;
        } else {
          // Lines are different - mark as removed and added
          diff.push({
            type: 'removed',
            oldLineNumber: i + 1,
            content: originalLine,
          });
          removed++;
          i++;
          
          diff.push({
            type: 'added',
            newLineNumber: j + 1,
            content: modifiedLine,
          });
          added++;
          j++;
        }
      }

      setDiffLines(diff);
      setStats({ added, removed });
    };

    computeDiff();
  }, [originalCode, modifiedCode, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <FileCode className="w-5 h-5 text-primary" />
            <div>
              <h3 className="font-semibold">代码变更预览</h3>
              <p className="text-xs text-muted-foreground">
                {fileName}
                {progress && <span className="ml-2 text-primary">({progress})</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 text-sm">
              <span className="flex items-center gap-1 text-green-600">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                +{stats.added} 行
              </span>
              <span className="flex items-center gap-1 text-red-600">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                -{stats.removed} 行
              </span>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Description */}
        {description && (
          <div className="px-6 py-3 bg-primary/5 border-b">
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        )}

        {/* Diff Content */}
        <ScrollArea className="flex-1 max-h-[60vh]">
          <div className="font-mono text-sm">
            {/* Legend */}
            <div className="flex border-b bg-muted/50 sticky top-0">
              <div className="w-16 py-2 px-2 text-right text-muted-foreground border-r">旧行</div>
              <div className="w-16 py-2 px-2 text-right text-muted-foreground border-r">新行</div>
              <div className="flex-1 py-2 px-4">代码</div>
            </div>

            {/* Diff Lines */}
            {diffLines.map((line, index) => (
              <div
                key={index}
                className={cn(
                  'flex border-b border-transparent hover:bg-muted/30',
                  line.type === 'added' && 'bg-green-500/10',
                  line.type === 'removed' && 'bg-red-500/10'
                )}
              >
                {/* Old Line Number */}
                <div className={cn(
                  'w-16 py-1 px-2 text-right text-muted-foreground border-r select-none',
                  line.type === 'added' && 'text-green-600',
                  line.type === 'removed' && 'text-red-600'
                )}>
                  {line.oldLineNumber || ''}
                </div>

                {/* New Line Number */}
                <div className={cn(
                  'w-16 py-1 px-2 text-right text-muted-foreground border-r select-none',
                  line.type === 'added' && 'text-green-600',
                  line.type === 'removed' && 'text-red-600'
                )}>
                  {line.newLineNumber || ''}
                </div>

                {/* Content */}
                <div className={cn(
                  'flex-1 py-1 px-4 whitespace-pre',
                  line.type === 'added' && 'text-green-700 dark:text-green-400',
                  line.type === 'removed' && 'text-red-700 dark:text-red-400'
                )}>
                  {line.type === 'added' && <span className="text-green-500 mr-2">+</span>}
                  {line.type === 'removed' && <span className="text-red-500 mr-2">-</span>}
                  {line.type === 'unchanged' && <span className="text-muted-foreground mr-2"> </span>}
                  {line.content || ' '}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-muted/30">
          <div className="text-sm text-muted-foreground">
            共 {diffLines.length} 行变更
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onReject}>
              <X className="w-4 h-4 mr-2" />
              放弃
            </Button>
            <Button onClick={onApply}>
              <Check className="w-4 h-4 mr-2" />
              应用变更
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiffViewer;
