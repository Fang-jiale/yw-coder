import { useCallback, useEffect, useState, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { X, Circle, Wand2, ListTree } from 'lucide-react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useCodeEditorStore } from '@/store/codeEditorStore';
import { cn } from '@/lib/utils';
import { useInlineCompletion } from './InlineCompletionProvider';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import * as monaco from 'monaco-editor';

// 配置 Monaco 编辑器使用已导入的 monaco 实例，避免动态加载（支持离线环境）
import { loader } from '@monaco-editor/react';
loader.config({ monaco });

interface SymbolInfo {
  name: string;
  kind: monaco.languages.SymbolKind;
  range: monaco.IRange;
  children?: SymbolInfo[];
}

export const CodeEditor: React.FC = () => {
  const { 
    openFiles, 
    activeFilePath, 
    setActiveFile, 
    closeFile, 
    reorderFiles,
    updateFileContent,
    saveFile 
  } = useWorkspaceStore();
  const { theme, fontSize, fontFamily, tabSize, wordWrap, minimap } = useSettingsStore();
  const [editorInstance, setEditorInstance] = useState<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [showCompletionHint, setShowCompletionHint] = useState(false);
  const [showOutline, setShowOutline] = useState(false);
  const [symbols, setSymbols] = useState<SymbolInfo[]>([]);
  const [draggedTab, setDraggedTab] = useState<string | null>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  const activeFile = openFiles.find(f => f.path === activeFilePath);

  // Use inline completion hook
  useInlineCompletion(editorInstance);

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (activeFilePath && value !== undefined) {
      updateFileContent(activeFilePath, value);
    }
  }, [activeFilePath, updateFileContent]);

  const handleKeyDown = useCallback(async (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      if (activeFilePath) {
        await saveFile(activeFilePath);
      }
    }
    // Toggle outline panel
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'o') {
      e.preventDefault();
      setShowOutline(prev => !prev);
    }
  }, [activeFilePath, saveFile]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Update symbols when content changes
  const updateSymbols = useCallback(async () => {
    if (!editorInstance || !activeFile) return;
    
    const model = editorInstance.getModel();
    if (!model) return;

    try {
      // Get all registered document symbol providers for this language
      const providers = (monaco.languages as any).getDocumentSymbolProviders?.(activeFile.language) || [];
      
      if (providers.length > 0) {
        const documentSymbols = await providers[0].provideDocumentSymbols(
          model, 
          { isCancellationRequested: false, onCancellationRequested: () => ({ dispose: () => {} }) } as any
        );
        
        if (documentSymbols) {
          const flattenSymbols = (symbols: any[]): SymbolInfo[] => {
            return symbols.map(s => ({
              name: s.name,
              kind: s.kind,
              range: s.range,
              children: s.children ? flattenSymbols(s.children) : undefined
            }));
          };
          setSymbols(flattenSymbols(documentSymbols));
        }
      } else {
        setSymbols([]);
      }
    } catch (error) {
      // Symbol provider might not be available for this language
      setSymbols([]);
    }
  }, [editorInstance, activeFile]);

  const { setSelection } = useCodeEditorStore();

  const handleEditorDidMount = (editor: monaco.editor.IStandaloneCodeEditor) => {
    setEditorInstance(editor);
    editorRef.current = editor;
    setShowCompletionHint(true);

    // Hide hint after 5 seconds
    setTimeout(() => {
      setShowCompletionHint(false);
    }, 5000);

    // Update symbols initially and on content change
    updateSymbols();
    editor.onDidChangeModelContent(() => {
      updateSymbols();
    });

    // Listen for selection changes
    editor.onDidChangeCursorSelection((e) => {
      const model = editor.getModel();
      if (!model || !activeFile) return;

      const selection = e.selection;
      const startLine = selection.startLineNumber;
      const endLine = selection.endLineNumber;
      
      // Only capture if there's actual selection (not just cursor position)
      if (startLine !== endLine || selection.startColumn !== selection.endColumn) {
        const selectedText = model.getValueInRange(selection);
        if (selectedText.trim()) {
          setSelection({
            filePath: activeFile.path,
            code: selectedText,
            startLine,
            endLine,
            language: activeFile.language,
          });
        }
      }
    });
  };

  const handleSymbolClick = (symbol: SymbolInfo) => {
    if (editorInstance) {
      editorInstance.setPosition({
        lineNumber: symbol.range.startLineNumber,
        column: symbol.range.startColumn
      });
      editorInstance.revealRangeInCenter(symbol.range);
    }
  };

  const getSymbolIcon = (kind: monaco.languages.SymbolKind) => {
    switch (kind) {
      case monaco.languages.SymbolKind.Function:
      case monaco.languages.SymbolKind.Method:
        return 'ƒ';
      case monaco.languages.SymbolKind.Class:
        return 'C';
      case monaco.languages.SymbolKind.Interface:
        return 'I';
      case monaco.languages.SymbolKind.Variable:
        return 'V';
      case monaco.languages.SymbolKind.Property:
        return 'P';
      default:
        return '•';
    }
  };

  const renderSymbol = (symbol: SymbolInfo, depth: number = 0) => (
    <div key={`${symbol.name}-${symbol.range.startLineNumber}`}>
      <button
        onClick={() => handleSymbolClick(symbol)}
        className={cn(
          "w-full flex items-center gap-2 px-2 py-1 text-left text-sm hover:bg-accent rounded",
          "transition-colors"
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        <span className="text-muted-foreground text-xs w-4">{getSymbolIcon(symbol.kind)}</span>
        <span className="truncate">{symbol.name}</span>
      </button>
      {symbol.children?.map(child => renderSymbol(child, depth + 1))}
    </div>
  );

  // Drag and drop handlers for tabs
  const handleDragStart = (e: React.DragEvent, filePath: string) => {
    setDraggedTab(filePath);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetPath: string) => {
    e.preventDefault();
    if (draggedTab && draggedTab !== targetPath) {
      // Reorder tabs
      const draggedIndex = openFiles.findIndex(f => f.path === draggedTab);
      const targetIndex = openFiles.findIndex(f => f.path === targetPath);
      
      if (draggedIndex !== -1 && targetIndex !== -1) {
        reorderFiles(draggedIndex, targetIndex);
      }
    }
    setDraggedTab(null);
  };

  if (openFiles.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-lg mb-2 text-foreground font-medium">欢迎使用 ywcoder</p>
          <p className="text-sm text-muted-foreground">打开文件开始编辑，或使用 AI Builder 创建新项目</p>
          <div className="mt-6 flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <kbd className="px-2 py-1 bg-muted text-foreground rounded">Ctrl+Shift+P</kbd>
              命令面板
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-2 py-1 bg-muted text-foreground rounded">Tab</kbd>
              接受补全
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background relative">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30 border-b">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 px-2.5 text-xs font-medium",
              showOutline ? "bg-accent text-foreground" : "text-foreground/70 hover:text-foreground"
            )}
            onClick={() => setShowOutline(!showOutline)}
            title="代码大纲 (Ctrl+Shift+O)"
          >
            <ListTree className="w-3.5 h-3.5 mr-1.5" />
            大纲
          </Button>
        </div>
        <div className="text-xs text-foreground/60 font-medium">
          {activeFile && (
            <>
              <span className="text-foreground/80">{activeFile.language}</span>
              <span className="mx-2 text-border">|</span>
              <span>{activeFile.content.split('\n').length} 行</span>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Outline Panel */}
        {showOutline && (
          <div className="w-52 border-r bg-muted/20 flex flex-col">
            <div className="px-3 py-2.5 text-xs font-semibold text-foreground/80 uppercase tracking-wide border-b bg-muted/30">
              代码大纲
            </div>
            <ScrollArea className="flex-1">
              {symbols.length > 0 ? (
                <div className="p-1.5">
                  {symbols.map(symbol => renderSymbol(symbol))}
                </div>
              ) : (
                <div className="p-6 text-center">
                  <ListTree className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">暂无符号信息</p>
                </div>
              )}
            </ScrollArea>
          </div>
        )}

        {/* Editor Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Tabs */}
          <div className="flex items-center bg-muted/30 border-b overflow-x-auto">
            {openFiles.map(file => (
              <div
                key={file.path}
                draggable
                onDragStart={(e) => handleDragStart(e, file.path)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, file.path)}
                onClick={() => setActiveFile(file.path)}
                className={cn(
                  "group flex items-center gap-2 px-3 py-2 min-w-fit cursor-pointer border-r border-border/50 transition-all duration-150",
                  activeFilePath === file.path
                    ? "bg-background text-foreground border-t-2 border-t-primary shadow-sm"
                    : "text-foreground/60 hover:bg-accent/60 hover:text-foreground/80",
                  draggedTab === file.path && "opacity-50"
                )}
              >
                <span className="text-sm truncate max-w-[150px] font-medium">{file.name}</span>
                {file.isModified && (
                  <Circle className="w-2 h-2 fill-current text-foreground/70" />
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeFile(file.path);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-muted rounded transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          {/* Editor */}
          <div className="flex-1 relative">
            {activeFile && (
              <Editor
                height="100%"
                language={activeFile.language}
                value={activeFile.content}
                onChange={handleEditorChange}
                theme={theme === 'dark' ? 'vs-dark' : 'vs'}
                onMount={handleEditorDidMount}
                options={{
                  fontSize: fontSize,
                  fontFamily: fontFamily,
                  tabSize: tabSize,
                  wordWrap: wordWrap ? 'on' : 'off',
                  minimap: { 
                    enabled: minimap,
                    scale: 1,
                    showSlider: 'mouseover',
                    renderCharacters: true,
                    maxColumn: 120
                  },
                  automaticLayout: true,
                  scrollBeyondLastLine: false,
                  renderWhitespace: 'selection',
                  formatOnPaste: true,
                  formatOnType: true,
                  // Enhanced IDE features
                  folding: true,
                  foldingStrategy: 'auto',
                  foldingHighlight: true,
                  showFoldingControls: 'mouseover',
                  unfoldOnClickAfterEndOfLine: false,
                  // Multi-cursor support
                  multiCursorModifier: 'ctrlCmd',
                  multiCursorMergeOverlapping: true,
                  multiCursorPaste: 'spread',
                  // Bracket matching
                  matchBrackets: 'always',
                  autoClosingBrackets: 'always',
                  autoClosingQuotes: 'always',
                  autoSurround: 'languageDefined',
                  // IntelliSense
                  quickSuggestions: {
                    other: true,
                    comments: false,
                    strings: false,
                  },
                  suggestOnTriggerCharacters: true,
                  acceptSuggestionOnEnter: 'on',
                  parameterHints: {
                    enabled: true,
                    cycle: true
                  },
                  // Navigation
                  gotoLocation: {
                    multiple: 'goto',
                    multipleDeclarations: 'peek'
                  },
                  // Appearance
                  renderLineHighlight: 'all',
                  renderLineHighlightOnlyWhenFocus: true,
                  roundedSelection: true,
                  selectOnLineNumbers: true,
                  selectionHighlight: true,
                  occurrencesHighlight: 'singleFile',
                  // Code lens
                  codeLens: true,
                  // Hover
                  hover: {
                    enabled: true,
                    delay: 300,
                    sticky: true
                  },
                  // Links
                  links: true,
                  // Context menu
                  contextmenu: true,
                  mouseWheelZoom: true,
                  smoothScrolling: true,
                  cursorBlinking: 'blink',
                  cursorSmoothCaretAnimation: 'on',
                  cursorStyle: 'line',
                }}
              />
            )}

            {/* Completion Hint */}
            {showCompletionHint && (
              <div className="absolute bottom-4 right-4 bg-primary text-primary-foreground px-4 py-3 rounded-lg shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-2 text-sm">
                  <Wand2 className="w-4 h-4" />
                  <span>智能代码补全已启用</span>
                </div>
                <div className="text-xs mt-1 opacity-80">
                  输入代码时按 <kbd className="px-1 bg-primary-foreground/20 rounded">Tab</kbd> 接受建议
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export { CodeEditor as Editor };
