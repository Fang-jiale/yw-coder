import { useEffect, useRef, useCallback } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import { useWorkspaceStore } from '@/store/workspaceStore';

export const useInlineCompletion = (editor: any) => {
  useSettingsStore();
  const { openFiles, activeFilePath } = useWorkspaceStore();
  const completionWidgetRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastRequestTimeRef = useRef<number>(0);

  const activeFile = openFiles.find(f => f.path === activeFilePath);

  const fetchCompletion = useCallback(async (
    code: string,
    language: string,
    position: { line: number; column: number }
  ): Promise<string | null> => {
    // Debounce: only request every 500ms
    const now = Date.now();
    if (now - lastRequestTimeRef.current < 500) {
      return null;
    }
    lastRequestTimeRef.current = now;

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const response = await window.electronAPI?.ai?.complete({
        code,
        language,
        position,
        filePath: activeFilePath || '',
      });

      return response || null;
    } catch (error) {
      console.error('Failed to fetch completion:', error);
      return null;
    }
  }, [activeFilePath]);

  const showCompletion = useCallback((completion: string, position: any) => {
    if (!editor) return;

    // Hide previous completion
    hideCompletion();

    // Create inline completion widget
    const content = completion.trim();
    if (!content) return;

    const domNode = document.createElement('div');
    domNode.className = 'inline-completion-widget';
    domNode.style.cssText = `
      color: var(--muted-foreground);
      opacity: 0.6;
      font-style: italic;
      pointer-events: none;
      white-space: pre;
    `;
    domNode.textContent = content;

    // Add to editor
    completionWidgetRef.current = editor.createContentWidget({
      getId: () => 'inline-completion',
      getDomNode: () => domNode,
      getPosition: () => ({
        position: {
          lineNumber: position.lineNumber,
          column: position.column,
        },
        preference: [0],
      }),
    });

    // Add key listener to accept/reject
    const keyListener = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        acceptCompletion(content);
      } else if (e.key === 'Escape') {
        hideCompletion();
      }
    };

    editor.getDomNode()?.addEventListener('keydown', keyListener, true);
    
    // Store listener for cleanup
    (completionWidgetRef.current as any)._keyListener = keyListener;
  }, [editor]);

  const acceptCompletion = useCallback((completion: string) => {
    if (!editor || !completion) return;

    const position = editor.getPosition();
    if (!position) return;

    // Insert completion text
    editor.executeEdits('inline-completion', [{
      range: {
        startLineNumber: position.lineNumber,
        startColumn: position.column,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      },
      text: completion,
    }]);

    hideCompletion();
  }, [editor]);

  const hideCompletion = useCallback(() => {
    if (completionWidgetRef.current && editor) {
      // Remove key listener
      const listener = (completionWidgetRef.current as any)._keyListener;
      if (listener) {
        editor.getDomNode()?.removeEventListener('keydown', listener, true);
      }

      editor.removeContentWidget(completionWidgetRef.current);
      completionWidgetRef.current = null;
    }
  }, [editor]);

  useEffect(() => {
    if (!editor || !activeFile) return;

    let timeoutId: NodeJS.Timeout;

    const handleType = () => {
      // Clear previous timeout
      clearTimeout(timeoutId);

      // Hide existing completion
      hideCompletion();

      // Debounce completion request
      timeoutId = setTimeout(async () => {
        const position = editor.getPosition();
        if (!position) return;

        const model = editor.getModel();
        if (!model) return;

        const code = model.getValue();
        const language = activeFile.language;

        const completion = await fetchCompletion(code, language, {
          line: position.lineNumber - 1,
          column: position.column - 1,
        });

        if (completion) {
          showCompletion(completion, position);
        }
      }, 300);
    };

    // Listen for typing events
    const disposable = editor.onDidType(() => {
      handleType();
    });

    // Listen for cursor position changes
    const cursorDisposable = editor.onDidChangeCursorPosition(() => {
      hideCompletion();
    });

    return () => {
      clearTimeout(timeoutId);
      disposable.dispose();
      cursorDisposable.dispose();
      hideCompletion();
    };
  }, [editor, activeFile, fetchCompletion, showCompletion, hideCompletion]);

  return {
    hideCompletion,
  };
};
