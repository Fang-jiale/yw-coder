/**
 * 智能上下文管理器
 * 参考 Aider、Cline 等工具的上下文管理策略
 * 实现动态上下文加载、相关性分析和 Token 优化
 */

import * as fs from 'fs/promises';
import * as pathModule from 'path';

/**
 * 上下文项
 */
interface ContextItem {
  id: string;
  type: 'file' | 'directory' | 'symbol' | 'conversation';
  content: string;
  path?: string;
  relevance: number;
  tokens: number;
  lastAccessed: number;
  accessCount: number;
}

/**
 * 上下文配置
 */
interface ContextConfig {
  maxTokens: number;
  maxItems: number;
  relevanceThreshold: number;
  decayFactor: number;
}

/**
 * 文件摘要
 */
interface FileSummary {
  path: string;
  summary: string;
  keySymbols: string[];
  dependencies: string[];
  exports: string[];
  size: number;
  lastModified: number;
}

/**
 * 上下文管理器
 */
export class ContextManager {
  private items: Map<string, ContextItem> = new Map();
  private fileSummaries: Map<string, FileSummary> = new Map();
  private config: ContextConfig;
  private workspacePath: string;

  constructor(workspacePath: string, config?: Partial<ContextConfig>) {
    this.workspacePath = workspacePath;
    this.config = {
      maxTokens: 8000,
      maxItems: 50,
      relevanceThreshold: 0.3,
      decayFactor: 0.95,
      ...config,
    };
  }

  /**
   * 初始化上下文
   */
  async initialize(): Promise<void> {
    // 扫描工作目录并建立文件索引
    await this.scanWorkspace();
  }

  /**
   * 扫描工作目录
   */
  private async scanWorkspace(): Promise<void> {
    const scanDir = async (dir: string, depth: number = 0) => {
      if (depth > 3) return;

      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = pathModule.join(dir, entry.name);
          const relativePath = pathModule.relative(this.workspacePath, fullPath);

          // 跳过忽略目录
          if (this.shouldIgnore(entry.name)) continue;

          if (entry.isDirectory()) {
            await scanDir(fullPath, depth + 1);
          } else if (this.isCodeFile(entry.name)) {
            // 为代码文件创建摘要
            await this.createFileSummary(relativePath);
          }
        }
      } catch (error) {
        // 忽略扫描错误
      }
    };

    await scanDir(this.workspacePath);
  }

  /**
   * 创建文件摘要
   */
  private async createFileSummary(filePath: string): Promise<void> {
    try {
      const fullPath = pathModule.join(this.workspacePath, filePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      const stats = await fs.stat(fullPath);

      // 提取关键信息
      const summary = this.generateSummary(content);
      const keySymbols = this.extractKeySymbols(content);
      const dependencies = this.extractDependencies(content);
      const exports = this.extractExports(content);

      this.fileSummaries.set(filePath, {
        path: filePath,
        summary,
        keySymbols,
        dependencies,
        exports,
        size: content.length,
        lastModified: stats.mtimeMs,
      });
    } catch (error) {
      // 忽略错误
    }
  }

  /**
   * 生成文件摘要
   */
  private generateSummary(content: string): string {
    // 提取文件头部的注释作为摘要
    const commentMatch = content.match(/\/\*\*[\s\S]*?\*\//);
    if (commentMatch) {
      return commentMatch[0]
        .replace(/\/\*\*|\*\//g, '')
        .replace(/\s*\*\s*/g, ' ')
        .trim()
        .slice(0, 200);
    }

    // 或者提取前几行
    const lines = content.split('\n').slice(0, 10);
    return lines.join(' ').slice(0, 200);
  }

  /**
   * 提取关键符号
   */
  private extractKeySymbols(content: string): string[] {
    const symbols: string[] = [];

    // 匹配类定义
    const classRegex = /class\s+(\w+)/g;
    let match;
    while ((match = classRegex.exec(content)) !== null) {
      symbols.push(match[1]);
    }

    // 匹配函数定义
    const functionRegex = /(?:function|const|let|var)\s+(\w+)\s*[=:]/g;
    while ((match = functionRegex.exec(content)) !== null) {
      symbols.push(match[1]);
    }

    return symbols.slice(0, 20);
  }

  /**
   * 提取依赖
   */
  private extractDependencies(content: string): string[] {
    const deps: string[] = [];
    const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      if (!match[1].startsWith('.')) {
        deps.push(match[1]);
      }
    }
    return [...new Set(deps)];
  }

  /**
   * 提取导出
   */
  private extractExports(content: string): string[] {
    const exports: string[] = [];
    const exportRegex = /export\s+(?:default\s+)?(?:class|function|const|interface|type)\s+(\w+)/g;
    let match;
    while ((match = exportRegex.exec(content)) !== null) {
      exports.push(match[1]);
    }
    return exports;
  }

  /**
   * 根据查询获取相关上下文
   */
  async getRelevantContext(query: string, maxTokens?: number): Promise<ContextItem[]> {
    const targetTokens = maxTokens || this.config.maxTokens;
    const relevantItems: ContextItem[] = [];
    let totalTokens = 0;

    // 计算每个文件的相关性
    const scoredFiles = Array.from(this.fileSummaries.entries())
      .map(([path, summary]) => ({
        path,
        summary,
        score: this.calculateRelevance(query, summary),
      }))
      .filter(item => item.score > this.config.relevanceThreshold)
      .sort((a, b) => b.score - a.score);

    // 加载高相关性文件
    for (const { path, summary, score } of scoredFiles) {
      if (relevantItems.length >= this.config.maxItems) break;

      try {
        const content = await fs.readFile(
          pathModule.join(this.workspacePath, path),
          'utf-8'
        );

        const tokens = this.estimateTokens(content);

        if (totalTokens + tokens > targetTokens) {
          // 如果超出限制，只加载文件摘要
          const summaryTokens = this.estimateTokens(summary.summary);
          if (totalTokens + summaryTokens <= targetTokens) {
            relevantItems.push({
              id: `summary-${path}`,
              type: 'file',
              content: `// File: ${path}\n// Summary: ${summary.summary}\n// Key symbols: ${summary.keySymbols.join(', ')}`,
              path,
              relevance: score,
              tokens: summaryTokens,
              lastAccessed: Date.now(),
              accessCount: 1,
            });
            totalTokens += summaryTokens;
          }
        } else {
          relevantItems.push({
            id: `file-${path}`,
            type: 'file',
            content: `// File: ${path}\n${content}`,
            path,
            relevance: score,
            tokens,
            lastAccessed: Date.now(),
            accessCount: 1,
          });
          totalTokens += tokens;
        }
      } catch (error) {
        // 忽略读取错误
      }
    }

    return relevantItems;
  }

  /**
   * 计算相关性分数
   */
  private calculateRelevance(query: string, summary: FileSummary): number {
    const queryTerms = query.toLowerCase().split(/\s+/);
    let score = 0;

    // 检查文件名匹配
    const fileName = pathModule.basename(summary.path).toLowerCase();
    for (const term of queryTerms) {
      if (fileName.includes(term)) score += 0.5;
    }

    // 检查符号匹配
    for (const term of queryTerms) {
      for (const symbol of summary.keySymbols) {
        if (symbol.toLowerCase().includes(term)) score += 0.3;
      }
    }

    // 检查摘要匹配
    const summaryText = summary.summary.toLowerCase();
    for (const term of queryTerms) {
      if (summaryText.includes(term)) score += 0.2;
    }

    // 检查导出匹配
    for (const term of queryTerms) {
      for (const exp of summary.exports) {
        if (exp.toLowerCase().includes(term)) score += 0.4;
      }
    }

    return Math.min(score, 1);
  }

  /**
   * 估算 Token 数量
   */
  private estimateTokens(text: string): number {
    // 简单估算：平均每 4 个字符一个 token
    return Math.ceil(text.length / 4);
  }

  /**
   * 添加上下文项
   */
  addContextItem(item: Omit<ContextItem, 'id' | 'lastAccessed' | 'accessCount'>): string {
    const id = `ctx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    this.items.set(id, {
      ...item,
      id,
      lastAccessed: Date.now(),
      accessCount: 0,
    });

    // 清理过期项
    this.cleanup();

    return id;
  }

  /**
   * 访问上下文项
   */
  accessContextItem(id: string): ContextItem | undefined {
    const item = this.items.get(id);
    if (item) {
      item.lastAccessed = Date.now();
      item.accessCount++;
    }
    return item;
  }

  /**
   * 清理过期上下文
   */
  private cleanup(): void {
    // 按相关性排序
    const sortedItems = Array.from(this.items.entries())
      .map(([id, item]) => ({
        id,
        item,
        score: this.calculateItemScore(item),
      }))
      .sort((a, b) => b.score - a.score);

    // 保留前 N 个
    const toKeep = sortedItems.slice(0, this.config.maxItems);
    this.items = new Map(toKeep.map(({ id, item }) => [id, item]));
  }

  /**
   * 计算上下文项分数
   */
  private calculateItemScore(item: ContextItem): number {
    const timeDecay = Math.pow(
      this.config.decayFactor,
      (Date.now() - item.lastAccessed) / 60000
    );
    return item.relevance * timeDecay * (1 + Math.log(item.accessCount + 1));
  }

  /**
   * 构建上下文提示词
   */
  buildContextPrompt(items: ContextItem[]): string {
    if (items.length === 0) return '';

    const sections: string[] = ['## Context\n'];

    // 按类型分组
    const grouped = this.groupByType(items);

    // 文件上下文
    if (grouped.file?.length) {
      sections.push('### Files\n');
      for (const item of grouped.file) {
        sections.push(item.content);
        sections.push('');
      }
    }

    // 符号上下文
    if (grouped.symbol?.length) {
      sections.push('### Symbols\n');
      for (const item of grouped.symbol) {
        sections.push(item.content);
      }
      sections.push('');
    }

    // 对话历史
    if (grouped.conversation?.length) {
      sections.push('### Conversation History\n');
      for (const item of grouped.conversation) {
        sections.push(item.content);
      }
    }

    return sections.join('\n');
  }

  /**
   * 按类型分组
   */
  private groupByType(items: ContextItem[]): Record<string, ContextItem[]> {
    return items.reduce((acc, item) => {
      if (!acc[item.type]) acc[item.type] = [];
      acc[item.type].push(item);
      return acc;
    }, {} as Record<string, ContextItem[]>);
  }

  /**
   * 检查是否应该忽略
   */
  private shouldIgnore(name: string): boolean {
    const ignoreList = [
      'node_modules',
      '.git',
      'dist',
      'build',
      '.next',
      'coverage',
      '.cache',
    ];
    return ignoreList.includes(name) || name.startsWith('.');
  }

  /**
   * 检查是否是代码文件
   */
  private isCodeFile(name: string): boolean {
    const codeExtensions = [
      '.ts',
      '.tsx',
      '.js',
      '.jsx',
      '.py',
      '.rs',
      '.go',
      '.java',
      '.cpp',
      '.c',
      '.h',
      '.swift',
      '.kt',
    ];
    return codeExtensions.some(ext => name.endsWith(ext));
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalFiles: number;
    indexedFiles: number;
    contextItems: number;
    totalTokens: number;
  } {
    return {
      totalFiles: this.fileSummaries.size,
      indexedFiles: this.fileSummaries.size,
      contextItems: this.items.size,
      totalTokens: Array.from(this.items.values()).reduce(
        (sum, item) => sum + item.tokens,
        0
      ),
    };
  }
}

export default ContextManager;
