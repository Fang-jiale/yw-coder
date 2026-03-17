import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check, X, FileCode } from 'lucide-react';
import { DiffEditor } from '@monaco-editor/react';

interface CodeDiffViewerProps {
  originalCode: string;
  modifiedCode: string;
  language: string;
  filePath: string;
  onAccept: () => void;
  onReject: () => void;
}

export const CodeDiffViewer: React.FC<CodeDiffViewerProps> = ({
  originalCode,
  modifiedCode,
  language,
  filePath,
  onAccept,
  onReject,
}) => {
  const [isExpanded] = useState(true);

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted border-b">
        <div className="flex items-center gap-2">
          <FileCode className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium truncate max-w-[200px]">{filePath}</span>
          <span className="text-xs text-muted-foreground">({language})</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-green-600 hover:text-green-700 hover:bg-green-100"
            onClick={onAccept}
          >
            <Check className="w-4 h-4 mr-1" />
            接受
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-100"
            onClick={onReject}
          >
            <X className="w-4 h-4 mr-1" />
            拒绝
          </Button>
        </div>
      </div>

      {/* Diff Editor */}
      {isExpanded && (
        <div className="h-[300px]">
          <DiffEditor
            original={originalCode}
            modified={modifiedCode}
            language={language}
            theme="vs-dark"
            options={{
              readOnly: true,
              renderSideBySide: true,
              diffWordWrap: 'on',
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              folding: false,
              lineNumbers: 'on',
              renderIndicators: true,
              renderMarginRevertIcon: false,
            }}
          />
        </div>
      )}
    </div>
  );
};

// Simple inline diff for small changes
export const InlineDiff: React.FC<{
  oldCode: string;
  newCode: string;
  onApply: () => void;
  onDismiss: () => void;
}> = ({ oldCode, newCode, onApply, onDismiss }) => {
  const oldLines = oldCode.split('\n');
  const newLines = newCode.split('\n');

  return (
    <div className="my-2 border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-muted border-b">
        <span className="text-sm font-medium">代码更改</span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-7" onClick={onApply}>
            <Check className="w-4 h-4 mr-1" />
            应用
          </Button>
          <Button variant="ghost" size="sm" className="h-7" onClick={onDismiss}>
            <X className="w-4 h-4 mr-1" />
            忽略
          </Button>
        </div>
      </div>
      <div className="p-3 bg-background">
        <div className="text-sm font-mono">
          {oldLines.map((line, i) => (
            <div key={i} className="text-red-500 line-through opacity-50">
              - {line}
            </div>
          ))}
          {newLines.map((line, i) => (
            <div key={`new-${i}`} className="text-green-600">
              + {line}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
