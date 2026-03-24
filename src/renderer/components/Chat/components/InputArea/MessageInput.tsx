/**
 * MessageInput 组件
 * 参考 Trae 风格：底部工具栏、发送按钮右下角、紧凑布局
 */

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Send, Loader2, Square, AtSign, Hash, Image as ImageIcon, X, ChevronDown, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { AIProviderConfig } from '../../../../../shared/types';
import { ContextUsage } from './ContextUsage';

interface ContextMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface AttachedFile {
  id: string;
  name: string;
  type: 'image' | 'file';
  content?: string;
  size: number;
}

interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (files?: AttachedFile[]) => void;
  onStop?: () => void;
  isProcessing?: boolean;
  isSending?: boolean;
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
  className?: string;
  aiConfigs?: AIProviderConfig[];
  activeAIConfigId?: string;
  onAIConfigChange?: (configId: string) => void;
  onOpenSettings?: () => void;
  // 上下文使用情况
  contextMessages?: ContextMessage[];
  contextLength?: number;
  systemPrompt?: string;
}

// 防抖钩子
function useDebounce<T extends (...args: any[]) => void>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout>();

  return useCallback(
    ((...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => callback(...args), delay);
    }) as T,
    [callback, delay]
  );
}

export const MessageInput: React.FC<MessageInputProps> = ({
  value,
  onChange,
  onSend,
  onStop,
  isProcessing = false,
  isSending = false,
  placeholder = '输入消息...',
  maxLength = 10000,
  disabled = false,
  className = '',
  aiConfigs = [],
  activeAIConfigId = '',
  onAIConfigChange,
  onOpenSettings,
  contextMessages = [],
  contextLength = 8000,
  systemPrompt = '',
}) => {
  const [inputHeight, setInputHeight] = useState(60);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [showConfigDropdown, setShowConfigDropdown] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeConfig = useMemo(
    () => aiConfigs.find((c) => c.id === activeAIConfigId) || aiConfigs[0],
    [aiConfigs, activeAIConfigId]
  );

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowConfigDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 防抖处理高度调整
  const debouncedAdjustHeight = useDebounce((textarea: HTMLTextAreaElement) => {
    textarea.style.height = 'auto';
    const scrollHeight = textarea.scrollHeight;
    const newHeight = Math.min(Math.max(scrollHeight, 60), 280);
    textarea.style.height = `${newHeight}px`;
    setInputHeight(newHeight);
  }, 10);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      if (newValue.length <= maxLength) {
        onChange(newValue);
        debouncedAdjustHeight(e.target);
      }
    },
    [maxLength, onChange, debouncedAdjustHeight]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (isProcessing && onStop) {
          onStop();
        } else if (value.trim() || attachedFiles.length > 0) {
          handleSend();
        }
      }
      if (e.key === 'Escape') {
        if (attachedFiles.length > 0) {
          setAttachedFiles([]);
        }
        setShowConfigDropdown(false);
      }
    },
    [isProcessing, onStop, value, attachedFiles]
  );

  const handleSend = useCallback(() => {
    if (value.trim() || attachedFiles.length > 0) {
      onSend(attachedFiles.length > 0 ? attachedFiles : undefined);
      // 清空输入框
      onChange('');
      setAttachedFiles([]);
      if (textareaRef.current) {
        textareaRef.current.style.height = '60px';
        setInputHeight(60);
      }
    }
  }, [value, attachedFiles, onSend, onChange]);

  // 处理文件粘贴
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const files: AttachedFile[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          const isImage = file.type.startsWith('image/');
          const id = `file-${Date.now()}-${i}`;

          if (isImage) {
            const reader = new FileReader();
            const content = await new Promise<string>((resolve) => {
              reader.onload = (e) => resolve(e.target?.result as string);
              reader.readAsDataURL(file);
            });
            files.push({ id, name: file.name, type: 'image', content, size: file.size });
          } else if (file.size < 1024 * 1024) {
            const reader = new FileReader();
            const content = await new Promise<string>((resolve) => {
              reader.onload = (e) => resolve(e.target?.result as string);
              reader.readAsText(file);
            });
            files.push({ id, name: file.name, type: 'file', content, size: file.size });
          } else {
            files.push({ id, name: file.name, type: 'file', size: file.size });
          }
        }
      }
    }

    if (files.length > 0) {
      setAttachedFiles((prev) => [...prev, ...files]);
    }
  }, []);

  // 处理图片选择
  const handleImageSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;

    const files: AttachedFile[] = [];
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      if (file.type.startsWith('image/')) {
        const id = `img-${Date.now()}-${i}`;
        const reader = new FileReader();
        const content = await new Promise<string>((resolve) => {
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        });
        files.push({ id, name: file.name, type: 'image', content, size: file.size });
      }
    }

    if (files.length > 0) {
      setAttachedFiles((prev) => [...prev, ...files]);
    }
    e.target.value = '';
  }, []);

  // 处理文件选择
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;

    const files: AttachedFile[] = [];
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const id = `file-${Date.now()}-${i}`;
      
      if (file.size < 1024 * 1024) {
        const reader = new FileReader();
        const content = await new Promise<string>((resolve) => {
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsText(file);
        });
        files.push({ id, name: file.name, type: 'file', content, size: file.size });
      } else {
        files.push({ id, name: file.name, type: 'file', size: file.size });
      }
    }

    if (files.length > 0) {
      setAttachedFiles((prev) => [...prev, ...files]);
    }
    e.target.value = '';
  }, []);

  // 拖放处理
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = e.dataTransfer.files;
    const files: AttachedFile[] = [];

    for (let i = 0; i < droppedFiles.length; i++) {
      const file = droppedFiles[i];
      const isImage = file.type.startsWith('image/');
      const id = `file-${Date.now()}-${i}`;

      if (isImage) {
        const reader = new FileReader();
        const content = await new Promise<string>((resolve) => {
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        });
        files.push({ id, name: file.name, type: 'image', content, size: file.size });
      } else if (file.size < 1024 * 1024) {
        const reader = new FileReader();
        const content = await new Promise<string>((resolve) => {
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsText(file);
        });
        files.push({ id, name: file.name, type: 'file', content, size: file.size });
      } else {
        files.push({ id, name: file.name, type: 'file', size: file.size });
      }
    }

    if (files.length > 0) {
      setAttachedFiles((prev) => [...prev, ...files]);
    }
  }, []);

  // 移除附件
  const removeAttachedFile = useCallback((id: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const canSend = (value.trim().length > 0 || attachedFiles.length > 0) && !disabled;
  const canStop = isProcessing && onStop;

  return (
    <div
      className={cn('relative', className)}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* 拖放遮罩 */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-primary/5 border-2 border-dashed border-primary/30 rounded-lg backdrop-blur-sm">
          <p className="text-sm text-muted-foreground">释放以上传文件</p>
        </div>
      )}

      {/* 附件预览 */}
      {attachedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2 px-1">
          {attachedFiles.map((file) => (
            <div
              key={file.id}
              className="group flex items-center gap-1.5 px-2 py-1 bg-muted rounded-md text-xs border border-border/50"
            >
              {file.type === 'image' ? (
                <ImageIcon className="w-3 h-3 text-blue-500" />
              ) : (
                <Hash className="w-3 h-3 text-orange-500" />
              )}
              <span className="max-w-[100px] truncate">{file.name}</span>
              <button
                onClick={() => removeAttachedFile(file.id)}
                className="p-0.5 rounded hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 主输入区域 */}
      <div
        className={cn(
          'relative rounded-lg border bg-muted/40 transition-all duration-200',
          'focus-within:border-primary/40 focus-within:bg-background focus-within:shadow-sm',
          isDragging && 'border-primary/30 bg-primary/5'
        )}
      >
        {/* 文本输入 - 支持多行 */}
        <div className="px-3 pt-3 pb-2">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={placeholder}
            disabled={disabled}
            className="w-full resize-none bg-transparent border-0 outline-none text-sm placeholder:text-muted-foreground/50 disabled:cursor-not-allowed min-h-[60px] max-h-[280px] leading-relaxed"
            style={{ height: `${inputHeight}px` }}
            rows={3}
          />
        </div>

        {/* 底部工具栏 */}
        <div className="flex items-center justify-between px-2 pb-2">
          {/* 左侧工具按钮 */}
          <div className="flex items-center gap-0.5">
            {/* @ 提及 */}
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-accent/50"
              onClick={() => onChange(value + '@')}
            >
              <AtSign className="w-4 h-4" />
            </Button>

            {/* # 文件引用 */}
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-accent/50"
              onClick={() => fileInputRef.current?.click()}
            >
              <Hash className="w-4 h-4" />
            </Button>

            {/* 图片上传 */}
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-accent/50"
              onClick={() => imageInputRef.current?.click()}
            >
              <ImageIcon className="w-4 h-4" />
            </Button>

            {/* AI 配置下拉选择 */}
            <div className="relative ml-1" ref={dropdownRef}>
              {aiConfigs.length === 0 ? (
                <button
                  onClick={onOpenSettings}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-amber-500 hover:bg-amber-500/10 rounded transition-colors"
                >
                  <span>配置 AI</span>
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setShowConfigDropdown(!showConfigDropdown)}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded transition-colors"
                  >
                    <span className="font-medium">{activeConfig?.model || 'AI'}</span>
                    <ChevronDown className={cn('w-3 h-3 transition-transform', showConfigDropdown && 'rotate-180')} />
                  </button>

                  {/* 下拉菜单 */}
                  {showConfigDropdown && (
                    <div className="absolute bottom-full left-0 mb-2 w-56 rounded-lg border bg-popover shadow-lg overflow-hidden z-50">
                      <div className="max-h-48 overflow-y-auto py-1">
                        {aiConfigs.map((config) => (
                          <button
                            key={config.id}
                            onClick={() => {
                              onAIConfigChange?.(config.id);
                              setShowConfigDropdown(false);
                            }}
                            className={cn(
                              'w-full px-3 py-2 text-left text-xs hover:bg-accent transition-colors',
                              config.id === activeAIConfigId && 'bg-accent'
                            )}
                          >
                            <div className="font-medium truncate">{config.name}</div>
                            <div className="text-[10px] text-muted-foreground truncate">
                              {config.provider} · {config.model}
                            </div>
                          </button>
                        ))}
                      </div>
                      {/* 跳转到设置 */}
                      <div className="border-t py-1">
                        <button
                          onClick={() => {
                            onOpenSettings?.();
                            setShowConfigDropdown(false);
                          }}
                          className="w-full px-3 py-2 text-left text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors flex items-center gap-1.5"
                        >
                          <Settings className="w-3 h-3" />
                          <span>AI 设置</span>
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* 上下文使用情况 */}
            {contextMessages.length > 0 && (
              <ContextUsage
                messages={contextMessages}
                maxContextTokens={contextLength}
                systemPrompt={systemPrompt}
                className="ml-2"
              />
            )}
          </div>

          {/* 右侧发送按钮 */}
          <div className="flex items-center gap-2">
            {/* 字数提示 */}
            {value.length > 0 && (
              <span className={cn(
                'text-[10px] tabular-nums text-muted-foreground/50',
                value.length > maxLength * 0.9 && 'text-amber-500'
              )}>
                {value.length}
              </span>
            )}

            {/* 发送/停止按钮 */}
            {canStop ? (
              <Button
                size="icon"
                onClick={onStop}
                variant="ghost"
                className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
              </Button>
            ) : (
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!canSend}
                className={cn(
                  'h-7 w-7 rounded-md transition-all duration-200',
                  canSend
                    ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
                    : 'bg-muted text-muted-foreground cursor-not-allowed'
                )}
              >
                {isSending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".txt,.md,.json,.js,.ts,.jsx,.tsx,.py,.java,.cpp,.c,.h,.html,.css,.scss,.less,.yaml,.yml,.xml,.sql"
        className="hidden"
        onChange={handleFileSelect}
      />
      <input
        ref={imageInputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={handleImageSelect}
      />
    </div>
  );
};
